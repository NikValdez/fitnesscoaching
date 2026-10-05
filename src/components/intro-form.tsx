import { useState } from 'react'
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react'
import { requestIntro } from '../lib/functions'
import { enquirySchema } from '../lib/validation'

export function IntroForm({
  interest,
  onInterestChange,
}: {
  interest: string
  onInterestChange: (interest: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle')
  const [error, setError] = useState('')
  const [notificationSent, setNotificationSent] = useState(true)
  return status === 'success' ? (
    <div className="intro-form form-success" role="status">
      <span className="success-icon">
        <Check size={26} />
      </span>
      <p className="eyebrow">Request received</p>
      <h3>You’ve taken the first step.</h3>
      {notificationSent ? (
        <p>
          Your message has been sent. Steve will get back to you by email about your coaching
          options.
        </p>
      ) : (
        <p role="alert">
          Your message is saved, but we couldn’t send the email notification. You can also reach
          Steve at <a href="mailto:info@steverossiter.com">info@steverossiter.com</a>.
        </p>
      )}
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
          const result = await requestIntro({ data: parsed.data })
          setNotificationSent(result.notificationSent)
          setStatus('success')
          form.reset()
          onInterestChange('')
        } catch {
          setError('Your request wasn’t saved. Please try again shortly.')
          setStatus('idle')
        }
      }}
    >
      <p className="eyebrow">Contact</p>
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
      <fieldset className="coaching-interest">
        <legend>What kind of coaching?</legend>
        <div className="coaching-choices">
          {[
            { value: 'Online coaching', label: 'Online', detail: 'From anywhere' },
            { value: 'In-person coaching', label: 'In person', detail: 'Los Angeles' },
          ].map((choice) => (
            <label className="coaching-choice" key={choice.value}>
              <input
                type="radio"
                name="interest"
                value={choice.value}
                aria-label={choice.value}
                checked={interest === choice.value}
                onChange={(event) => onInterestChange(event.target.value)}
                required
              />
              <span className="coaching-choice-copy">
                <span>{choice.label}</span>
                <small>{choice.detail}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span className="intro-notes-heading">
          <span>Tell me about yourself and your goals.</span>
          <span className="optional">Optional</span>
        </span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="The more detail the better!"
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
            Sending message <LoaderCircle className="spin" size={16} />
          </>
        ) : (
          <>
            Send message <ArrowUpRight size={17} />
          </>
        )}
      </button>
    </form>
  )
}
