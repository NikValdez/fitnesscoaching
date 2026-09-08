# Steve Rossiter Coaching — Strength & Nutrition

A full-stack coaching website built with **TanStack Start**, React, TypeScript, **Neon PostgreSQL**, **Prisma ORM 7**, and **Better Auth**. The design follows the supplied landing-page mockup: Archivo and IBM Plex Mono typography, warm off-white, navy, fine borders, and numbered sections.

## Run locally

Requires Node.js 22.12 or later.

```sh
npm ci
cp .env.example .env # Only for a fresh checkout; preserve your existing .env.
# Add your database URL, direct database URL, and a random auth secret.
cp .env .dev.vars # Worker runtime secrets; both files are ignored by Git.
npm run db:generate
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000). This workspace already has a git-ignored `.env` containing the supplied Neon connection and a generated authentication secret. The initial migration has been applied to that database. Keep `.env` private; never prefix secrets with `VITE_`.

For a new environment, generate a secret with `openssl rand -hex 32`. `DATABASE_URL` is the Neon pooled endpoint used by the application. `DIRECT_URL` is the same connection with `-pooler` removed from its hostname, used by Prisma migrations. No reset or destructive schema synchronization is needed.

## Included functionality

- Responsive landing page with services, process, results, pricing, coach introduction, enquiry form, and expandable FAQs.
- Pricing links preserve the selected coaching plan in the URL and prefill the enquiry form.
- Email/password registration, login, logout, persistent sessions, and authenticated password changes that revoke other sessions.
- Google OAuth integration, automatically enabled when both Google credentials are configured.
- Protected client dashboard with workout creation/deletion, total training minutes, recent sessions, and history.
- Weekly check-ins for energy, sleep, optional weight, and reflections. Each UTC Monday–Sunday week has one updatable entry per user.
- Coaching enquiries saved in Neon. Authenticated requests are associated with the active account; anonymous requests remain unassociated.
- Validated server mutations, user-scoped database access, accessible native dialogs, reduced-motion support, and loading/error/success states.
- Separate **admin/coach** and **client** roles, checked on the server for every private operation.
- A client portal with assigned exercise programs, nutrition plans and targets, daily nutrition tracking, a monthly calendar, and coach feedback.
- A coach workspace with a searchable client roster, fitness/nutrition plan editors, client filters, a shared coaching calendar, editable scheduled tasks, completion controls, and check-in review.
- A three-step client questionnaire for service interests, per-service support tiers, contact preferences, and optional goals.
- A public `69 easy` PDF product page, guest Stripe Checkout integration, purchase confirmation, and payment-verified downloads.

Accounts begin with an empty training record. No fabricated workouts, subscriptions, payments, or appointments are created.

## Coach and client access

Sign-in opens `/portal`. Clients see only their own information; coaches are redirected to `/coach`. `/dashboard` retains workout logging, weekly reflections, and password settings for clients and is linked from their portal.

Clients without a completed questionnaire are directed to `/onboarding` before entering either private client area. This also covers returning clients with no answers and new Google accounts using the normal `/portal` callback. Admins bypass the questionnaire and go to `/coach`.

## Client questionnaire

Clients can select any combination of **Fitness coaching, Nutrition, Accountability, and Lifestyle**. Each selected service gets an independent tier: **Essential**, **Ongoing support**, or **In person** (the highest tier, in Los Angeles). These selections express interest; they do not create a subscription, change program assignments, set prices, or book sessions. Steve confirms the details separately.

The final step accepts one or more contact methods: voice call, text message, and email. Calls or texts require a phone number with an international country code; email uses the account's address. Optional notes capture goals, scheduling needs, or anything the client wants Steve to know. Selecting a contact method records a preference only; the form does not send messages or connect a phone/email provider.

Answers save together on the final submission. Back preserves the current choices; leaving before submission restores the last saved answers on the next visit. Clients can use **Edit preferences** on the portal overview to change their answers. Removed services and old phone details are removed from the saved preferences when applicable. The coach can see the questionnaire by opening a client in the roster or choosing a client filter; clients who have not yet answered are shown as pending.

`src/lib/intake-validation.ts` defines the shared options and validates unique services, tier selections, contact channels, phone format, and note length. `src/lib/intake.ts` reads and atomically upserts only the authenticated client's answers. It never accepts a target user ID or role. `ClientIntake` and `ServiceInterest` use `rossiter_client_intake` and `rossiter_service_interest`; their rows cascade when their owner is deleted. The fifth migration adds only these tables and their enums, preserving existing accounts and coaching records.

## Grant coach access

All existing and new users default to `CLIENT`. The `role` field is excluded from Better Auth registration/profile inputs (`input: false`). Role changes are made through a trusted local command, never a public endpoint:

```sh
# After the account has been registered:
npm run admin:grant -- nikcochran@gmail.com
```

This command requires an existing account and preserves its password. It grants the `ADMIN` role. Private server functions read the current role from the database, so access changes take effect on the next request without trusting stale client/session role claims. See [Better Auth’s server-owned field guidance](https://better-auth.com/docs/concepts/database).

The coach role can manage all clients of this single coaching practice. New client sign-ups appear in the roster automatically. Open a client to filter their programs, calendar, check-ins, and recent workout/nutrition records.

Fitness plans contain exercises, sets, reps/time, coaching cues, and program guidance. Nutrition plans contain written meal/habit guidance and optional calorie/macronutrient targets. Each plan is assigned to one client; edit or archive it from Programs. Archiving removes a plan from the current client list while preserving historical calendar entries and tracking.

The coach calendar supports workouts, check-ins, nutrition tasks, and private coach-only tasks (for example, preparing a fitness or nutrition plan). Events can link to a plan belonging to that client. Clients can complete/reopen only their own workout and nutrition items; coaches can complete any scheduled item. Coach-only tasks and notes are omitted from client responses. Marking an event complete does not create a workout log automatically.

Scheduled dates and wall-clock times use **America/Los_Angeles**. Coaches can choose **Schedule a check-in** from Check-ins, or select **Client check-in** when scheduling a calendar item, then choose weekly, every two weeks, or monthly repetition. Choose 2–52 check-ins, including the first (default 12); the form previews the last date. All occurrences are saved together immediately and appear on both calendars, including future months, without a scheduled job or a paid Cloudflare plan. Monthly series keep the original day where possible and use the last day of shorter months. Times stay at the selected Los Angeles wall-clock time across daylight-saving changes.

An existing one-time check-in can be made repeating through Edit. Its ID and completion state are retained; new occurrences begin uncompleted. Editing an occurrence within a series changes only that occurrence. **Remove this and future check-ins** removes uncompleted occurrences from the selected date onward, preserving completed items, earlier dates, and submitted reflections. The ordinary delete action removes only the selected occurrence. Only coaches can create, edit, complete, or remove scheduled check-ins; clients see their own dates. Scheduling does not create a submitted reflection or send a notification. There is no Google Calendar synchronization. Navigation loads the selected calendar month, and the client calendar also includes workout logs, nutrition entries, and weekly reflections. Existing weekly check-ins retain their UTC Monday–Sunday grouping; their calendar marker is the week-start date.

Clients can record calories, macros, water, and notes once per day; saving the same date updates it. Coaches can review check-ins with feedback visible in the client portal and training history. Editing a submitted check-in clears its prior review so the coach sees it as pending again. Schedule completion and check-in review are separate actions.

## PDF program and Stripe Checkout

The public `/program` page is linked from the home-page navigation and footer. **69 easy costs US$49 as a one-time purchase.** Buying does not require an account. The current three-page PDF is explicitly a sample edition; it contains a cover, placeholder overview, and blank notes worksheet. The page stays public, while the download endpoint verifies payment.

The Stripe integration is implemented, but no Stripe credentials are present in this workspace. To enable test checkout:

1. Add a Stripe test secret key as `STRIPE_SECRET_KEY` in the private `.env` file. Keep `APP_URL=http://localhost:3000` locally. No publishable key or Stripe Price ID is needed; the server creates inline pricing from `src/lib/product.ts`.
2. Forward Stripe test webhooks with the Stripe CLI: `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/stripe/webhook`.
3. Set the listener's signing secret as `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.
4. Open `/program`, choose test checkout, and use Stripe's test card `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Finish checkout and download from `/purchase/success`. Test mode collects no real payment.

`POST /api/checkout` uses the server's price/currency, checks request origin, creates a Checkout Session, and saves its price snapshot in `rossiter_purchase`. The webhook verifies Stripe's signature against the unmodified body. Both the webhook and the return page retrieve the session from Stripe and validate its product metadata, payment mode, amount, currency, and live/test mode against the stored purchase. A completed, paid session records fulfillment idempotently. The download endpoint repeats that verification. Unknown session IDs and unpaid purchases cannot download the file. This follows [Stripe's fulfillment guidance](https://docs.stripe.com/checkout/fulfillment) and [webhook signature guidance](https://docs.stripe.com/webhooks/signature).

The PDF is imported into the server bundle, not published as an unrestricted static file. The success/download URLs contain a private bearer session identifier: save the confirmation link for repeat access and do not share it. Responses disable caching and referrer forwarding. No purchase email or automatic refund handling is implemented; customers receive the download on the confirmation page. Purchase records retain the payment email for support.

Before real sales, replace `output/pdf/69-easy-sample.pdf` with Steve's finished PDF (or update the import in `src/lib/commerce.server.ts`), set `pdfProgram.isSample` to `false`, and review the page copy. The sample is deliberately blocked from live checkout. Configure a live Stripe key, the HTTPS `APP_URL`, and a matching live webhook endpoint/signing secret; rebuild and deploy. Pricing lives in `src/lib/product.ts`, while existing purchases retain their original price snapshots. Tax collection is not enabled in this integration.

The placeholder can be rebuilt with `scripts/create-sample-program.py` using Python with ReportLab. Its final rendered pages have been visually reviewed. Automated payment tests use Stripe SDK mocks and real signature verification; a Stripe-hosted checkout round trip still needs the account's test credentials.

## Google authentication

Google OAuth is configured in the dedicated `steve-rossiter-coaching` Google Cloud project. The web client is named **Steve Rossiter Coaching — Web**. Local credentials are stored in ignored `.env` and `.dev.vars` files. Production credentials are encrypted Cloudflare Worker secrets. The consent screen uses Steve Rossiter Coaching, with `nikcochran@gmail.com` as the support/developer contact. The app requests only `openid`, `email`, and `profile`.

Existing password accounts can open **Account → Connect Google** while signed in. Google must return a verified email matching that account. This explicitly links the provider while retaining the password, user ID, coaching records, and role. Better Auth's default protection against automatically linking an unverified local email remains enabled; an initial Google sign-in for such an account explains how to connect it. New Google users enter the normal client questionnaire. Authentication errors return to the app with a readable message.

For a new environment:

1. Create a **Web application** OAuth client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials).
2. Configure `http://localhost:3000` as an authorized JavaScript origin.
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` and `.dev.vars`, then restart the server.
5. For production, use the HTTPS application origin in `BETTER_AUTH_URL`, Google’s origin list, and its callback URI. Add test users to the OAuth consent screen if the Google app is in testing mode.

The production origin is `https://steve-rossiter-coaching.nikcochran.workers.dev`; its authorized callback is `/api/auth/callback/google`. The Google consent app is published in production mode, and a live Google sign-in to the coach account was verified on September 7, 2026. The original localhost:3000 origin and callback remain authorized. The public privacy notice is `/privacy`. When adding a custom domain, update both origin secrets, the Google origin and callback allowlists, and the Google branding links and authorized domain. See [Better Auth’s Google integration](https://better-auth.com/docs/authentication/google) and [account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking).

## Database and server architecture

`prisma/schema.prisma` defines Better Auth’s User, Session, Account, and Verification models, plus Workout, CheckIn, Enquiry, Program, ProgramExercise, ScheduleEvent, NutritionLog, Purchase, ClientIntake, and ServiceInterest. Tables and enums use a `rossiter_` prefix. `prisma/migrations` contains the original migration, the data-preserving rename, the additive roles/coaching-portal migration, the PDF-purchases migration, and the client-questionnaire migration.

`src/lib/db.server.ts` creates the Prisma client with the Neon driver adapter. `src/lib/auth.server.ts` owns authentication configuration, and `src/routes/api/auth/$.ts` mounts the Better Auth handler. `src/lib/functions.ts` contains TanStack server functions; private reads and writes derive the user from the request’s session rather than trusting a supplied user ID. `src/lib/validation.ts` supplies shared Zod input schemas.

`src/lib/access.server.ts` centralizes live account/role guards. `src/lib/coaching.ts` implements portal reads and coach/client mutations. Shared Zod schemas in `src/lib/coaching-validation.ts` validate plan dates, exercises, scheduling times, and nutrition logs. Client mutations include ownership predicates; only coach mutations accept a target client ID, which must belong to a client account. No frontend visibility check is used as the authorization boundary.

For enquiries, the application records a request only; it does not book a calendar slot or send an email. View and follow up on requests using `npm run db:studio` and the Enquiry model. The form has a honeypot and limits requests to three per email per hour. Better Auth uses Cloudflare's `cf-connecting-ip` header for authentication throttling. Its in-memory rate limits are local to each Worker isolate; use a shared store or Cloudflare rate limiting if stronger global limits are needed.

Email verification, forgotten-password email delivery, newsletters, automated invitations, chat messaging, and external scheduling-service integrations are not configured. Email/password login works without an email delivery provider. Coaching plans and schedules are stored and managed directly in this application. Stripe configuration for PDF purchases is described above.

## Content and assets

The stated credentials, prices, testimonials, and marketing statistics are sample content from the supplied mockup. Confirm or replace them before public launch. The hero is an AI-generated portrait based on the user-provided reference photos of Steve Rossiter. The service-card gym scene is separate illustrative AI imagery. Asset provenance and generation prompts are in [docs/assets.md](docs/assets.md).

## Checks

```sh
npm run typecheck
npm test
npm run build
npm audit

# With the app running and .env pointing to a test database:
npx playwright install chromium
npm run test:e2e
```

The browser suite checks landing-page interactions, enquiry persistence, mobile overflow/navigation, role routing, signup/login/logout, questionnaire validation and editing, coach visibility of preferences, workout persistence/deletion, check-in upserts/review, program assignment, calendar completion, nutrition tracking, and account isolation. Security checks replay coach and questionnaire mutations without the required access, attempt cross-client completion and role escalation, and verify immediate role revocation. Tests create unique `rossiter-test-…@example.com`, `rossiter-portal-test-…@example.com`, and `rossiter-intake-test-…@example.com` accounts, then remove only those exact test identities and their records. Prefer a dedicated Neon test branch for future runs. Screenshots and traces are written to ignored `test-results/`.

## Production build

Production currently uses **Cloudflare Workers Free**. Reusing Better Auth configuration within each Worker isolate removes repeated setup while preserving request-scoped database connections and the existing password hashing settings. After this change, all eight live browser tests passed on September 7, 2026, and the captured Worker tail contained 145 successful request outcomes with no CPU-limit errors. Earlier runs exceeded the Free plan's CPU allowance; this successful run does not guarantee that every future request will fit its limits. Keep password hashing settings intact if resource limits recur.

```sh
npm ci
npm run db:migrate
npm run build
npm run deploy
```

The Cloudflare Vite plugin produces the Worker in `dist/server` and public assets in `dist/client`. `npm run preview` serves the built Worker locally on port 3001; `npm start` uses port 3000. Local runtime variables come from `.dev.vars`; Prisma CLI scripts read `.env`. Match `APP_URL` and `BETTER_AUTH_URL` to the local port you are using. The build generates both the Cloudflare Prisma client and a separate Node client for administrative scripts and test fixtures. Database clients are created within the TanStack request middleware and disconnected after each request, so Neon WebSocket connections are never reused across Worker requests.

Production runs in the `steve-rossiter-coaching` Worker in Cloudflare account `41526feba51ca99b6c0005c25ebad09b`, at [the temporary production address](https://steve-rossiter-coaching.nikcochran.workers.dev). Its runtime secrets are `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. An ignored `.env.cloudflare.json` file contains the local backup; never commit or publish it. The production auth secret is separate from local development.

The lockfile pins the tested dependency graph. Database migrations are applied with `npm run db:migrate` using the private direct Neon connection; client generation and application builds do not require database credentials. Stripe checkout remains unavailable until Stripe credentials and the final program PDF are configured.

Cloudflare Workers Builds is connected to `NikValdez/fitnesscoaching`, with `main` as the production branch and other branch builds disabled. Pushes to `main` run `npm run build && npm run typecheck && npm test`, followed by `npx wrangler deploy`. Cloudflare manages the deployment token, and runtime secrets remain encrypted on the Worker. Builds do not run database migrations: apply any required migrations before deploying code that depends on them.

Framework references: [TanStack on Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) and [Prisma with Neon](https://www.prisma.io/docs/orm/v6/overview/databases/neon).
