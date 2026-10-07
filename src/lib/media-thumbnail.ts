import { MEDIA_THUMBNAIL_MAX_BYTES } from './media-validation'

// Decode at most two originals at once, and release each video as soon as its
// still is captured. Cards subsequently load only the small private JPEG.
const slots: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()]
let nextSlot = 0
export function captureVideoStill(src: string, signal: AbortSignal): Promise<Blob> {
  const index = nextSlot++ % slots.length
  const result = slots[index].then(() => capture(src, signal))
  slots[index] = result.catch(() => {})
  return result
}
function capture(src: string, signal: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    let finished = false
    let capturing = false
    let target = 0
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null
      video.removeAttribute('src')
      video.load()
    }
    const fail = (error: unknown) => {
      if (finished) return
      finished = true
      cleanup()
      reject(error)
    }
    const abort = () => fail(signal.reason)
    const timer = setTimeout(() => fail(new Error('Video still unavailable.')), 25000)
    signal.addEventListener('abort', abort, { once: true })
    const draw = async () => {
      if (
        finished ||
        capturing ||
        video.seeking ||
        video.readyState < 2 ||
        video.currentTime < target
      )
        return
      capturing = true
      try {
        if (!video.videoWidth || !video.videoHeight) throw new Error('No video frame.')
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 640 / video.videoWidth, 640 / video.videoHeight)
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Video still unavailable.')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        for (const quality of [0.82, 0.65, 0.45]) {
          const blob = await new Promise<Blob | null>((done) =>
            canvas.toBlob(done, 'image/jpeg', quality),
          )
          if (finished) return
          if (blob && blob.size <= MEDIA_THUMBNAIL_MAX_BYTES) {
            finished = true
            cleanup()
            resolve(blob)
            return
          }
        }
        throw new Error('Video still unavailable.')
      } catch (error) {
        fail(error)
      }
    }
    video.onloadedmetadata = () => {
      // Step past common black opening frames, without seeking beyond short clips.
      try {
        target = Number.isFinite(video.duration) ? Math.min(1, video.duration / 10) : 0
        video.currentTime = target
        void draw()
      } catch (error) {
        fail(error)
      }
    }
    video.onseeked = video.onloadeddata = () => void draw()
    video.onerror = () => fail(new Error('This browser cannot decode a still from this video.'))
    video.src = src
  })
}
