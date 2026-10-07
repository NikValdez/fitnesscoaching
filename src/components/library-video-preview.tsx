import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, LoaderCircle, VideoOff } from 'lucide-react'
import { getLibraryPreview } from '../lib/library'

export function LibraryVideoPreview({
  entry,
}: {
  entry: { id: string; url: string; title: string; platform: string }
}) {
  const [source, setSource] = useState<{ src: string; url: string } | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'slow' | 'error'>('loading')
  const [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const label = entry.platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'

  useEffect(() => {
    let disposed = false
    const timer = setTimeout(() => {
      if (!disposed) setPhase((current) => (current === 'loading' ? 'slow' : current))
    }, 15000)
    void getLibraryPreview({ data: { id: entry.id } })
      .then((result) => {
        if (!disposed) setSource(result)
      })
      .catch((cause) => {
        if (disposed) return
        setPhase('error')
        setError(cause instanceof Error ? cause.message : 'This preview is unavailable.')
      })
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      if (event.origin === 'https://www.instagram.com') {
        try {
          const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          if (message?.type === 'MOUNTED')
            setPhase((current) => (current === 'error' ? current : 'ready'))
        } catch {
          /* Ignore messages outside Instagram's embed protocol. */
        }
        return
      }
      if (
        event.origin !== 'https://www.tiktok.com' ||
        !event.data ||
        typeof event.data !== 'object' ||
        event.data['x-tiktok-player'] !== true
      )
        return
      if (event.data.type === 'onPlayerReady')
        setPhase((current) => (current === 'error' ? current : 'ready'))
      if (event.data.type === 'onPlayerError' || event.data.type === 'onError') {
        setPhase('error')
        setError('TikTok cannot play this video here. Open the original video to watch it.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      disposed = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [entry.id])

  return (
    <div className="library-video-preview">
      <p className="library-preview-title">{entry.title}</p>
      <div className="library-preview-frame" aria-busy={phase === 'loading'}>
        {source && phase !== 'error' && (
          <iframe
            ref={frame}
            src={source.src}
            title={`${label} video preview: ${entry.title}`}
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setPhase((current) => (current === 'error' ? current : 'ready'))}
            onError={() => {
              setPhase('error')
              setError('The preview could not load. Open the original video to watch it.')
            }}
          />
        )}
        {phase === 'loading' && (
          <div className="library-preview-placeholder" role="status">
            <LoaderCircle size={24} className="spin" aria-hidden="true" />
            Loading video preview…
          </div>
        )}
        {phase === 'error' && (
          <div className="library-preview-placeholder" role="status">
            <VideoOff size={28} strokeWidth={1.5} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
      </div>
      <p className="library-preview-help">
        {phase === 'slow'
          ? 'The player is taking longer to load. You can open the original video below.'
          : 'If the player is unavailable, open the original video below.'}
      </p>
      <a
        className="button button-outline library-preview-original"
        href={source?.url ?? entry.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on {label}
        <ArrowUpRight size={16} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  )
}
