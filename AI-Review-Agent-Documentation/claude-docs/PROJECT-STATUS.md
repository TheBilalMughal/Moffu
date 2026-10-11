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
**COMPLETE** ✅

**Edge function:** `ai-generate-draft` (Supabase, ACTIVE)
- Loads brand_brain profile for authenticated user
- Builds context: review text + rating + brand tone/language/reply settings
- Calls Gemini API (`GEMINI_API_KEY` set in Supabase secrets)
- Returns structured draft text; stored on `reviews.ai_draft`

**Portal UI:** ReviewsPage — "Generate Draft" button calls edge function, populates editable textarea; "Approve & Publish" calls `google-publish-reply`

**Usage tracking:** `billingService.recordUsage('ai_draft')` called after successful draft generation; `recordUsage('published_reply')` after successful publish.

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
- Server-side limit enforcement in `ai-generate-draft` + `google-publish-reply` edge functions
- Stripe Checkout, webhooks, subscription lifecycle, invoices, upgrade/downgrade flow

## Phase 7 — Admin Portal
- Internal platform management
- Depends on core feature set being stable

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
