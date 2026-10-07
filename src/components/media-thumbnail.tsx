import { useEffect, useRef, useState } from 'react'
import { captureVideoStill } from '../lib/media-thumbnail'

export function MediaThumbnail({ id }: { id: string }) {
  const element = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '200px' },
    )
    if (element.current) observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    const { signal } = controller
    const file = `/api/admin/media/${encodeURIComponent(id)}`
    let objectUrl: string | undefined
    async function load() {
      const response = await fetch(`${file}?thumbnail`, { signal, credentials: 'same-origin' })
      const generated = response.status === 404
      if (!response.ok && !generated) return
      const blob = generated ? await captureVideoStill(file, signal) : await response.blob()
      if (signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
      if (generated) {
        await fetch(`${file}?thumbnail`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
          signal,
        })
      }
    }
    // Unsupported codecs retain the card's play/download controls. A thumbnail
    // failure never changes a completed upload or blocks the media library.
    void load().catch(() => {})
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, visible])
  return (
    <span
      ref={element}
      className="media-thumbnail"
      aria-hidden="true"
      style={src ? { backgroundImage: `url(${src})` } : undefined}
    >
      {src && <img src={src} alt="" decoding="async" onError={() => setSrc(undefined)} />}
    </span>
  )
}
