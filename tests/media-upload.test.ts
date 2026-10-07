import { describe, expect, it, vi } from 'vitest'
import { MEDIA_PART_SIZE } from '../src/lib/media-validation'
import { uploadMissingMediaParts, UploadError } from '../src/lib/media-upload'

describe('parallel resumable uploads', () => {
  it('fills two slots, skips saved parts, and aggregates progress across out-of-order completions', async () => {
    const file = new Blob([new Uint8Array(MEDIA_PART_SIZE * 3 + 7)])
    const active = new Map<number, { done: () => void; progress: (bytes: number) => void }>()
    const sizes: [number, number][] = []
    const progress = vi.fn()
    let peak = 0
    const pending = uploadMissingMediaParts({
      file,
      received: [1],
      signal: new AbortController().signal,
      onProgress: progress,
      send: (part, chunk, _signal, update) =>
        new Promise<void>((resolve) => {
          sizes.push([part, chunk.size])
          active.set(part, {
            done: () => {
              active.delete(part)
              resolve()
            },
            progress: update,
          })
          peak = Math.max(peak, active.size)
        }),
    })
    expect([...active.keys()]).toEqual([2, 3])
    active.get(2)!.progress(100)
    active.get(3)!.progress(200)
    expect(progress).toHaveBeenLastCalledWith(MEDIA_PART_SIZE + 300)
    active.get(3)!.done()
    await vi.waitFor(() => expect(active.has(4)).toBe(true))
    expect(progress).toHaveBeenLastCalledWith(MEDIA_PART_SIZE * 2 + 100)
    active.get(4)!.done()
    active.get(2)!.done()
    await pending
    expect(peak).toBe(2)
    expect(sizes).toEqual([
      [2, MEDIA_PART_SIZE],
      [3, MEDIA_PART_SIZE],
      [4, 7],
    ])
    expect(progress).toHaveBeenLastCalledWith(file.size)
  })
  it('cancels every in-flight part when paused, without starting queued parts', async () => {
    const controller = new AbortController()
    const stopped: number[] = []
    const send = vi.fn(
      (part: number, _chunk: Blob, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              stopped.push(part)
              reject(signal.reason)
            },
            { once: true },
          )
        }),
    )
    const pending = uploadMissingMediaParts({
      file: new Blob([new Uint8Array(MEDIA_PART_SIZE * 3)]),
      received: [],
      signal: controller.signal,
      onProgress: () => {},
      send,
    })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(stopped).toEqual([1, 2])
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('stops sibling requests after a permanent failure and preserves the original error', async () => {
    const stopped: number[] = []
    const pending = uploadMissingMediaParts({
      file: new Blob([new Uint8Array(MEDIA_PART_SIZE * 3)]),
      received: [],
      signal: new AbortController().signal,
      onProgress: () => {},
      send: (part, _chunk, signal) =>
        part === 1
          ? Promise.reject(new UploadError('Admin access revoked', 403))
          : new Promise<void>((_resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  stopped.push(part)
                  reject(signal.reason)
                },
                { once: true },
              )
            }),
    })
    await expect(pending).rejects.toThrow('Admin access revoked')
    expect(stopped).toEqual([2])
  })
  it('does not retransmit a fully saved file or start an already paused upload', async () => {
    const send = vi.fn()
    const onProgress = vi.fn()
    const file = new Blob(['clip'])
    await uploadMissingMediaParts({
      file,
      received: [1],
      signal: new AbortController().signal,
      onProgress,
      send,
    })
    expect(send).not.toHaveBeenCalled()
    expect(onProgress).toHaveBeenLastCalledWith(file.size)
    const controller = new AbortController()
    controller.abort()
    await expect(
      uploadMissingMediaParts({ file, received: [], signal: controller.signal, onProgress, send }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(send).not.toHaveBeenCalled()
  })
})
