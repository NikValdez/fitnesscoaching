import { useState } from 'react'
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react'
import { requestIntro } from '../lib/functions'
import { interests, enquirySchema } from '../lib/validation'

export function IntroForm({
  interest,
  onInterestChange,
}: {
  interest: string
  onInterestChange: (value: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle')
  const [error, setError] = useState('')
  return status === 'success' ? (
    <div className="intro-form form-success" role="status">
      <span className="success-icon">
        <Check size={26} />
      </span>
      <p className="eyebrow">Request received</p>
      <h3>You’ve taken the first step.</h3>
      <p>Your intro-call request is saved. A time still needs to be arranged with the coach.</p>
      <button className="text-link" onClick={() => setStatus('idle')}>
        Send another request <ArrowUpRight size={16} />
      </button>
    </div>
  ) : (
    <form
      className="intro-form"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const parsed = enquirySchema.safeParse(Object.fromEntries(new FormData(form)))
        if (!parsed.success) {
          setError(parsed.error.issues[0].message)
          return
        }
        setStatus('saving')
        setError('')
        try {
          await requestIntro({ data: parsed.data })
          setStatus('success')
          form.reset()
        } catch {
          setError('Your request wasn’t saved. Please try again shortly.')
          setStatus('idle')
        }
      }}
    >
      <p className="eyebrow">Let’s find your starting point</p>
      <div className="field-row">
        <label>
          Name
          <input
            name="name"
            autoComplete="name"
            placeholder="Your name"
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            required
            maxLength={254}
          />
        </label>
      </div>
      <label>
        I’m interested in
        <select
          name="interest"
          value={interest}
          onChange={(event) => onInterestChange(event.target.value)}
        >
          {interests.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Anything I should know? <span className="optional">Optional</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Your goals, schedule, or past training…"
        />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={status === 'saving'}>
        {status === 'saving' ? (
          <>
            Saving request <LoaderCircle className="spin" size={16} />
          </>
        ) : (
          <>
            Request intro call <ArrowUpRight size={17} />
          </>
        )}
      </button>
      <p className="form-note">A conversation, not a commitment. No mailing list.</p>
    </form>
  )
}
