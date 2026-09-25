import { Link } from '@tanstack/react-router'

export function BrandMark() {
  return (
    <img
      className="brand-mark"
      src="/images/sr-monogram-v3.png"
      width="40"
      height="40"
      alt=""
      aria-hidden="true"
    />
  )
}

export function Brand({ tagline = false }: { tagline?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Steve Rossiter Coaching home">
      <BrandMark />
      <span className="brand-name">
        Steve Rossiter
        {tagline ? (
          <span className="brand-tagline">Helping you feel great.</span>
        ) : (
          <span className="brand-coaching">Coaching</span>
        )}
      </span>
    </Link>
  )
}
