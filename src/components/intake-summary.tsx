import { Link } from '@tanstack/react-router'
import { Pencil, MessageCircle } from 'lucide-react'
import {
  serviceOptions,
  tierOptions,
  channelOptions,
  type CoachingService,
  type CoachingTier,
  type ContactChannel,
} from '../lib/intake-validation'

type Intake = {
  interests: { service: CoachingService; tier: CoachingTier }[]
  channels: ContactChannel[]
  phone: string | null
  goals: string
}

export function IntakeSummary({
  intake,
  editable = false,
  email,
}: {
  intake: Intake | null
  editable?: boolean
  email: string
}) {
  return (
    <section className="workspace-panel preferences-panel">
      <div className="workspace-section-heading">
        <div>
          <span className="eyebrow">A plan starts with a conversation</span>
          <h2>{editable ? 'Your coaching preferences' : 'Client coaching preferences'}</h2>
        </div>
        {editable && (
          <Link to="/onboarding" className="text-link">
            <Pencil size={14} /> Edit preferences
          </Link>
        )}
      </div>
      {intake ? (
        <>
          <div className="preferences-services">
            {serviceOptions
              .filter((s) => intake.interests.some((i) => i.service === s.id))
              .map((service) => (
                <div key={service.id}>
                  <strong>{service.label}</strong>
                  <span>
                    {
                      tierOptions.find(
                        (tier) =>
                          tier.id === intake.interests.find((i) => i.service === service.id)?.tier,
                      )?.label
                    }
                  </span>
                </div>
              ))}
          </div>
          <div className="preferences-contact">
            <MessageCircle size={18} />
            <div>
              <span className="eyebrow">Preferred contact</span>
              <p>
                {channelOptions
                  .filter((c) => intake.channels.includes(c.id))
                  .map((c) => c.label)
                  .join(' · ')}
              </p>
              {intake.phone && <p>{intake.phone}</p>}
              {intake.channels.includes('EMAIL') && <p>{email}</p>}
            </div>
          </div>
          {intake.goals && (
            <div className="preferences-goals">
              <span className="eyebrow">{editable ? 'What you shared' : 'Client notes'}</span>
              <p>{intake.goals}</p>
            </div>
          )}
          <p className="form-note">
            Service and contact preferences. Pricing and availability are confirmed with Steve.
          </p>
        </>
      ) : (
        <p className="form-note">
          This client hasn’t completed their questionnaire yet. They’ll be prompted when they open
          their portal.
        </p>
      )}
    </section>
  )
}
