import { Link } from '@tanstack/react-router'

export function BrandMark() {
  return (
    <img
      className="brand-mark"
      src="/images/sr-monogram-v2.png"
      width="40"
      height="40"
      alt=""
      aria-hidden="true"
    />
  )
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Steve Rossiter Coaching home">
      <BrandMark />
      <span className="brand-name">
        Steve Rossiter<span className="brand-coaching">Coaching</span>
      </span>
    </Link>
  )
}
