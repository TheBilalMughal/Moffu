# Project Status

## Current milestone
PHASE 6 — Billing COMPLETE. Marketing: Meta Pixel + GTM/GA4 + cookie consent + CompleteRegistration event LIVE. 14-day free trial for Starter/Growth added (DB migration, paddle-webhook, edge functions, portal UI). Trial CTA ("Start free trial") shown in sidebar upgrade card and dashboard overview card for Starter/Growth next plans; `loadFeatureAccess` now accepts `trialing` status.

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

**Portal UI:** ReviewsPage — "Generate Draft" button calls edge function, populates editable textarea; "Approve & Publish" calls `google-publish-reply`; limit reached (429) shows LimitReachedModal with upgrade CTA linking to /billing

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
- ~~Server-side limit enforcement in `google-publish-reply` edge function~~ ✅ DONE (org override + plan entitlement check added, matches ai-generate-draft pattern)
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
- OverviewPage — 3-column layout updated: Left = SentimentCard (Positive/Neutral/Negative %), Middle = Trend chart + Rating Breakdown, Right = UpgradeCard (current plan → next plan, discounted pricing with strikethrough original, annual rate shown)
- UpgradeCard: shows discounted price (applyPlanDiscount matches BillingPage formula), annual/monthly both shown, contact_sales plans show "Custom pricing"
- UpgradeCard added to ReviewsPage and ComplaintsPage (matches OverviewPage design; shown between chart/header and filter bar)
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

**Admin enhancements (2026-11-18):**
- `ClientDetailPage` Google tab: location names are now clickable links opening Google Maps search in a new tab
- `ClientsPage` GBP Status column: "Not Set Up" rows show a flat envelope icon button that sends a GBP setup email via `admin-send-gbp-email` Edge Function (v2)
- 24h cooldown: `admin_outreach_log` table (migration `20261118000004`) tracks every send; button shows a green "Sent" badge for 24h after sending, then reappears; cooldown enforced on both frontend (DB-loaded on page load) and backend (edge function returns 429 if within 24h)
- Icon state persists across page refreshes (loaded from `admin_outreach_log`)

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

## Complaints Page (AI-flagged reviews)
**IMPLEMENTED** ✅ (2026-11-13)

**DB migration applied (`kgttncfkzdrgswfkkdji`):**
- `reviews` table: added `is_complaint BOOLEAN DEFAULT NULL`, `complaint_summary TEXT DEFAULT NULL`, `complaint_analyzed_at TIMESTAMPTZ DEFAULT NULL`
- Index `idx_reviews_complaint_analysis` on `(rating, is_complaint, complaint_analyzed_at) WHERE rating <= 3`
- Index `idx_reviews_is_complaint` on `(location_id, is_complaint, published_at DESC) WHERE is_complaint = TRUE`

**Edge Function:**
- `analyze-complaints` — authenticates user, finds unanalyzed 1-3 star reviews for the user's org locations, sends batches of up to 50 to Gemini 2.0 Flash (falls back to 1.5 Flash), gets `is_complaint` + `complaint_summary` for each, updates `reviews` table; no-body reviews marked non-complaint without AI call

**Portal UI (`/reviews/complaints`):**
- Stat cards: Total Complaints, Unanswered, 1-Star Complaints, 2-3 Star Complaints
- Filter bar: status (all/unanswered/answered) + star rating (all/1/2/3)
- Complaint cards: expandable, shows AI summary (purple), review snippet, rating badge, replied/pending status tag, location name chip
- "Run AI Analysis" button triggers Edge Function, shows result banner after completion
- Sidebar nav item "Complaints" (warning triangle icon) added under Reviews group
- Global location selector respected (uses `useLocationStore`)
- Reviews page unchanged

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


## Google Profile business analysis — 2026-11-13
DEPLOYED: Supabase Edge Function v1 and Vercel portal production deployment c57d029 are READY; authenticated Google provider smoke verification remains pending.
- Strict selected-location analysis and an explicit local selector when the global filter is All Locations. No cross-location fallback; stale responses are aborted/ignored.
- New google-profile-analysis Edge Function reads primary/additional categories separately from description, contact details, hours, address/service area and place metadata directly from Google.
- Moffu SEO readiness with visible weights/coverage; no official Google SEO score claim.
- Last 30 completed days of Google performance, last completed calendar month of profile discovery terms with privacy thresholds, and category-based competitor samples at 5/10/20/30 km.
- Google Places setup required for competitor ratings and own public rating. No radius-level public query volume or geo-grid ranking is fabricated. Unattended monitoring is not implemented; the page refreshes on open/change/manual request and every 15 minutes while visible.
- Backend authenticates identity, location/connection ownership, active account and plan feature access. No schema migration or provider-content persistence added.
- Verification: 10 focused Node tests passed; portal TypeScript check and Vite production build passed. Test-fixture desktop (1440px) and mobile (390px) visual inspection checked category display, global location changes, radius changes and unavailable-configuration state. Local dropdown positioning corrected during mobile QA.
- Existing bundle-size/dynamic-import Vite warnings remain. Live OAuth/Places success is not yet verified. Admin google_maps_api_key setting is present as of 2026-11-13; its validity and Places API response remain unverified.
- See developer-docs/16-GOOGLE-PROFILE-ANALYSIS.md for sources, setup, limitations and verification.

## Google Profile advanced analytics additions — 2026-11-13
IMPLEMENTED: 6 advanced features added to GoogleProfilePage.tsx in the client portal.
- Review analytics section: rating distribution (5-star bar breakdown) + monthly trend SVG polyline line chart with area fill, dots and value labels; fed from existing `reviews` DB table.
- Search performance section: search impressions/clicks with optional date range via google-fetch-insights Edge Function (already existed).
- Photos, Q&A, Posts section: new `google-fetch-extra-data` Edge Function fetches media count, Q&A total/unanswered, and recent posts from Google My Business v4 API in parallel.
- Competitor keyword fix: google-competitors Edge Function now uses `description` (business category) only as keyword, with no fallback to display_name; `rankby=prominence` added.
- Global date filter: single DateRangePicker in page header controls both reviews and insights sections; no pre-selection (empty default = all reviews / last 30 days for insights).
- UI changes: fetch timestamp format changed to `13-Nov-2026, 6:40 PM`; connection status line removed; breadcrumb label removed.
- Admin GoogleSettingsPage: `google_maps_api_key` field added (show/hide toggle) for Places API key management.

## Integrations: auto-sync on location enable — 2026-11-13
IMPLEMENTED: SettingsPage.tsx handleToggleLocation now triggers a background sync when a location is enabled.
- When a location is toggled ON, showToast displays "Location enabled. Syncing latest data..." and googleService.syncReviews() fires fire-and-forget in the background.
- No change when disabling a location (no data loss concern).
- Uses existing syncReviews Edge Function (google-sync-reviews); no new backend changes needed.
## Admin AI Activity page — 2026-11-13
IMPLEMENTED: New /ai-activity page added to Admin portal under the Clients nav group.
- 5 KPI cards: AI Drafts Today, 7-day, 30-day, Published Replies 30-day, Active Orgs.
- Active AI provider badge (reads from ai_settings table, is_active=true).
- 30-day SVG trend chart with two lines (AI Drafts purple + Published Replies blue), area fills, dots.
- Event log table: last 1000 events, paginated 25/page, with event type filter (All/AI Draft/Published) and org/user search.
- Route: /ai-activity. Nav item added in Clients section of AdminLayout.

## Admin AI Keys page redesign + token usage tracking — 2026-11-13
IMPLEMENTED: Complete redesign of /settings/api/ai (AISettingsPage) with internal tab navigation.
- Internal tabs: Dashboard + one tab per provider (Gemini, OpenAI, Groq, Anthropic).
- Dashboard tab: KPI cards (total calls, tokens, errors, error rate), free-tier limit bars, 30-day SVG bar chart (success purple / error red), per-function breakdown table, recent errors list. Shows empty state if ai_token_usage table has no data yet.
- Provider tabs: inline API key input (password with show/hide), radio-card model selector (no native select), Save/Set Active/Remove buttons. Colored dot in tab label indicates configured/active state.
- handleActivate fixed: deactivates all existing active rows before activating target (prevents multiple active providers).
- handleSave: auto-activates first provider added with no existing active row.
- DB migration applied (kgttncfkzdrgswfkkdji): ai_token_usage table with RLS (platform_members read, edge functions insert via service role). Indexes on created_at desc, provider, function_name.
- Edge functions updated to log token usage fire-and-forget after every AI call:
  - ai-generate-draft: all providers (Gemini/OpenAI/Groq/Anthropic), token extraction per provider's response shape, error_code logging on failure.
  - extract-review-highlights: Gemini token extraction from usageMetadata.
  - analyze-complaints: Gemini token extraction, outer handler updated to destructure AnalyzeResult return type.

## Brand Brain — per-location overrides filter — 2026-11-13
IMPLEMENTED: `brandBrain.service.ts` `loadLocations()` now adds `.eq('is_selected', true)` to the Supabase query.
- Only enabled (is_selected=true) locations appear in Step 1 (Per-location identity overrides) and Step 6 (Location Overrides) of the Brand Brain wizard.
- Disabled locations are hidden from the UI only; their override rows in `brand_brain_overrides` are never deleted, so re-enabling a location restores all previously saved settings automatically.

## Billing — Marketing + Feedback in plan comparison table — 2026-11-13
IMPLEMENTED: Added Marketing and Feedback sections to `COMPARISON_ROWS` in `BillingPage.tsx` with correct entitlement key wiring.
- DB migration `add_marketing_feedback_entitlements` inserted `marketing_posts` (LIMIT 0/mo) and `feedback_requests` (LIMIT 0/mo) rows for all 4 active plans.
- `COMPARISON_ROWS` now includes: `marketing_posts` (section: Marketing) and `feedback_requests` (section: Feedback).
- Both sections appear in the plan comparison modal between Campaigns and Support.

## Billing — Campaigns/Marketing/Feedback as boolean Feature Access toggles — 2026-11-13
IMPLEMENTED: Converted Campaigns, Marketing, Feedback from numeric limits to boolean on/off Feature Access toggles (matching Google Profile and Insights pattern).
- DB migration `add_feature_bool_entitlements` inserted `feature_campaigns`, `feature_marketing`, `feature_feedback` (BOOLEAN false) rows for all 4 plans.
- Admin `PackagesSettingsPage.tsx`: Feature Access section now has 5 checkboxes: Google Profile, Insights & Analytics, Campaigns, Marketing, Feedback.
- Portal `BillingPage.tsx` `COMPARISON_ROWS`: All 5 feature booleans now appear under the "Feature Access" section header.

## Billing — Brand Brain in Feature Access section + DB rows — 2026-11-13
IMPLEMENTED: Added `feature_brand_brain` to plan comparison modal Feature Access section and DB for Growth/Scale.
- `BillingPage.tsx` `COMPARISON_ROWS`: Added `{ label: 'Brand Brain', key: 'feature_brand_brain', section: 'Feature Access' }` before Google Profile row.
- DB migration `add_feature_brand_brain_growth_scale`: inserted `feature_brand_brain = true` for Growth and Scale plans (Free already true, Starter false).
- Dynamic BOOLEAN gating (`DashboardLayout.tsx`) now auto-maps this key — no hardcode needed.

## Entitlement gating for Campaigns/Marketing/Feedback pages — 2026-11-13
IMPLEMENTED: Portal now enforces feature access on route and sidebar navigation level.
- `DashboardLayout.tsx`: Updated `navItems` and `navGroups` Engage section to set `featureKey: 'feature_campaigns'`, `'feature_marketing'`, `'feature_feedback'` (were `null`). Sidebar now shows lock icon and greys out items when feature is off.
- `FeatureGate.tsx`: Added `FEATURE_META` entries for `feature_campaigns`, `feature_marketing`, `feature_feedback` so UpgradeWall shows meaningful name and description.
- `App.tsx`: Wrapped all 6 routes (`/campaigns`, `/campaigns/:id`, `/feedback`, `/feedback/new`, `/marketing`, `/marketing/new`) with `<FeatureGatePage feature="...">` — direct URL navigation now also shows UpgradeWall when the feature is disabled in the package.

## Moffu 2.0 — Phase 0 audit and Profile Doctor slice — 2026-11-16
**Profile Doctor evidence schema/UI: IMPLEMENTED LOCALLY; validation pending.**
- The existing `google-profile-analysis` server function remains the Profile Doctor source. Each readiness check now carries a stable evidence reference, source, observation timestamp, capability limitation, severity, observed value, status, weight, and versioned methodology (`moffu-local-readiness-v2`).
- Google Business Profile and synced-review evidence remain separated. Unknown values are excluded from readiness coverage; service-area businesses can pass with a configured service area and no public storefront address.
- `GoogleProfilePage` shows the assessment explanation, methodology version, assessed-weight coverage, and per-check status/severity/source/value/time/evidence reference. It states that the assessment is calculated for this view and not saved as a report.
- Existing `feature_google_profile` route and server-side entitlement/ownership checks are preserved. No new auth/billing system, schema/table, Google publish action, feedback-flow change, or GeoRank capability was added.
- Phase 0 report: `19-MOFFU-2.0-PHASE-0-AUDIT.md`.
- Critical migration gate: pre-GeoRank audit compared 69 local files with 73 remote rows (29 exact, 40 local-only, 44 remote-only). The new local-only GeoRank migration raises the checkout to 70 files/41 local-only; duplicate local versions 20241025000028/20241025000029 remain. Reconcile before applying DDL; this does not prove a missing production schema.
- Live Supabase advisor findings are recorded in the audit report; no unrelated security changes were made.
- Portal typecheck passed (`pnpm --filter @moffu/portal typecheck`). Test suites, production build, Deno typecheck (Deno is unavailable in this environment), and visual browser QA were not run. No deployment or production write was performed.

## Google Profile local-dev errors — 2026-11-16
- Supabase Edge logs show `OPTIONS 404 NOT_FOUND` for `/functions/v1/google-fetch-extra-data`; live function inventory confirms the slug is not deployed. The local source already handled `OPTIONS`, but a missing deployed function never reached that handler.
- `google-fetch-extra-data/index.ts` now has explicit preflight headers/status and strict manual Bearer validation; `supabase/config.toml` sets `verify_jwt = false` for this function because the handler validates the user token itself and must receive unauthenticated CORS preflight requests.
- Portal now normalizes older `google-profile-analysis` responses that lack Phase 1 evidence fields, and supplemental-data fetch failures render an unavailable state instead of becoming unhandled promise rejections.
- Portal typecheck passed after the fix. Supabase `google-fetch-extra-data` v1 is now deployed to project `kgttncfkzdrgswfkkdji` with `verify_jwt=false`; live OPTIONS preflight returned 204 with CORS headers, and unauthenticated POST returned 401 with CORS headers. Authenticated Google provider/Places response and UI browser flow remain unverified.

## Moffu 2.0 — neutral feedback invitation — 2026-11-16
- `feedback-gate` now returns the saved public review URL for both positive and negative private-feedback responses.
- The public feedback page displays the same optional honest Google review link before sentiment is selected. Choosing private feedback remains optional; existing `happy`/`unhappy` records and request statuses are preserved.
- Feedback email copy now offers an honest public review and private feedback as equal choices, without positive/negative branching. The portal's request-creation copy describes the neutral flow.
- Portal/web and Edge Function source changes are local only. `feedback-gate` and `feedback-send-email` were not deployed; no existing records were changed and no customer emails were sent.
- Live project policies prohibit review suppression or selectively soliciting positive reviews; see [Google Maps user-generated content policy](https://support.google.com/contributionpolicy/answer/7400114).

## Moffu 2.0 — Phase 1 validation update — 2026-11-16
- Profile Doctor analysis regression suite: all 10 tests pass. Added assertions for methodology version, stable unique check IDs, provenance metadata, and unknown-data treatment.
- Portal typecheck and production build pass. Existing Vite warnings remain about a shared Supabase module being both dynamically and statically imported and a large JS chunk.
- Web typecheck passes. Next.js build compiled, linted, typechecked, and generated all static pages, then exited with `EPERM` while creating pnpm dependency symlinks in `.next/standalone`; no application compile error was reported.
- Browser QA reached the local `/auth/login?next=/google-profile` gate. No credentials or Terms acceptance were entered, so authenticated UI and responsive visual inspection remain pending.
- Deno is unavailable, so Supabase Edge Function typecheck was not run. Feedback Edge Functions remain local and undeployed.

## Moffu 2.0 — authenticated Profile Doctor QA — 2026-11-16
- User signed in to the local portal and the selected Black Drivo location loaded. Authenticated Google Business Profile response included primary category `Transportation service`, business fields, and Google Maps link.
- Google Performance, profile discovery terms, competitor sample, rating analytics, and deployed supplemental photo/Q&A/posts data rendered in the page. At the 5 km radius, the page showed a 16-business returned sample; the UI correctly labels it as a sample, not a ranking/census.
- Desktop UI visually checked at the current browser viewport. Profile readiness explanation correctly says it is a Moffu diagnostic, not Google's score or a prediction. Profile evidence fallback now derives observed values, correct GBP-versus-synced-review sources, evidence references, and freshness for legacy server v1 responses.
- Pre-deploy verification showed `moffu-local-readiness-v1`; user-approved v2 deployment and authenticated post-deploy verification are recorded below. Local Edge Function source has 10/10 regression tests passing; Deno is unavailable.
- Mobile visual QA remains pending. No refresh button was pressed, no production data was written, and no production deployment was performed in this QA step.

## Moffu 2.0 — Profile Doctor v2 deployment — 2026-11-16
- User-approved Supabase Edge Function deployment completed: `google-profile-analysis` is ACTIVE v2 on project `kgttncfkzdrgswfkkdji`, with `verify_jwt=true` preserved. Deployment included `index.ts` and `analysis.ts`; no migration or schema changes.
- Authenticated local portal refresh after deployment succeeded. The page now reports `moffu-local-readiness-v2`, shows the methodology explanation and Moffu heuristic thresholds, and renders per-check observations, source, timestamp, evidence reference, severity, status, and coverage.
- Live GBP category/profile, Google rating/reviews, performance, profile discovery terms, Places competitor sample, and deployed supplemental photo/Q&A/posts data returned for the selected location.
- Portal typecheck/build and 10 focused analysis tests pass. Desktop browser QA passed. Mobile QA and current Vercel frontend deployment remain pending. Web build is blocked at standalone dependency symlink creation on Windows (`EPERM`), after compile and static page generation.

## Moffu 2.0 — Phase 2 GeoRank foundation — 2026-11-16
- Audited existing discovery/rank code. `google-search-business` is a generic Pakistan/English DataForSEO Maps query, not a selected-location grid scan. Google Places discovery order remains separate from rank.
- Current DataForSEO docs describe coordinate-targeted Maps SERPs, but its Terms §7 and legal FAQ do not resolve Moffu's customer-facing rank analytics rights or upstream Google permissions. DataForSEO is a technical candidate only, not approved. See `20-MOFFU-2.0-PHASE-2-GEORANK-SOURCE-REVIEW.md`.
- Implemented source-neutral grid generation, point-state validation, completion/top-3/top-10/mean-observed-rank metrics, survivorship-bias flag, configurable pricing estimator, and budget check in `supabase/functions/_shared/georank-core.ts`.
- Verification: 7 focused Node tests pass; strict standalone TypeScript check and `git diff --check` pass.
- Added local `/georank` portal route and sidebar item, authenticated DataForSEO adapter (off unless rights/config flags are enabled), history/grid UI, selected-location ownership and existing plan checks, per-point status persistence, provider cost reconciliation, and a staged additive migration for scan history/RLS/atomic reservations/expiry cleanup.
- Portal `pnpm --filter @moffu/portal typecheck` passes; `git diff --check` passes. Focused GeoRank tests and helper strict TypeScript check passed in the earlier Phase 2 slice.
- Not activated: no provider API call or credential read; migration was not applied. Supabase `georank` Edge Function v1 is deployed with JWT verification on to return configuration blockers; the scan schema is still missing. Production database still requires migration-history reconciliation. The synchronous worker lacks crash-resumable jobs/leases/retries, so production automation remains incomplete.
- GeoRank remains disabled until source/coordinate rights review and server-side `DATAFORSEO_AUTH`, `GEORANK_ENABLED`, `GEORANK_SOURCE_RIGHTS_APPROVED`, `GEORANK_PRICE_PER_REQUEST_USD`, and `GEORANK_MONTHLY_CAP_USD` configuration are provided. The Admin Google Maps API key is not a GeoRank provider key.

## Moffu 2.0 — Phase 2 live-state correction — 2026-11-17
- Supabase GeoRank scan tables and RLS were applied to project `kgttncfkzdrgswfkkdji`; remote migration history records `20261116083141_georank_scans_and_usage_reservations`. The checked-in migration filename is aligned to that applied version.
- After the signed-in Google Business Profile refresh, 4 of 7 saved locations have coordinates and Google Maps Place IDs. Of 2 selected locations, Black Drivo is ready; Pakswedish School Tibba Kamangran still lacks both.
- `google-fetch-locations` v28 is deployed with Business Profile metadata Place ID and coordinate persistence. GeoRank remains gated: no paid DataForSEO rank request was made, and provider rights, DataForSEO credentials, server cost limits, and permitted coordinate provenance still need resolution.
- 2026-11-17 DataForSEO check: `DATAFORSEO_AUTH` is present but a free `appendix/user_data` request rejected it. GeoRank now supports `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` server secrets and shows a non-billable connection test. Live Maps base price `$0.002` and initial per-user monthly cap `$0.10` are configured; the cost-limit blocker cleared. The rights and enabled gates remain off; no paid scan was sent. GeoRank Edge Function v5 is deployed with JWT verification on.
- Earlier Phase 2 notes describe the 2026-11-16 pre-migration state. Their “migration not applied” statements are historical, not current.

## Google Profile page redesign + GBP Posts system — 2026-11-17
**IMPLEMENTED LOCALLY (not pushed)**

**GoogleProfilePage.tsx — full layout redesign (2026-11-17 v2):**
- Card top borders removed (`Metric` component no longer has the purple accent bar; plain white cards)
- `Section` component: accepts optional `className` prop for `flex-1` height stretching
- Layout order: KPI cards → Search & Maps performance section → 2-col grid (Business Profile + Review Analytics | Profile Doctor)
- Photos/Q&A/Posts section: removed from this page entirely (moved to dedicated subpage)
- Left column: `flex flex-col gap-6` with Business Profile + Review Analytics each `flex-1` (combined height matches Profile Doctor on the right)
- Review analytics: improved 5-color rating bars + monthly SVG trend chart; `StatusDot` component for per-check status labels
- Search & Maps: stacked daily bar chart (Search purple + Maps light purple) with legend and 5 stat cards (no top accent)

**Google Business Profile Posts — dedicated subpage:**
- `apps/portal/src/features/google/GooglePostsPage.tsx` — new full-page social media post creator
  - Three post types: What's New (STANDARD), Event, Offer — card selector
  - 1500-char summary textarea with live counter
  - Event/Offer fields: title, start date, end date, coupon code (Offer only), T&C (Offer only)
  - CTA chip selector: No button / Learn more / Book / Order online / Shop / Sign up / Call now
  - Live preview panel (PostPreview matches Google Maps post card style)
  - Google post guidelines sidebar
  - Recent posts list from `googleService.fetchExtraData()`
  - Publishes via `googleService.createGooglePost()`
  - Google logo attribution at bottom
- `DashboardLayout.tsx`: “Posts” submenu item added to Overview RAIL_GROUPS under Google Profile
- `App.tsx`: `/google-profile/posts` route added, wrapped in `FeatureGatePage` with `feature_google_profile`

**Edge Function:**
- `supabase/functions/google-create-post/index.ts` — POST to `mybusiness.googleapis.com/v4/{locationName}/localPosts`; validates location_id, summary (max 1500), topic_type (STANDARD/EVENT/OFFER); builds callToAction and event schedule; same token refresh pattern
- `google.service.ts` — `createGooglePost(locationId, data)` method added

**Not pushed/deployed:** `push nai krna hai` constraint in effect.

## Google Profile full advanced redesign — 2026-11-17
**IMPLEMENTED LOCALLY (not pushed)**

**GoogleProfilePage.tsx — complete rewrite v3 (all 7 advanced features):**
- **Profile Header**: round avatar with business initial, verified badge, rating, category, Profile Strength ring (SVG circular progress)
- **Compact 5-col KPI row**: 4 existing metric cards + inline Search/Maps mini-card (4 stats in 2×2 grid)
- **Advanced feature toolbar**: 6 buttons toggling panels inline — Q&A Manager, Edit Info, Photo AI, Attributes, Keyword Trends, Strength Advisor
- **Q&A Manager**: fetches questions from `google-qa-list` edge fn, inline reply textarea, publishes via `google-qa-reply`
- **Business Info Editor**: edit description/website/phone, saves via `google-update-profile`
- **Photo Manager**: AI image generation (Gemini via `google-generate-image`), HTML5 canvas for text overlay, upload via `google-upload-photo`
- **Attributes Toggle**: grouped toggles (Accessibility/Amenities/Payment), saves via `google-update-profile`
- **Keyword Opportunity Tracker**: monthly Search+Maps impressions bar chart with MoM delta cards
- **Profile Strength Advisor**: SVG ring + 7-point checklist (description, website, phone, hours, category, replies, GBP connection)
- **Profile Doctor**: now collapsible/expandable with mini bar chart in header; shows strength ring + checks when expanded
- **Competitive Benchmarking**: embedded inside Profile Doctor panel (not a separate section)
- **Add Post modal**: floating overlay with X to close; replaces the dedicated posts subpage
- **Recent Posts**: horizontal scroll cards on main page (from `fetchExtraData`)
- **Business Profile card**: social media style with icon+label rows instead of description list

**Service methods added to `google.service.ts`:**
- `listQAs(locationId)` → `google-qa-list`
- `replyQA(locationId, questionName, text)` → `google-qa-reply`
- `updateProfile(locationId, fields)` → `google-update-profile`
- `uploadPhoto(locationId, imageBase64, mimeType, category)` → `google-upload-photo`
- `generateImage(config)` → `google-generate-image`
- `QAQuestion` interface added

**New Edge Functions (committed + deployed 2026-11-17):**
- `supabase/functions/google-qa-list/index.ts` — v1 ACTIVE
- `supabase/functions/google-qa-reply/index.ts` — v1 ACTIVE
- `supabase/functions/google-update-profile/index.ts` — v1 ACTIVE
- `supabase/functions/google-upload-photo/index.ts` — v1 ACTIVE
- `supabase/functions/google-generate-image/index.ts` — v1 ACTIVE

**Cleanup:**
- Posts subpage (`GooglePostsPage.tsx`) retained but `/google-profile/posts` route and sidebar link removed (Posts is now a modal)
- `App.tsx`: removed `GooglePostsPage` import and route
- `DashboardLayout.tsx`: removed Posts submenu item

**TypeScript**: clean compile (`tsc --noEmit` passes)
**Not pushed/deployed:** `push nai krna hai` constraint in effect.

## Google Profile — 10 UI improvements + competitor fix — 2026-11-17
**IMPLEMENTED + DEPLOYED (Edge Function only; portal not pushed)**

**GoogleProfilePage.tsx — 10 changes (commit b841f79):**
1. Profile Doctor: always expanded, no collapse toggle
2. Review analytics: Monthly chart stacked below Rating distribution (space-y-5)
3. Competitive Benchmarking: radius KM change silently refreshes only that section (separate useEffect)
4. All buttons/tabs: `rounded-lg` border radius
5. Business avatar: Clearbit logo API attempt with initials fallback
6. Filter tab active state: purple dot indicator + tooltip
7. Header info order: Name+Rating → Category → Address
8. Profile header: flat, no card background; Strength ring kept inline
9. Refresh: icon-only silent refresh (no "Analyzing…" text, spinning icon)
10. Inline controls: DateRangePicker + Post button next to refresh icon

**google-qa-list Edge Function (v2, deployed):**
- Fixed 404: switched from old `serve()` (deno.land/std) to `Deno.serve()` — Supabase runtime requires the latter
- Removed redundant unanswered-filter fetch; single call fetches all questions
- Cleaner token refresh path

**google-generate-image Edge Function (v2, deployed):**
- Fixed 500: switched from old `serve()` to `Deno.serve()`
- Changed model from `gemini-2.0-flash-preview-image-generation` to `gemini-2.0-flash-exp`
- Updated `responseModalities` to `['TEXT', 'IMAGE']` (required by Gemini 2.0 Flash Exp for image output)

**google-competitors Edge Function (v3, deployed):**
- All error paths return 200 + `{ competitors: [], warning: "..." }` instead of 400/500
- **Root cause fix**: migrated from legacy Places Nearby Search API (`maps.googleapis.com`) to Places API v1 Text Search (`places.googleapis.com/v1/places:searchText`) — same endpoint used by `google-profile-analysis` which was already working
- Uses `textQuery: loc.category` + `locationBias.circle` body, `X-Goog-Api-Key` header — matching the API key capability (New Places API, not legacy)
- Parses `data.places[]` with `p.displayName.text`, `p.location.latitude/longitude`, `p.userRatingCount`
- `no_category` warning added for locations without a category/description
- Competitive Benchmarking section now populates with real data

## Topic Intelligence — AI topic tagging for reviews — 2026-11-17
**IMPLEMENTED + DEPLOYED** ✅

**DB migration applied (`kgttncfkzdrgswfkkdji`):**
- `reviews.topics_analyzed_at TIMESTAMPTZ` — tracks per-review analysis state; NULL = not yet analyzed
- `review_topics` table (review_id, org_id, location_id, topic TEXT, sentiment TEXT CHECK IN ('positive','negative','neutral'), analyzed_at) + UNIQUE(review_id, topic)
- RLS policy: org members can SELECT their own topic rows
- Indexes on (org_id, location_id, topic, sentiment) and (review_id)

**Edge Function:**
- `analyze-review-topics` v1 (ACTIVE, `verify_jwt: false`) — authenticates user manually, resolves org's selected locations, fetches unanalyzed reviews (batch 60), marks no-body reviews without AI, calls Gemini 2.0 Flash (falls back to 1.5 Flash), upserts topic+sentiment pairs to `review_topics`, stamps `topics_analyzed_at`
- 9 canonical topic slugs: staff_service, food_quality, wait_time, value_pricing, cleanliness, ambiance, delivery_shipping, location_parking, communication
- **Deployment**: CI did not auto-deploy on push; deployed directly via Supabase MCP (2026-11-18)

**Portal UI:**
- `TopicIntelligenceSection` component on OverviewPage (shown when Google connected)
- Horizontal sentiment bars per topic (green=positive, red=negative, gray=neutral), sorted by mention count
- "Analyze reviews" / "Re-analyze" button with pending count badge
- Loading skeletons + empty state
- `topicIntelligenceService` in `apps/portal/src/features/google/topic-intelligence.service.ts`

**Design fix (2026-11-18):** `mt-5` added to TopicIntelligenceSection GlassCard — no-gap spacing between Profile Views · Daily chart card and Topic Intelligence card is now resolved.

## Mobile layout fixes — 2026-11-18

**Brand Brain Step 6 — Location Overrides:**
- Fixed horizontal overflow on mobile: outer container changed from `flex gap-5` to `flex flex-col md:flex-row gap-5`
- Location sidebar: `w-64 flex-shrink-0 space-y-1` → `flex flex-row md:flex-col gap-2 md:gap-1 overflow-x-auto pb-2 md:pb-0 flex-shrink-0 md:w-64`
- Each location button now `flex-shrink-0 min-w-[160px] md:min-w-0 md:w-full` so the list scrolls horizontally on mobile and stacks vertically on desktop

**Settings — Integrations tab (Google Business Profile row):**
- Fixed cramped button layout on mobile: outer row changed from `flex items-center justify-between` to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`
- Right-side button container gets `flex-shrink-0` to prevent compression at any width
- Google icon gets `flex-shrink-0` to prevent it from collapsing

## Monthly AI Digest — 2026-11-18
**IMPLEMENTED + DEPLOYED** ✅

**DB migration applied (`kgttncfkzdrgswfkkdji`) — `20261118000002_monthly_digests`:**
- `monthly_digests` table: id, org_id, month (TEXT 'YYYY-MM'), review_count, avg_rating, avg_rating_prev, reply_rate, pending_count, rating_dist (JSONB), top_topics (JSONB), summary_text, insights_html, action_items (JSONB), email_subject, sent_at, sent_to (JSONB), generated_at
- UNIQUE(org_id, month) constraint
- Index `idx_monthly_digests_org_month` on (org_id, month DESC)
- RLS: org members can SELECT their own rows via org_members join
- pg_cron job `monthly-digest-job`: runs `0 8 1 * *` (UTC), calls `generate-monthly-digest` edge function via `net.http_post` with `x-cron-secret` header from `current_setting('app.cron_secret', true)`

**Edge Function:**
- `generate-monthly-digest` v4 (ACTIVE, `verify_jwt: false`) — deployed via Supabase MCP 2026-11-18
- Dual auth: `x-cron-secret` header for pg_cron, user JWT for manual portal trigger
- Cron mode: processes all active orgs in sequence
- User mode: resolves org_id via org_members, processes single org
- For each org: traverses full location chain `org_members → google_connections (via user_id) → google_locations (via connection_id)` to get locationIds, fetches this-month + prev-month reviews via `location_id IN (locationIds)`, computes avgRating/replyRate/pendingCount/ratingDist, aggregates top 5 topics from `review_topics`, calls Gemini 2.0 Flash (falls back to 1.5 Flash) for JSON summary/insights/actions, builds full inline-CSS HTML email, upserts to `monthly_digests`, fetches org member emails via `supabase.auth.admin.getUserById()` (profiles has no email column), sends via Resend from `notifications@moffu.pro`, updates `sent_at` + `sent_to`
- **Bug fixes (v3):** reviews queried via `location_id IN (org's locations)` not `.eq('org_id')`; email fetched from `auth.users` admin API not `profiles.email`; December monthEnd calculation fixed
- **Bug fix (v4):** `google_locations` has no `org_id` column — v3 `.eq('org_id', orgId)` on `google_locations` returned empty array causing silent early return with `{"ok":true}`; fixed to traverse full chain via `connection_id` from `google_connections`

**Portal UI (`/digest`):**
- `DigestPage` with collapsible `DigestCard` per month, `RatingBar` distribution component
- Month selector (last 12 months) + "Generate & email digest" button with loading state
- Empty state with generate CTA; auto-expands first digest on load
- Shows: summary, 4-col stats grid, rating distribution bars, topics list, AI insights, action items, sent status
- Route `/digest` added to `App.tsx`; "Monthly Digest" nav item added to Overview RAIL_GROUPS in `DashboardLayout.tsx`

**TypeScript**: portal typecheck passes (`tsc --noEmit` clean)

**Pending configuration:**
- `CRON_SECRET` must be set via `supabase secrets set CRON_SECRET=<value>`
- `app.cron_secret` DB setting must be set via `ALTER DATABASE postgres SET app.cron_secret = '<same value>'` so pg_cron can read it
- `GEMINI_API_KEY` and `RESEND_API_KEY` must already be set as Supabase secrets (confirmed by user)

## Transactional Email System v2 — 2026-11-18
**IMPLEMENTED + DEPLOYED** ✅

**DB migration applied (`kgttncfkzdrgswfkkdji`) — `20261118000003_email_sequences`:**
- `email_sequences` table: id, user_id (FK auth.users), sequence_type TEXT, sent_at TIMESTAMPTZ, metadata JSONB — UNIQUE(user_id, sequence_type); RLS denies all authenticated access (service role only)
- `trigger_first_review_email()` PL/pgSQL function: fires on `reviews` INSERT, calls `send-first-review-email` edge function via `net.http_post` with `x-webhook-secret: moffu-first-review-2026`; passes user_id, location_id, review_id, reviewer_name, rating, body
- `on_review_created_first_review_email` trigger on `public.reviews` AFTER INSERT
- `cron_send_onboarding_emails()` function: called by pg_cron; calls `send-onboarding-emails` edge function via `net.http_post` with `x-webhook-secret: moffu-onboarding-cron-2026`
- pg_cron job `send-onboarding-emails`: runs `30 * * * *` (every hour at :30), calls `cron_send_onboarding_emails()`

**Edge Functions deployed (all ACTIVE, `verify_jwt: false`):**
- `welcome-email` v4: **rewritten** — now fetches user's active subscription + plan from DB (service role); shows real plan name + feature list from `plans.features`; flat professional design; primary CTA: "Connect Google Business"; secondary: dashboard link
- `send-onboarding-emails` v1 (new): 24h Google connect reminder — finds users 23-25h old with no `google_connections` and no `google_connect_reminder` email_sequences row; sends reminder email with flat design + CTA; inserts into email_sequences for deduplication
- `send-first-review-email` v1 (new): Gen Z first-review celebration — deduplicates via email_sequences; traverses full location chain to count total reviews; only sends if count == 1; fetches user email via auth admin API; casual Gen Z tone ("no way. you got your first review.", "it's giving growth era", "go reply before they forget about you"); shows reviewer name + star rating + review snippet in card

**Pending configuration (Supabase secrets):**
- `FIRST_REVIEW_WEBHOOK_SECRET` = `moffu-first-review-2026` — set via Supabase dashboard Secrets or CLI
- `ONBOARDING_CRON_SECRET` = `moffu-onboarding-cron-2026` — set via Supabase dashboard Secrets or CLI
- (Both secrets are hardcoded in migration SQL triggers for now; without matching env vars the edge functions will accept all requests — set them to enforce security)

## Google Profile competitor Places API incident — 2026-11-19
**Root cause confirmed from production logs:**
- The portal showed “Places API not enabled” while the Google Cloud project had Places API (New) enabled. Supabase logs showed Google's exact response: the function was calling a legacy API that was not enabled for the project.
- Production `google-competitors` v5 still called Legacy Nearby Search (`maps.googleapis.com/maps/api/place/nearbysearch/json`). The repository already had the Places API (New) Text Search implementation, but it had not been deployed to production.

**Fixes deployed:**
- Deployed `google-competitors` v6 using `POST https://places.googleapis.com/v1/places:searchText`; verified the active source no longer calls the legacy endpoint.
- The first v6 request then showed `location_not_found`. Production schema inspection found that `google_locations` has `description`, `latitude`, and `longitude`, but no `category` column. The function selected the nonexistent column and ignored the query error, incorrectly returning `location_not_found`.
- Updated the function to query only columns present in the production schema, use `description` (the synced GBP primary category) as its search term, and return `location_lookup_failed` when the database query itself errors.
- Deployed `google-competitors` v7 (ACTIVE). No migration or Legacy Places API enablement is needed for these fixes.
- Commit `35a02dc` (`fix(edge-fn): use existing location category field`) was pushed to `origin/main`.

**Verification and remaining check:**
- Confirmed the production table schema and verified the deployed v7 source uses Places API (New), selects `description` rather than `category`, and handles location query errors separately.
- A successful authenticated competitor response after v7 has not yet been observed. Refresh the Google Profile page and verify; if the warning persists, use the new warning (`location_lookup_failed`, `no_coordinates`, or `no_category`) to narrow the next check.

## Google Search Console + GA4 SEO & Leads — 2026-11-19
**IMPLEMENTED + DEPLOYED** ✅

- Added a separate read-only Google OAuth flow for Search Console and GA4; existing Google Business Profile OAuth tokens and setup flow remain separate.
- Portal page `/google-growth` is linked as **SEO & Leads** in the dashboard and Settings. It supports choosing a Search Console property and GA4 property, then compares 28/90-day clicks, impressions, CTR, average web Search position, Google organic sessions/users, and GA4 conversions against the preceding period. Search queries are shown with clicks/impressions/CTR/average position. The UI clarifies that Search Console position is website Search ranking, not Maps ranking, and GA4 conversions require configured key events.
- Applied Supabase migration `20261119170341_google_growth_connections`: per-user OAuth/property storage, RLS enabled, no client/anon/public grants; service-role Edge Function only.
- Deployed `google-growth` v1 (manual user-token validation; `verify_jwt=false` because Supabase's gateway rejects the app's auth flow before the handler) and updated `google-oauth-callback` v51 while retaining its existing `verify_jwt=true` setting.
- Verification: portal TypeScript typecheck passed; `git diff --check` clean; live preflight returned 204 with CORS headers; unauthenticated POST returned 401. Actual Google account/property/report flow is pending Google Cloud API and OAuth consent configuration.

**Required Google Cloud setup before customer connection:** enable Google Search Console API (`webmasters.googleapis.com`), Google Analytics Admin API (`analyticsadmin.googleapis.com`), and Google Analytics Data API (`analyticsdata.googleapis.com`) for the OAuth client project. Ensure the OAuth consent screen allows the signed-in account and includes the `webmasters.readonly` and `analytics.readonly` scopes. No Maps ranking or Google Business Profile performance metric is represented by this page.
