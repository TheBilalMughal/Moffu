# Project Status

## Current milestone
PHASE 6 — Billing & Subscription (schema + UI + usage tracking COMPLETE; Stripe integration + server-side limit enforcement pending)

## Completed

### Phase 1 — Foundation
- Monorepo initialized: pnpm workspaces + Turborepo, root `package.json`, `tsconfig.base.json`, `.gitignore`, `.prettierrc`
- `packages/config`: shared ESLint and TypeScript configs (base/react/next)
- `packages/types`: shared TypeScript types — auth, organization, RBAC, common primitives
- `packages/ui`: design tokens (#0D4C3C brand palette), Button/Input/Label/Alert primitives, `cn()` utility
- `apps/web`: Next.js 14 marketing site scaffold, Tailwind, globals.css, homepage with hero/features/CTA sections
- `apps/portal`: Vite/React customer portal — full auth + dashboard shell
- `apps/admin`: Vite/React admin portal scaffold, AdminLoginPage, AdminAuthGuard
- `supabase/`: 5 migrations (extensions, regions/currencies, user profiles/orgs/members, RBAC, audit/security events)
- `pnpm typecheck` — all 6 packages pass

### Phase 2 — Marketing Site + Portal Auth + Dashboard UI
**Marketing site (`apps/web`):**
- Homepage — hero, features, testimonials, CTA sections
- SiteNav — Login/Get Started buttons wired to portal (`PORTAL_URL` env var, server-side only)
- Responsive layout, `#0D4C3C` brand color

**Portal Auth (`apps/portal/src/features/auth`):**
- Split-layout `AuthLayout` — left panel (dark green gradient, tagline), right panel (form)
- `LoginPage` — email/password with eye toggle, remember me, forgot password link, Google OAuth stub (disabled)
- `SignupPage` — full name, email, password + confirm, mismatch validation, success/resend state
- `ForgotPasswordPage` — email field, success state with back-to-login
- `h-screen overflow-hidden` (no scroll), animated page transitions (`auth-in` keyframe on pathname key)
- Back-to-website link with left arrow; left panel logo clickable — both go to `VITE_WEB_URL`
- `apps/portal/vercel.json` — SPA catch-all rewrite for Vercel

**Portal Dashboard (`apps/portal/src/features/dashboard`):**
- `DashboardLayout` — sidebar (logo + nav + profile at bottom) + full-width content area; **no topbar**
- Sidebar profile: avatar initials + full name + email, dropdown opens upward (Settings + Sign out)
- Full name fix: reads both `display_name` and `full_name` from `user_metadata`
- `OverviewPage` — stat cards (mock "—"), empty state CTA
- `ReviewsPage` — filter tabs (All/Pending/Draft Ready/Replied), review cards, Generate AI Draft, editable textarea, Approve & Publish / Discard
- `SettingsPage` — account info, Google Business Profile stub (Coming soon), Billing stub

**Deployments:**
- Marketing site → `moffu.vercel.app` (project: moffu)
- Portal → `appmoffu.vercel.app` (project: portalmoffu)
- `PORTAL_URL` set in web's Vercel env (server-side); `VITE_WEB_URL` needs to be set in portalmoffu Vercel env

## Phase 3 — Brand Brain Setup UI
**COMPLETE** ✅

`apps/portal/src/features/brand-brain/BrandBrainPage.tsx`
- Business info (name, type, short description)
- Tone presets (Professional / Friendly / Formal / Casual) — radio card selection
- Reply settings — length (Short/Medium/Long), address by name toggle, emoji toggle
- Language — primary language dropdown, reviewer language behaviour radio
- Negative review handling — Manual / Cautious draft / Normal
- Prohibited phrases — tag input with add/remove
- Example reply textarea (style reference)
- Save button with loading + success state
- Route `/brand-brain`, sidebar nav item (sliders icon)

**Supabase migrations applied to project `kgttncfkzdrgswfkkdji`:**
- Migration 001 (extensions + ref_ids) ✅
- Migration 002 (regions/countries/currencies) ✅
- Migration 003 (profiles/organizations/members) ✅
- Migration 004 (RBAC — permissions, role_permissions, user_permission_overrides, platform_members) ✅
- Migration 005 (audit_events + security_events) ✅
- Migration 006 (brand_brain table + RLS) ✅

**Service layer:** `brandBrain.service.ts` — load (maybeSingle) + save (upsert onConflict user_id)

## Phase 4 — Google Business Profile Integration
**COMPLETE** ✅ (verified end-to-end: OAuth flow, token storage, UI state)

**DB migration 007 applied (`kgttncfkzdrgswfkkdji`):**
- `google_connections` (state machine: PENDING/CONNECTED/REFRESH_FAILED/REVOKED/DISCONNECTED/ERROR)
- `google_connection_tokens` (service-role only — no authenticated RLS policies)
- `google_locations` (per-connection, user-selectable)
- `reviews` (synced from Google, full status machine: NEW→PUBLISHED)

**Edge Functions deployed (all ACTIVE, `verify_jwt: false` + manual auth):**
- `google-oauth-start` v7 — generates state, returns Google auth URL
- `google-oauth-callback` v4 — exchanges code for tokens, fetches locations
- `google-sync-reviews` v4 — syncs reviews from Google (with token refresh)
- `google-publish-reply` v4 — publishes approved reply to Google (idempotent)
- `google-disconnect` v4 — revokes tokens, marks DISCONNECTED

**Secrets set in Supabase dashboard:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` ✅

**Portal UI:**
- `SettingsPage` — Connect/Disconnect/Sync now buttons, location toggles, last synced timestamp
- `GoogleCallbackPage` — handles `/auth/google/callback` redirect from Google
- `google.service.ts` — client wrapper for all edge function calls

**Verified working:** bilalxmughal@gmail.com connected successfully. "No locations" expected — account has no verified Google Business Profile. Real customers with verified profiles will see locations list.

## Phase 5 — AI Response Generation
**COMPLETE** ✅ (full Brand Brain integration shipped 2026-10-31)

**Edge function:** `ai-generate-draft` v38 (Supabase, ACTIVE) — complete rewrite
- Multi-provider support: Anthropic, OpenAI, Groq, Gemini
- Loads `brand_brain` (global) + `brand_brain_overrides` (per-location) and merges them
- Per-star-rating tone/length overrides (`five_star`/`mid_star`/`low_star` buckets)
- Business context: `business_name`, `business_type`, `business_desc` in prompt
- `custom_tone_instructions` appended to tone requirement
- `reply_signature` appended after draft with `\n\n` separator
- `keyword_contexts`: scans review body, injects matched context strings
- `reviewer_lang_behaviour`: `match` = detect reviewer language; `primary` = use configured language
- `example_reply`: passed as style reference to AI
- `approval_rules`: sets `NEEDS_APPROVAL` vs `DRAFT_READY` status on review
- `negative_rule`: manual/cautious/normal handling for ≤2★ reviews
- `prohibited_phrases`: enforced via prompt instruction
- Server-side billing check (inlined `checkAndRecordUsage`): queries `subscriptions` + `plan_entitlements` + `usage_events`; returns 429 when limit reached

**Portal UI:** ReviewsPage — "Generate Draft" button calls edge function, populates editable textarea; "Approve & Publish" calls `google-publish-reply`

**Usage tracking:** Server-side in edge function (`usage_events` insert after successful draft generation)

## Bug fix — new user signup (2026-11-12)
**COMPLETE** ✅

`trigger_welcome_email` called `extensions.net.http_post(...)` but pg_net lives in schema `net`, not `extensions.net`. This threw on every new user signup, rolling back the `auth.users` INSERT and preventing account creation. Old users were unaffected (trigger only fires on INSERT).

Also hardened `handle_new_user` with `ON CONFLICT (id) DO NOTHING` to guard against duplicate-key failures on the `profiles` insert.

**Migration applied:** `20261113000003_fix_new_user_triggers.sql` — both functions updated live.

`ensureOrg` race condition fixed: when PKCE re-renders trigger a concurrent second call to `create_organization`, the duplicate raises a DB error. `org.store.ts` now re-runs `check()` on any error so the org created by the first call is loaded instead of leaving state empty.

## Phase 6 — Billing & Subscription (Paddle LIVE)
**COMPLETE (Paddle live)** ✅

**DB migration 008 applied (`kgttncfkzdrgswfkkdji`):**
- `plans` — Free / Starter / Growth / Scale (seeded)
- `plan_prices` — monthly + annual prices per plan (USD) with `paddle_price_id`
- `plan_entitlements` — LIMIT / UNLIMITED / BOOLEAN / ENUM values with usage_reset cadence
- `plan_location_addons` — $5/$10/$15 per extra location (Starter/Growth/Scale)
- `subscriptions` — one active row per user; trigger auto-assigns Free on signup; existing users backfilled
- `subscription_addons` — extra location add-ons per subscription
- `usage_events` — ai_draft + published_reply events; user-scoped RLS

**DB migration 20261113000001 applied (`kgttncfkzdrgswfkkdji`):**
- `paddle_transactions` — per-user payment history; unique index on `paddle_transaction_id`; RLS (users read own rows only)

**Paddle integration:**
- `paddle-webhook` Edge Function — verifies HMAC-SHA256 signature; handles subscription.created/updated/activated/canceled/paused + transaction.completed + transaction.payment_failed
- `transaction.completed`: stores row in `paddle_transactions` (plan_name, billing_interval, amount_cents, currency)
- `PADDLE_WEBHOOK_SECRET` configured in Supabase Edge Function secrets
- Portal loads Paddle.js v2; `openPaddleCheckout()` with `custom_data.user_id` + `successUrl=/billing?upgraded=1` + `eventCallback` → localStorage

**Service layer:** `billing.service.ts`
- `getPlans()` — catalog from DB
- `getSubscription()` — user's active subscription + addon_items
- `getUsage()` — period window (7-day rolling for Free, subscription period for paid)
- `getUsageHistory()` — last 30 days grouped by date for chart
- `checkLimit()` — entitlement lookup + usage count
- `recordUsage()` — inserts usage_events row (client-side only)
- `getTransactions()` — fetches `paddle_transactions` for current user (most recent first)

**Portal BillingPage** (`/billing`):
- Current plan card with team seats meter (1/N)
- Usage meters (AI drafts + replies) with alert banners at ≥80% / ≥90%
- Overage protection toggle
- 14-day usage history bar chart
- Add extra location button → dialog with cost breakdown
- Active add-on line items with cancel
- Annual savings banner (shown when on monthly paid plan)
- Compare all plans modal — full feature matrix
- Monthly/annual toggle with –20% label
- 4-column plan cards (Scale card dark); upgrade buttons wired to Paddle live checkout
- **Payment success modal** — shown after `?upgraded=1` redirect; polls webhook (5× 1.2s); shows plan name, Moffu logo, amount, transaction ID, date, status; Download Receipt (print-to-PDF); Go to Billing close
- **Transaction history** — real `paddle_transactions` data; Description/Amount/Status/Receipt columns; Receipt button opens printable HTML invoice
- Billing view loads transactions on mount

**Pending (further work):**
- Server-side limit enforcement in `google-publish-reply` edge function (ai-generate-draft is ✅ done)
- Upgrade/downgrade/cancel subscription lifecycle (Paddle portal link)

## Phase 8 — Onboarding Flow
**COMPLETE** ✅

**DB migration 009 applied (`kgttncfkzdrgswfkkdji`):**
- `create_organization(name, slug, country_id?, timezone?)` — security definer RPC; creates org + owner membership + activates profile atomically
- `update_org_location(org_id, country_id?, timezone?)` — owner/admin only
- `complete_onboarding(org_id)` — sets org.status = 'active'

**Portal UI:** `OnboardingPage` at `/onboard` — 4-step wizard:
- Step 1: Create org (name + auto-slug; slug uniqueness error handling)
- Step 2: Country (from DB) + timezone (browser auto-detect; skippable)
- Step 3: Connect Google Business Profile (skippable; sessionStorage flag routes OAuth callback back to /onboard)
- Step 4: Done — calls complete_onboarding, redirects to dashboard

**Guard:** `OnboardingGuard` — checks org_members after auth; no-org users always land at /onboard; resumes onboarding on return from Google OAuth.

**App routing:** `/onboard` uses AuthGuard only; dashboard routes use OnboardingGuard (auth + org).

**Pending:**
- ONBOARD-004: Dedicated location selection step (SettingsPage covers it for now)
- ONBOARD-005: Brand Brain quick-setup step in wizard
- ONBOARD-006: Synthetic test review (FUTURE)

## Dashboard Polish (post-Phase 6, 2026-10)
**COMPLETE** ✅

**Glassmorphic design system applied across portal:**
- DashboardLayout — topbar with global location selector, glassmorphic nav
- OverviewPage — 5 advanced features added: response time card, rating trend arrows (30-day %, vs prev period), recent activity feed, weekly highlight strip, campaign performance summary
- OverviewPage — location filter wired to global `useLocationStore` (topbar); all metrics filter client-side on selectedId change
- ReviewsPage — glassmorphic filter bar, custom FilterDropdown popovers (no native select), full-width layout
- Review Insights — filters and chart background fixed
- Brand Brain — glassmorphic design
- Settings — glassmorphic design
- Campaigns, Team, Billing pages — glassmorphic design

**UX standards locked:**
- `LocationDropdown` per-page pattern removed; `useLocationStore(s => s.selectedId)` is global source of truth
- Weekly Highlight: flat inline strip (dot + label + divider + message), not a banner
- All dropdowns use custom FilterDropdown popover pattern (rounded-xl, no overflow-hidden on parent cards)
- formatId() wraps all ref_id display (shows 0001 not ORG-00001)

## Review Gating / Feedback Funnel
**COMPLETE** ✅ (shipped 2026-10-31)

**DB migration applied (`kgttncfkzdrgswfkkdji`):**
- `feedback_requests` — token (UUID), org_id, user_id, location_id, customer_name, customer_email, google_review_url, channel, sentiment, feedback_text, rating, status (PENDING/OPENED/HAPPY/UNHAPPY/SUBMITTED), expires_at, sent_at, open_count, last_opened_at, clicked_at
- `increment_feedback_open(p_token)` — security definer RPC for atomic open counter

**Edge Functions deployed (ACTIVE):**
- `feedback-send-email` v3 — sends branded HTML email via Resend; embeds 1×1 tracking pixel + click-through links; marks `sent_at` + `channel='email'`
- `feedback-track` v1 — serves 1×1 transparent GIF; increments `open_count`/`last_opened_at` on open; sets `clicked_at` once on click; `verify_jwt: false`

**Portal UI:**
- `FeedbackInboxPage` (`/feedback`) — glassmorphic table with per-row tracking badges (sent Xh ago / opened N× / not opened yet) when `channel='email'`
- `NewFeedbackRequestPage` (`/feedback/new`) — create request form; success state shows "Send via email to {address}" button when email is on file; green confirmation after send
- `FeedbackResponsePage` (on `apps/web`) — customer-facing happy/unhappy flow

**Email sending:**
- Requires `RESEND_API_KEY` and `WEB_URL` secrets set in Supabase (`supabase secrets set ...`)
- From: `feedback@moffu.co` (domain must be verified in Resend account)

## Phase 7 — Admin Portal
**LARGELY COMPLETE** ✅ (checklist updated 2026-11-11)

**Pages built and routed in `apps/admin`:**
- `DashboardPage` — real KPIs (orgs, users, MRR, active subs, reviews, AI drafts, Google connections), daily/monthly charts, plan distribution, top orgs, live audit feed
- `ClientsPage` + `ClientDetailPage` — org list (search/filter/sort), org 360 view with sub + members + impersonate + Google status + usage
- `PlatformMembersPage` + `TeamMemberDetailPage` — platform team management; invite/create via `admin-create-user` Edge Function; bulk delete via `admin-delete-member`
- `RolesPage` — role/permission reference view
- `AuditPage` — full audit_events log with filters
- `SubscriptionsPage` — all subscriptions, Promo badge for discounted plans, plan override
- `PaymentsPage` — payment history
- `MRRPage` — MRR chart and breakdown
- `CouponsPage` — create/manage discount coupons
- `RefundsPage` — refund management
- `UsagePage` — AI draft + reply usage per org
- `ReportsPage` — analytics reports
- `BroadcastPage` — send notifications to all/plan/org/user via `admin-broadcast` Edge Function
- `WaitlistPage` — waitlist management
- `FeatureFlagsPage` — create/toggle feature flags (owner/super_admin only)
- `IntegrationsHealthPage` — Google connection health per org
- `ProfilePage` — admin user profile
- `AdminLayout` — global search (orgs + profiles, debounced, Cmd+K)
- Settings: AI, Google, Sync, Email, Security, General, ClientLogo, WebsiteTeam, Instagram, Packages

**Impersonation:** `admin-impersonate` Edge Function wired in `ClientDetailPage` per member row; opens portal magic link in new tab; audit logged.

**Owner role:** granted same permissions as `super_admin` across all Edge Functions (`admin-impersonate`, `admin-create-user`, `admin-delete-member`, `admin-broadcast`).

**Pending:** none — all admin portal items implemented or removed from scope.

## Tier 1 Automations
**IMPLEMENTED** ✅ (2026-11-11)

**DB migration applied (`kgttncfkzdrgswfkkdji`):**
- `subscriptions` extended: `payment_failure_count` (int, default 0), `usage_80_notified_period` (text 'YYYY-MM'), `usage_100_notified_period` (text 'YYYY-MM')

**paddle-webhook (`transaction.payment_failed`):**
- Increments `payment_failure_count` on each failed transaction
- Attempts 1-2: sends "Payment failed" warning email (attempt N of 3) via Resend
- Attempt 3+: auto-suspends org, inserts `audit_events` (action: `auto_suspend_org_payment_failure`), sends "Account suspended" email
- `transaction.completed`: resets `payment_failure_count` to 0

**ai-generate-draft (usage notifications):**
- After recording each usage event, fire-and-forget `sendUsageNotificationIfNeeded`
- 80% warning email: sent once per billing period (tracked via `usage_80_notified_period`)
- 100% blocked email: sent once per billing period (tracked via `usage_100_notified_period`)
- Idempotent: updates period field BEFORE sending to prevent duplicate emails on race conditions

**google-sync-reviews (token refresh failure):**
- Token refresh block wrapped in try/catch
- On failure: sets `google_connections.state = 'REFRESH_FAILED'`, sends "Reconnect your Google account" email
- Returns 401 to caller

**All emails:** from `Moffu <notifications@moffu.pro>` via Resend; branded HTML with purple (#6C55E8) CTA buttons; support link to `support@moffu.pro`

## Marketing — Post Ideas from Reviews
**COMPLETE** ✅ (shipped 2026-11-12)

**DB migration applied (`kgttncfkzdrgswfkkdji`):**
- `review_highlights` table (org_id, location_id, highlight_text, keywords[], source_review_ids[], generated_at) with RLS (org members can select)
- Weekly pg_cron job `weekly-review-highlights` (Sat 23:00 UTC) calls `extract-review-highlights` edge function

**Edge Function:**
- `extract-review-highlights` — takes `{ location_id? }` or processes all selected locations in cron mode; queries 4-5 star reviews (last 100); uses Gemini to extract 5 highlight phrases + keywords; upserts to `review_highlights`; returns `{ extracted, location_count }`

**Portal UI:**
- `MarketingPage` — "Post Ideas from Reviews" section: location selector (custom FilterDropdown, only `is_selected` locations), highlight chips, manual "Refresh" button, "Extract now" link when no highlights; each chip navigates to NewPostPage with pre-filled params
- `NewPostPage` — reads `?highlight=&location_id=&post_type=` URL params; pre-fills Review Highlight post type, context textarea, and passes `source_review` to `ai-generate-post`; shows purple banner when highlight is pre-loaded
- `marketingService` — added `loadHighlights(locationId)` and `extractHighlights(locationId?)` methods

## Transactional Emails
**IMPLEMENTED** ✅ (2026-11-12)

**Receipt email (`paddle-webhook` → `transaction.completed`):**
- Sent via Resend from `notifications@moffu.pro`; reply-to `billing@moffu.pro`
- Flat purple-header HTML; discount breakdown row (strikethrough original + green promo row) when `discountCents > 0`
- Parses `details.totals.subtotal/discount/grand_total` and `data.discount.code` from Paddle payload

**Welcome email (`welcome-email` Edge Function):**
- New Edge Function: `supabase/functions/welcome-email/index.ts`
- Called by DB trigger `on_auth_user_created_welcome_email` on `auth.users` INSERT via `pg_net`
- Migration `20261113000002_welcome_email_trigger.sql` applies the trigger
- Auth: `x-webhook-secret` header validated against `WELCOME_WEBHOOK_SECRET` Edge Function secret; secret value must also be set as a Postgres DB setting: `ALTER DATABASE postgres SET app.welcome_webhook_secret = '<value>';`
- Content: Gen Z flat design, features list, Free Plan callout, dashboard CTA, upgrade link to `/pricing`
- From `notifications@moffu.pro`, reply-to `support@moffu.pro`

**Required secrets (not yet set):**
- `WELCOME_WEBHOOK_SECRET` — set via `supabase secrets set WELCOME_WEBHOOK_SECRET=<value>` AND `ALTER DATABASE postgres SET app.welcome_webhook_secret = '<same-value>';`

## Marketing Website — Review-to-Post Feature Announcement
**COMPLETE** ✅ (shipped 2026-11-12)

**`apps/web` homepage (`page.tsx`):**
- Hero section: added "New" announcement badge between HeroHeadline and tagline: "Turn your 5-star reviews into social media posts, automatically."
- Features grid: added "Reviews to Social Posts" card with share icon: "Your best 5-star reviews become ready-to-post marketing content. Moffu extracts the highlights, drafts the copy, and surfaces it for one-click approval, every week."

## Marketing Website — SEO Audit V2 Fixes
**COMPLETE** ✅ (shipped 2026-11-12)

**F1 — H1 keyword optimisation:** `HeroHeadline.tsx` — `aria-label` added to `<h1>` with keyword-rich text ("AI-powered Google review reply software for businesses. Auto-draft on-brand responses to every review in seconds.") without changing visual content.

**F2 — Semantic heading hierarchy:** `apps/web/src/app/(marketing)/page.tsx` — section labels ("how it works", "Features", "faq") promoted to `<h2>`; FAQ questions promoted to `<h3>`; decorative headlines kept as `<p>`.

**F3 — FAQ question headings:** FAQ `<span>` elements changed to `<h3>` throughout the homepage FAQ accordion.

**F4 — Open Graph tags:** Added `og:type: 'website'`, `siteName: 'Moffu'`, `locale: 'en_US'` to homepage + all marketing pages.

**F5 — Features URL:** Navbar "Features" link kept at `/#features` (smooth-scroll to section); a "See all features in detail →" link added at the bottom of the features section pointing to `/feature`.

**F6 — Email address casing:** `SiteFooter.tsx` — `hello@`, `sales@`, `support@` lowercased (were mixed-case).

**F7 — Social links:** X/Twitter link added to footer alongside LinkedIn.

**F8 — JSON-LD structured data:** Organization + WebSite schemas added in `layout.tsx`; SoftwareApplication schema in `page.tsx`; FAQPage schema in `/feature/page.tsx`; BreadcrumbList schema in `/feature/page.tsx` and `/pricing/page.tsx`.

**F9 — `lang="en"`:** Already present on `<html>` in root layout (no action needed).

**robots.txt:** Added `Disallow: /f/` to block feedback token pages from search indexing.

**sitemap.ts:** New dynamic Next.js sitemap at `apps/web/src/app/sitemap.ts` — includes all 14 marketing pages with correct priorities and change frequencies; registered in `robots.txt`.

**`/pricing` dedicated page:** `apps/web/src/app/(marketing)/pricing/page.tsx` — standalone pricing page with canonical URL, BreadcrumbList JSON-LD, H1, full plan fetch from Supabase, `PricingToggle` component.

**`/faq` dedicated page:** `apps/web/src/app/(marketing)/faq/page.tsx` — standalone FAQ page with canonical URL, FAQPage JSON-LD (10 Q&A pairs → Google rich results eligible), BreadcrumbList JSON-LD, H1, `<details>` accordion.

**Feature page missing card:** "Reviews to Social Posts" card added to `feature/page.tsx` FEATURES array (was in home page grid but missing from feature page).

## External/configuration pending
- `VITE_WEB_URL` → set to `https://moffu.vercel.app` in portalmoffu Vercel project (for "Back to website" link in prod)
- Google OAuth credentials → needed for Phase 4
- OpenAI or Anthropic API key → needed for Phase 5
- Stripe keys → needed for Phase 6
- Docker Desktop or cloud Supabase creds → for local migration testing

## Rule
When asked "pending kya hai?" inspect actual code/database/config/tests; never guess from chat history.

## Documentation update - 2026-10-11: usage reset cadence
Free weekly and paid monthly usage renewal is approved (including monthly allowances on annual subscriptions). See DECISIONS.md D-014 and 09-BILLING-PLANS-AND-ADDONS.md. Documentation only: runtime reset enforcement has not been implemented or verified in this task. Billing implementation remains pending.
