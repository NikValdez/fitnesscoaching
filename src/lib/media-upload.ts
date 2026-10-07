import { MEDIA_PART_SIZE, partLength, type MediaAction } from './media-validation'

export const MEDIA_PARALLEL_PARTS = 2
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message)
  }
}
type UploadSession = { id: string; status: 'UPLOADING' | 'READY'; parts: number[] }
export function mediaAction(data: Extract<MediaAction, { action: 'start' }>): Promise<UploadSession>
export function mediaAction(data: MediaAction): Promise<{ id: string }>
export async function mediaAction(data: MediaAction): Promise<{ id: string }> {
  const response = await fetch('/api/admin/media', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
  if (!response.ok)
    throw new UploadError(
      result.error || 'Could not save this change. Please retry.',
      response.status,
    )
  return result as { id: string }
}
export function sendMediaPart(
  id: string,
  part: number,
  blob: Blob,
  signal: AbortSignal,
  progress: (loaded: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const finish = () => signal.removeEventListener('abort', abort)
    if (signal.aborted) {
      reject(new DOMException('Upload paused.', 'AbortError'))
      return
    }
    xhr.open('PUT', `/api/admin/media/${encodeURIComponent(id)}?part=${part}`)
    xhr.timeout = 180000
    xhr.upload.onprogress = (event) => progress(event.loaded)
    xhr.onload = () => {
      finish()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else {
        let message = 'Could not upload this chunk. Please retry.'
        try {
          message = JSON.parse(xhr.responseText).error || message
        } catch {
          /* Keep the fallback for proxy errors. */
        }
        reject(new UploadError(message, xhr.status))
      }
    }
    xhr.onerror = xhr.ontimeout = () => {
      finish()
      reject(new UploadError('Connection interrupted. Resume this clip when you are online.'))
    }
    xhr.onabort = () => {
      finish()
      reject(new DOMException('Upload paused.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    xhr.send(blob)
  })
}
export async function retryMediaPart(send: () => Promise<void>, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      await send()
      return
    } catch (error) {
      if (
        signal.aborted ||
        !(error instanceof UploadError) ||
        (error.status > 0 && error.status < 500 && error.status !== 429) ||
        attempt >= 2
      )
        throw error
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer)
          reject(new DOMException('Upload paused.', 'AbortError'))
        }
        const timer = setTimeout(
          () => {
            signal.removeEventListener('abort', abort)
            resolve()
          },
          750 * 2 ** attempt,
        )
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
    }
  }
}

export async function uploadMissingMediaParts({
  file,
  received,
  signal,
  onProgress,
  send,
}: {
  file: Blob
  received: readonly number[]
  signal: AbortSignal
  onProgress: (bytes: number) => void
  send: (
    part: number,
    chunk: Blob,
    signal: AbortSignal,
    progress: (bytes: number) => void,
  ) => Promise<void>
}) {
  const saved = new Set(received)
  const missing = Array.from(
    { length: Math.ceil(file.size / MEDIA_PART_SIZE) },
    (_, index) => index + 1,
  ).filter((part) => !saved.has(part))
  let completed = [...saved].reduce((total, part) => total + partLength(file.size, part), 0)
  const inFlight = new Map<number, number>()
  const report = () =>
    onProgress(completed + [...inFlight.values()].reduce((total, bytes) => total + bytes, 0))
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  let next = 0
  let failed = false
  let failure: unknown
  async function worker() {
    while (next < missing.length && !controller.signal.aborted) {
      const part = missing[next++]
      const chunk = file.slice((part - 1) * MEDIA_PART_SIZE, part * MEDIA_PART_SIZE)
      try {
        await retryMediaPart(() => {
          inFlight.set(part, 0)
          report()
          return send(part, chunk, controller.signal, (bytes) => {
            inFlight.set(part, Math.max(0, Math.min(bytes, chunk.size)))
            report()
          })
        }, controller.signal)
        inFlight.delete(part)
        completed += chunk.size
        report()
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
          controller.abort(error)
        }
      }
    }
  }
  try {
    controller.signal.throwIfAborted()
    report()
    // Wait for all requests to stop before releasing this file's queue slot.
    await Promise.all(
      Array.from({ length: Math.min(MEDIA_PARALLEL_PARTS, missing.length) }, worker),
    )
    if (failed) throw failure
    controller.signal.throwIfAborted()
  } finally {
    signal.removeEventListener('abort', abort)
  }
}
