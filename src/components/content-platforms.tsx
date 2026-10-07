import { SiInstagram, SiTiktok, SiFacebook, SiYoutube } from 'react-icons/si'
import { FaTwitter, FaLinkedinIn } from 'react-icons/fa6'
import { Newspaper } from 'lucide-react'
import { contentPlatforms, type ContentPlatform } from '../lib/content-validation'

const icons = {
  INSTAGRAM: SiInstagram,
  TIKTOK: SiTiktok,
  FACEBOOK: SiFacebook,
  YOUTUBE: SiYoutube,
  TWITTER: FaTwitter,
  LINKEDIN: FaLinkedinIn,
  BLOG: Newspaper,
}

export function PlatformTags({ platforms }: { platforms: string[] }) {
  if (!platforms.length) return null
  return (
    <ul className="content-platform-tags" aria-label="Platforms">
      {contentPlatforms
        .filter((platform) => platforms.includes(platform.id))
        .map((platform) => {
          const Icon = icons[platform.id]
          return (
            <li
              key={platform.id}
              className={`platform-icon platform-${platform.id.toLowerCase()}`}
              title={platform.label}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="sr-only">{platform.label}</span>
            </li>
          )
        })}
    </ul>
  )
}

export function PlatformPicker({
  value,
  onChange,
}: {
  value: ContentPlatform[]
  onChange: (value: ContentPlatform[]) => void
}) {
  return (
    <fieldset className="platform-picker">
      <legend>
        Platforms <span>Choose any that fit.</span>
      </legend>
      <div className="platform-options">
        {contentPlatforms.map((platform) => {
          const Icon = icons[platform.id]
          const selected = value.includes(platform.id)
          return (
            <button
              key={platform.id}
              type="button"
              aria-pressed={selected}
              className={`platform-option platform-${platform.id.toLowerCase()}`}
              onClick={() =>
                onChange(
                  selected ? value.filter((id) => id !== platform.id) : [...value, platform.id],
                )
              }
            >
              <Icon size={17} aria-hidden="true" />
              {platform.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
