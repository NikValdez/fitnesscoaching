import { createFileRoute } from '@tanstack/react-router'
import { ShopLayout, shopLinks } from '../components/shop-layout'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    links: shopLinks,
    meta: [{ title: 'Privacy policy — Steve Rossiter Coaching' }],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <ShopLayout>
      <article className="privacy-page container">
        <p className="eyebrow">Updated September 7, 2026</p>
        <h1>Privacy policy</h1>
        <p>This notice explains how the Steve Rossiter Coaching web app handles information when you browse, create an account, or use your coaching portal.</p>

        <h2>Information you provide</h2>
        <p>The app stores your name, email address, and account details. Passwords are stored as hashes. Your service choices, communication preferences, optional phone number, goals, workouts, nutrition entries, check-ins, and schedules are saved so your coach can personalize and manage your coaching. Enquiry forms store the contact details and message you submit.</p>

        <h2>Google sign-in</h2>
        <p>If you choose Google sign-in, the app receives your Google account identifier, name, email address, email verification status, and profile image when provided. It stores the account connection and authentication tokens needed to support sign-in. The requested permissions are limited to basic identity, email, and profile information. The app does not request access to your Gmail, Google Drive, or Google Calendar.</p>
        <p>You can review or revoke the Google connection in your <a href="https://myaccount.google.com/connections" rel="noreferrer" target="_blank">Google Account settings</a>. Revoking Google access does not by itself delete your coaching account or records.</p>

        <h2>How information is used and accessed</h2>
        <p>Information is used to authenticate your account, provide your portal, create and review coaching plans, track progress, respond to enquiries, and maintain the service. Coach accounts can access client preferences and coaching records. Clients can access their own private records. The app does not include advertising trackers or use your coaching entries to generate AI programs.</p>

        <h2>Service providers and payments</h2>
        <p>Cloudflare hosts the app and processes requests. Neon stores the account and coaching database. Google provides optional sign-in and the site's web fonts. These providers process information needed to deliver their services and may process it outside your country.</p>
        <p>When Stripe checkout is available and you choose to purchase a program, Stripe handles the payment details. The app stores the checkout identifier, email when supplied, amount, currency, and payment status to verify access to downloads. Card numbers are not stored in the app's database.</p>

        <h2>Cookies and technical information</h2>
        <p>Essential cookies maintain your signed-in session and protect the sign-in process. Requests may include IP addresses, browser details, and timestamps. Hosting and error logs help operate the service and investigate problems; IP information is also used to limit abusive authentication requests.</p>

        <h2>Your information and choices</h2>
        <p>You can update coaching preferences and supported tracking entries in your portal. Account and coaching records remain stored until removed; signing out does not delete them. To request access, correction, or deletion, or ask about retention and privacy, contact <a href="mailto:nikcochran@gmail.com">nikcochran@gmail.com</a>. Some payment or security records may need separate handling, and removal from active records may not immediately remove copies held in provider backups.</p>
      </article>
    </ShopLayout>
  )
}
