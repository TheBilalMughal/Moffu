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

## Phase 6 — Billing & Subscription (Stripe)
**PARTIAL** — schema + UI + client-side usage tracking COMPLETE; Stripe + server-side enforcement PENDING

**DB migration 008 applied (`kgttncfkzdrgswfkkdji`):**
- `plans` — Free / Starter / Growth / Scale (seeded)
- `plan_prices` — monthly + annual prices per plan (USD)
- `plan_entitlements` — LIMIT / UNLIMITED / BOOLEAN / ENUM values with usage_reset cadence
- `plan_location_addons` — $5/$10/$15 per extra location (Starter/Growth/Scale)
- `subscriptions` — one active row per user; trigger auto-assigns Free on signup; existing users backfilled
- `subscription_addons` — extra location add-ons per subscription
- `usage_events` — ai_draft + published_reply events; user-scoped RLS

**Service layer:** `billing.service.ts`
- `getPlans()` — catalog from DB
- `getSubscription()` — user's active subscription + addon_items
- `getUsage()` — period window (7-day rolling for Free, subscription period for paid)
- `getUsageHistory()` — last 30 days grouped by date for chart
- `checkLimit()` — entitlement lookup + usage count
- `recordUsage()` — inserts usage_events row (client-side only)

**Portal BillingPage** (`/billing`):
- Current plan card with team seats meter (1/N)
- Usage meters (AI drafts + replies) with alert banners at ≥80% / ≥90%
- Overage protection toggle (disabled, Stripe pending)
- 14-day usage history bar chart
- Add extra location button → dialog with cost breakdown (disabled confirm)
- Active add-on line items with cancel (disabled)
- Annual savings banner (shown when on monthly paid plan)
- Compare all plans modal — full feature matrix
- Monthly/annual toggle with –20% label
- 4-column plan cards (Scale card dark); upgrade buttons disabled with truthful "coming soon"
- Nav item in DashboardLayout

**Pending (needs Stripe or further work):**
- Server-side limit enforcement in `google-publish-reply` edge function (ai-generate-draft is ✅ done)
- Stripe Checkout, webhooks, subscription lifecycle, invoices, upgrade/downgrade flow

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
