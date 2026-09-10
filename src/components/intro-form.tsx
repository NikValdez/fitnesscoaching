import { useState } from 'react'
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react'
import { requestIntro } from '../lib/functions'
import { enquirySchema } from '../lib/validation'

export function IntroForm() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle')
  const [error, setError] = useState('')
  return status === 'success' ? (
    <div className="intro-form form-success" role="status">
      <span className="success-icon">
        <Check size={26} />
      </span>
      <p className="eyebrow">Request received</p>
      <h3>You’ve taken the first step.</h3>
      <p>
        Your message is saved. Steve will get back to you by email about coaching in Los Angeles.
      </p>
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
      <p className="eyebrow">Contact Steve about coaching in LA</p>
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
      <input type="hidden" name="interest" value="In-person coaching" />
      <label>
        Anything I should know? <span className="optional">Optional</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Your goals, where you’re based in LA, and your availability…"
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
            Send message <ArrowUpRight size={17} />
          </>
        )}
      </button>
      <p className="form-note">For in-person coaching in Los Angeles. Steve will reply by email.</p>
    </form>
  )
}
