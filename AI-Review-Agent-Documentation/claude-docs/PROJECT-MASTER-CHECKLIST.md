# Project Master Checklist

The master checklist is durable project memory. Claude updates statuses only after verifying actual implementation.

| ID | Requirement | Status | Depends on | Evidence |
|---|---|---|---|---|
| CORE-001 | Three web surfaces and routing boundaries | IMPLEMENTED | - | apps/web (Next.js), apps/portal (Vite/React), apps/admin (Vite/React) scaffolded with separate routing |
| CORE-002 | Shared provider-independent backend/service architecture | IN_PROGRESS | - | packages/types (shared DTOs), packages/config, auth service abstraction in portal/admin. DB + API services pending. |
| CORE-003 | No Dead UI | IN_PROGRESS | - | Auth pages fully wired. Placeholder dashboard pages clearly marked, not presented as real features. |
| CORE-004 | Human reference IDs | IMPLEMENTED | - | migration 000001: `ref_id_sequences` table, `next_ref_id()` function; used in profiles/orgs/invitations |
| CORE-005 | Environment separation | IMPLEMENTED | - | .env.example in all 3 apps; variable names only; requireEnv() startup validation; secrets never committed |
| AUTH-001 | Signup | IMPLEMENTED | Supabase credentials | apps/portal/src/features/auth/pages/SignupPage.tsx; authService.signup(); profile auto-created via DB trigger |
| AUTH-002 | Email verification/resend | IMPLEMENTED | Supabase credentials | VerifyEmailPage.tsx + authService.resendVerification(); PKCE flow with detectSessionInUrl |
| AUTH-003 | Login | IMPLEMENTED | Supabase credentials | LoginPage.tsx + authService.login(); error normalization (no credential leakage) |
| AUTH-004 | Forgot/reset password | IMPLEMENTED | Supabase credentials | ForgotPasswordPage.tsx + ResetPasswordPage.tsx; email enumeration protection (always returns success) |
| AUTH-005 | Session refresh/logout | IMPLEMENTED | Supabase credentials | auth.store.ts onAuthStateChange listener; authService.logout(); autoRefreshToken=true |
| AUTH-006 | Suspended state | PENDING | - | user_status enum in DB, not yet checked in auth flow |
| AUTH-007 | Profile/security | PENDING | - | profiles table exists; update profile UI not yet built |
| AUTH-008 | Invitation acceptance | PENDING | - | invitations table exists; acceptance flow not yet built |
| RBAC-001 | Customer roles/custom roles | IMPLEMENTED | - | migration 000004: role_permissions, user_permission_overrides, has_permission() |
| RBAC-002 | Platform roles/custom roles | IMPLEMENTED | - | migration 000004: platform_members table, platform_role enum; admin auth store checks platform_members |
| RBAC-003 | Permission overrides/deny wins | IMPLEMENTED | - | migration 000004: has_permission() implements deny-wins logic with location scoping |
| RBAC-004 | Region/org/location scopes | IN_PROGRESS | - | scope_location_id in overrides; full location table pending Phase 4 |
| RBAC-005 | Sole owner/final super admin protection | IMPLEMENTED | - | migration 000003: check_sole_owner() trigger; migration 000004: check_last_super_admin() trigger |
| RBAC-006 | RLS isolation tests | PENDING | Docker/Supabase creds | RLS policies written; tests not yet run — blocked on Supabase setup |
| RBAC-007 | Impersonation controls | PENDING | - | Pending Phase 7 admin work |
| ONBOARD-001 | Create org | IMPLEMENTED | AUTH-001 | `create_organization` RPC (migration 009); OnboardingPage Step 1 — name + slug; slug uniqueness error handled |
| ONBOARD-002 | Country/timezone | IMPLEMENTED | ONBOARD-001 | `update_org_location` RPC; OnboardingPage Step 2 — country from DB, tz auto-detected from browser; skippable |
| ONBOARD-003 | Google connect | IMPLEMENTED | - | OnboardingPage Step 3 — Connect Google button; sessionStorage flag routes callback back to /onboard?connected=1 |
| ONBOARD-004 | Location selection | PENDING | ONBOARD-003 | Locations shown in SettingsPage; dedicated onboarding step TBD |
| ONBOARD-005 | Brand Brain steps | PENDING | - | BrandBrainPage exists at /brand-brain; dedicated onboarding step TBD |
| ONBOARD-006 | Synthetic Test Agent | PENDING | - | FUTURE |
| ONBOARD-007 | Server-derived READY | IMPLEMENTED | - | `complete_onboarding` RPC sets org.status='active'; called on Step 4 Done |
| ONBOARD-008 | Resume incomplete onboarding | IMPLEMENTED | - | OnboardingGuard checks org_members; users with no org always land at /onboard; org_id persisted in sessionStorage across OAuth redirect |
| GOOGLE-001 | OAuth state/PKCE | IMPLEMENTED | - | `google-oauth-start` edge function v7 — generates state, returns Google auth URL; `GoogleCallbackPage` handles redirect |
| GOOGLE-002 | Secure token storage | IMPLEMENTED | - | `google_connection_tokens` table; service-role only (no authenticated RLS policy); stored server-side in edge function only |
| GOOGLE-003 | Accounts/locations fetch | IMPLEMENTED | - | `google-oauth-callback` v4 — exchanges code, fetches GBP locations, inserts into `google_locations` |
| GOOGLE-004 | Explicit location mapping | IMPLEMENTED | - | `google_locations.is_selected` toggle in SettingsPage; only selected locations propagate to Reviews/Insights/sidebar |
| GOOGLE-005 | Initial sync | IMPLEMENTED | - | `google-sync-reviews` v4 edge function; "Sync now" button in SettingsPage |
| GOOGLE-006 | Connection health | IMPLEMENTED | - | `google_connections` state machine: PENDING/CONNECTED/REFRESH_FAILED/REVOKED/DISCONNECTED/ERROR; shown in SettingsPage |
| GOOGLE-007 | Reconnect | IMPLEMENTED | - | Re-running OAuth flow reconnects; status resets to CONNECTED |
| GOOGLE-008 | Disconnect/revoke cleanup | IMPLEMENTED | - | `google-disconnect` v4 — revokes Google token, sets DISCONNECTED, clears is_selected |
| GOOGLE-009 | Quota/backoff | PENDING | - | Retry/backoff logic not yet added to edge functions |
| GOOGLE-010 | Ambiguous write reconciliation | PENDING | - | - |
| REVIEWS-001 | Inbox filters/pagination | IMPLEMENTED | - | ReviewsPage: filter tabs (All/Pending/Draft Ready/Replied), star filter, date range, search; scoped to is_selected locations |
| REVIEWS-002 | Review detail | IMPLEMENTED | - | Review cards with reviewer name, rating stars, date, review text, location label |
| REVIEWS-003 | Generate draft | IMPLEMENTED | - | "Generate Draft" button → `ai-generate-draft` edge function → populates editable textarea; records ai_draft usage event |
| REVIEWS-004 | Regenerate/version | PENDING | - | Single draft only; no version history yet |
| REVIEWS-005 | Edit draft | IMPLEMENTED | - | Editable textarea pre-filled with AI draft; user can modify before approving |
| REVIEWS-006 | Approve exact version | IMPLEMENTED | - | "Approve & Publish" button sends current textarea value to `google-publish-reply` |
| REVIEWS-007 | Publish checks | IMPLEMENTED | - | `google-publish-reply` v4 — idempotent, checks review status before writing; records published_reply usage event |
| REVIEWS-008 | Stale handling | PENDING | - | - |
| REVIEWS-009 | Needs Attention | PENDING | - | - |
| REVIEWS-010 | Existing Google reply handling | PENDING | - | - |
| REVIEWS-011 | Direct Google edits win | PENDING | - | - |
| REVIEWS-012 | History/provider merge | PENDING | - | - |
| AI-001 | Provider abstraction | IMPLEMENTED | - | Gemini API via `ai-generate-draft` edge function; `GEMINI_API_KEY` in Supabase secrets; locked: D-015 |
| AI-002 | Context builder | IMPLEMENTED | - | Edge function assembles: review text + star rating + brand_brain (tone, length, language, prohibited phrases, example reply) |
| AI-003 | Language detection | IN_PROGRESS | - | Gemini instructed to match reviewer language; explicit detection/fallback logic not separately implemented |
| AI-004 | Risk classifier | PENDING | - | - |
| AI-005 | Brand Brain load | IMPLEMENTED | - | Edge function fetches brand_brain row for auth user before building prompt |
| AI-006 | Structured output | IMPLEMENTED | - | Draft text returned as JSON `{ draft: string }`; stored in `reviews.ai_draft` |
| AI-007 | Schema validator | PENDING | - | No explicit Zod/JSON schema validation on AI output yet |
| AI-008 | Promise/hallucination guard | PENDING | - | - |
| AI-009 | Repetition guard | PENDING | - | - |
| AI-010 | Preference confirmation | PENDING | - | - |
| AI-011 | Roman Urdu/mixed language | PENDING | - | - |
| AI-012 | Telemetry minimization | PENDING | - | - |
| CUSTOMER-001 | Dashboard | IN_PROGRESS | AUTH-001 | OverviewPage exists with stat cards; wired to real review data via activeReviews. Full reports/charts TBD Phase 7 |
| CUSTOMER-002 | Reviews navigation | IMPLEMENTED | - | ReviewsPage at `/reviews` — filter tabs, search, star/date filters, AI draft, publish flow |
| CUSTOMER-003 | Brand Brain pages | IMPLEMENTED | - | BrandBrainPage at `/brand-brain` — full settings form, save/load via brandBrain.service.ts |
| CUSTOMER-004 | Locations | IMPLEMENTED | - | Location toggles in SettingsPage (is_selected); global location store (Zustand); sidebar selector for 2+ locations |
| CUSTOMER-005 | Reports | PENDING | - | InsightsPage exists with keyword/sentiment analysis; formal Reports section TBD |
| CUSTOMER-006 | Team | PENDING | - | Team seats meter shown in BillingPage; invite/manage team UI TBD Phase 7 |
| CUSTOMER-007 | Billing | IN_PROGRESS | - | BillingPage at `/billing` — plan cards, usage meters, history chart, add-on UI, compare modal. Stripe integration pending |
| CUSTOMER-008 | Integrations | IMPLEMENTED | - | SettingsPage — Google OAuth connect/disconnect, location toggles, sync now |
| CUSTOMER-009 | Notifications | PENDING | - | - |
| CUSTOMER-010 | Organization settings | PENDING | - | - |
| CUSTOMER-011 | Profile/security | PENDING | - | - |
| CUSTOMER-012 | Privacy/data | PENDING | - | - |
| CUSTOMER-013 | Support | PENDING | - | - |
| ADMIN-001 | Action dashboard | IMPLEMENTED | - | `DashboardPage` — real KPIs (total orgs, users, active subs, MRR, reviews, AI drafts, Google connections), daily/monthly charts, plan distribution bar, top orgs table, live audit feed; DateRangePicker wired |
| ADMIN-002 | Global search | IMPLEMENTED | - | AdminLayout topbar search — debounced 280ms, queries `organizations` + `profiles`, navigates to `/clients/:id` or `/users/:id`; Cmd+K shortcut |
| ADMIN-003 | Org 360 | IMPLEMENTED | - | `ClientDetailPage` — org info, subscription + plan badge + Promo badge, member list with roles, impersonate button per member, Google connection status, usage stats |
| ADMIN-004 | User management | IMPLEMENTED | - | `PlatformMembersPage` (list + invite + bulk delete) + `TeamMemberDetailPage` (role, activity, permissions); `admin-create-user` + `admin-delete-member` Edge Functions; owner role has full super_admin permissions |
| ADMIN-005 | Restrictions | IMPLEMENTED | - | Org suspension: `ClientDetailPage` + `ClientsPage` — confirmation modal with reason dropdown (payment_issue/policy_violation/fraud_suspicion/spam_abuse/account_request/other) + optional note; inserts `audit_events` row on suspend and reactivate |
| ADMIN-006 | Internal notes | REMOVED | - | Deliberately removed from product scope |
| ADMIN-007 | Impersonation | IMPLEMENTED | - | `ClientDetailPage` "Impersonate" button per member → `admin-impersonate` Edge Function → magic link → opens portal in new tab; audit logged |
| ADMIN-008 | Google troubleshooting | IMPLEMENTED | - | `IntegrationsHealthPage` — per-org Google connection status, error states, last sync timestamps |
| ADMIN-009 | AI activity | IMPLEMENTED | - | `UsagePage` — AI draft + reply usage per org, date range filter, plan breakdown |
| ADMIN-010 | System health | IMPLEMENTED | - | `IntegrationsHealthPage` covers Google/integration health; `ReportsPage` for broader analytics |
| ADMIN-011 | Logs/audit | IMPLEMENTED | - | `AuditPage` — full audit_events table, actor/action/target columns, date + action filters, pagination |
| ADMIN-012 | Refund workflow | IMPLEMENTED | - | `RefundsPage` — refund list with status badges; `PaymentsPage` — payment history; both wired to Paddle data |
| ADMIN-013 | Regions/countries/currencies | REMOVED | - | USD-only globally for V1 and beyond. Paddle handles currency conversion. Reference tables in DB are unused and will remain so. No admin UI needed. |
| ADMIN-014 | Feature/config controls | IMPLEMENTED | - | `FeatureFlagsPage` — create/toggle/delete feature flags per org or globally; owner/super_admin only |
| BILLING-001 | Versioned plans | IMPLEMENTED | - | `plans` table seeded: Free/Starter/Growth/Scale; migration 008 applied to `kgttncfkzdrgswfkkdji` |
| BILLING-002 | Versioned prices | IMPLEMENTED | - | `plan_prices`: monthly + annual per plan; USD only V1 |
| BILLING-003 | Entitlements | IMPLEMENTED | - | `plan_entitlements`: LIMIT/UNLIMITED/BOOLEAN/ENUM per plan; usage_reset weekly (Free) or monthly (paid). D-014 runtime-verified via billingService.getUsage() |
| BILLING-004 | Add-on catalog | IMPLEMENTED | - | `plan_location_addons`: Starter $5/loc, Growth $10/loc, Scale $15/loc |
| BILLING-005 | Add-on quantities | IMPLEMENTED | - | `subscription_addons` table with quantity column; UI shows line items + add location dialog |
| BILLING-006 | Effective entitlement service | IMPLEMENTED | - | `billingService.checkLimit()` — period window + usage_events count vs plan entitlement; `recordUsage()` inserts events |
| BILLING-007 | Checkout server validation | IMPLEMENTED | - | `_shared/billing.ts` — `checkAndRecordUsage()` checks entitlement before Gemini/Google calls; records usage after success; returns 429 on limit exceeded; client-side `recordUsage()` calls removed (server-side is authoritative); deployed v17/v13 |
| BILLING-008 | Verified webhooks | IMPLEMENTED | - | `paddle-webhook` edge function — HMAC-SHA256 signature verification; handles `subscription.*`, `transaction.completed`, `transaction.payment_failed` |
| BILLING-009 | Subscription lifecycle | PENDING | - | Upgrade/downgrade flows pending Paddle live approval |
| BILLING-010 | Invoices/payments | PENDING | - | - |
| BILLING-011 | Payment recovery | IMPLEMENTED | - | `paddle-webhook` `transaction.payment_failed` handler: increments `payment_failure_count`; sends warning email (attempts 1-2); auto-suspends org + sends suspended email (attempt 3); resets count on `transaction.completed` |
| BILLING-012 | Upgrade/downgrade | PENDING | - | - |
| BILLING-013 | Cancellation/reactivation | PENDING | - | - |
| BILLING-014 | Refund reconciliation | PENDING | - | - |
| BILLING-015 | Tax adapter | PENDING | - | TBD: tax/GST treatment not decided |
| BILLING-016 | Historical price/FX snapshots | PENDING | - | - |
| JOB-001 | Durable queue | PENDING | - | - |
| JOB-002 | Leases/idempotency | PENDING | - | - |
| JOB-003 | Retry/backoff | PENDING | - | - |
| JOB-004 | Dead-letter | PENDING | - | - |
| JOB-005 | Google sync jobs | PENDING | - | - |
| JOB-006 | AI async jobs | PENDING | - | - |
| JOB-007 | Notification dispatch | PENDING | - | - |
| JOB-008 | Email dispatch | PENDING | - | - |
| JOB-009 | Cleanup jobs | PENDING | - | - |
| JOB-010 | Usage aggregation | PENDING | - | - |
| JOB-011 | Fair throttling | PENDING | - | - |
| EMAIL-001 | Resend adapter | IMPLEMENTED | - | Resend API used in `paddle-webhook`, `ai-generate-draft`, `google-sync-reviews`, `feedback-send-email` — all from `notifications@moffu.pro`; `RESEND_API_KEY` set in Supabase secrets |
| EMAIL-002 | Template versions/locales | PENDING | - | - |
| EMAIL-003 | Recipient permission recheck | PENDING | - | - |
| EMAIL-004 | Delivery webhooks | PENDING | - | - |
| EMAIL-005 | Bounce/suppression | PENDING | - | - |
| EMAIL-006 | Transactional vs marketing separation | PENDING | - | - |
| STORAGE-001 | Storage adapter | PENDING | - | - |
| STORAGE-002 | Upload intent/validation | PENDING | - | - |
| STORAGE-003 | Private signed downloads | PENDING | - | - |
| STORAGE-004 | Purpose allowlists | PENDING | - | - |
| STORAGE-005 | Quota integration | PENDING | - | - |
| STORAGE-006 | Orphan/expiry cleanup | PENDING | - | - |
| STORAGE-007 | Scanner-ready states | PENDING | - | - |
| STORAGE-008 | CSV injection mitigation | PENDING | - | - |
| SUPPORT-001 | Help Center | PENDING | - | - |
| SUPPORT-002 | Ticket creation | PENDING | - | - |
| SUPPORT-003 | Conversation/replies | PENDING | - | - |
| SUPPORT-004 | Private attachments | PENDING | - | - |
| SUPPORT-005 | Internal notes | PENDING | - | - |
| SUPPORT-006 | Assignment | PENDING | - | - |
| SUPPORT-007 | Notifications | PENDING | - | - |
| SUPPORT-008 | Customer/Admin navigation | PENDING | - | - |
| PRIVACY-001 | Privacy request center | PENDING | - | - |
| PRIVACY-002 | Jurisdiction engine | PENDING | - | - |
| PRIVACY-003 | Identity/authority verification | PENDING | - | - |
| PRIVACY-004 | Privacy export | PENDING | - | - |
| PRIVACY-005 | Deletion/de-identification | PENDING | - | - |
| PRIVACY-006 | Provider reconciliation | PENDING | - | - |
| PRIVACY-007 | Deletion ledger | PENDING | - | - |
| PRIVACY-008 | Legal holds | PENDING | - | - |
| PRIVACY-009 | Data inventory/subprocessors | PENDING | - | - |
| PRIVACY-010 | Privacy incident assessment | PENDING | - | - |
| LEGAL-001 | Versioned Terms/Privacy/Cookies | PENDING | - | LEGAL_REVIEW_REQUIRED |
| LEGAL-002 | Legal acceptances | PENDING | - | - |
| LEGAL-003 | Material update/reacceptance rules | PENDING | - | - |
| LEGAL-004 | Cookie consent preferences | PENDING | - | - |
| LEGAL-005 | Tracking inventory | PENDING | - | - |
| LEGAL-006 | GPC/privacy signals | PENDING | - | - |
| LEGAL-007 | Subprocessor truthfulness | PENDING | - | - |
| ANALYTICS-001 | Metric registry | PENDING | - | - |
| ANALYTICS-002 | Reputation reports | PENDING | - | - |
| ANALYTICS-003 | Product event catalog | PENDING | - | - |
| ANALYTICS-004 | PostHog abstraction | PENDING | - | TBD: PostHog project not yet provisioned |
| ANALYTICS-005 | Revenue metrics source | PENDING | - | - |
| ANALYTICS-006 | Report exports | PENDING | - | - |
| ANALYTICS-007 | Timezone-aware aggregation | PENDING | - | - |
| ANALYTICS-008 | Data-quality/freshness | PENDING | - | - |
| ANALYTICS-009 | No session replay V1 | PENDING | - | - |
| RATE-001 | Rate policy registry | PENDING | - | - |
| RATE-002 | Distributed atomic counters | PENDING | - | - |
| RATE-003 | Auth abuse limits | PENDING | - | - |
| RATE-004 | AI limits/concurrency | PENDING | - | TBD: exact quota numbers not decided |
| RATE-005 | Google provider throttles | PENDING | - | - |
| RATE-006 | Billing/refund protection | PENDING | - | - |
| RATE-007 | Email/export/storage limits | PENDING | - | - |
| RATE-008 | Temporary overrides | PENDING | - | - |
| RATE-009 | Usage reserve/commit/release | PENDING | - | - |
| RATE-010 | Budget guardrails | PENDING | - | - |
| I18N-001 | Translation catalogs | PENDING | - | TBD: launch locales not decided |
| I18N-002 | Locale fallback | PENDING | - | - |
| I18N-003 | BCP47/IANA handling | PENDING | - | - |
| I18N-004 | AI reply language separation | PENDING | - | - |
| I18N-005 | Localized email/notifications | PENDING | - | - |
| I18N-006 | Legal/help localization | PENDING | - | - |
| I18N-007 | Intl date/number/currency | PENDING | - | - |
| I18N-008 | Unicode | PENDING | - | - |
| I18N-009 | RTL readiness | PENDING | - | - |
| I18N-010 | Translation QA | PENDING | - | - |
| RESP-001 | Mobile customer critical flows | PENDING | - | Auth pages use responsive layout; not yet QA'd |
| RESP-002 | Responsive admin safety | PENDING | - | - |
| RESP-003 | Mobile review list/detail | PENDING | - | - |
| RESP-004 | Responsive tables | PENDING | - | - |
| RESP-005 | Mobile date picker | PENDING | - | - |
| RESP-006 | Touch/keyboard/accessibility | PENDING | - | - |
| RESP-007 | No fake PWA/native/push | PENDING | - | Confirmed: no PWA/push in scaffold |
| RESP-008 | Responsive QA matrix | PENDING | - | - |
| SEO-001 | SSR/SSG public pages | PENDING | - | Next.js configured; no real content yet |
| SEO-002 | Metadata/canonical/sitemap/robots | PENDING | - | robots: noindex set for dev; real sitemap/metadata TBD |
| SEO-003 | Schema/breadcrumbs | PENDING | - | - |
| SEO-004 | Product/feature/solution pages | PENDING | - | TBD: brand name/copy not decided |
| SEO-005 | Server-driven pricing | PENDING | - | TBD: pricing not decided |
| SEO-006 | Blog/help architecture | PENDING | - | - |
| SEO-007 | Core Web Vitals | PENDING | - | - |
| SEO-008 | No fake claims/thin pages | PENDING | - | Homepage placeholder explicitly marked as dev-only |
| UI-001 | #0D4C3C tokens | IMPLEMENTED | - | packages/ui/src/tokens/index.ts; Tailwind config in all 3 apps |
| UI-002 | No pills/emojis/AI aesthetic | IMPLEMENTED | - | No pill radius in config; no emoji icons; no AI gradient/orb/sparkle |
| UI-003 | Shared primitives | IMPLEMENTED | - | packages/ui: Button, Input, Label, Alert with correct design language |
| UI-004 | Airline filters | PENDING | - | - |
| UI-005 | DateRangePicker | PENDING | - | - |
| UI-006 | Loading/empty/error states | IN_PROGRESS | - | Auth pages have loading/error states; broader implementation pending |
| UI-007 | Motion/reduced motion | IMPLEMENTED | - | prefers-reduced-motion CSS in all apps; purposeful transition-duration-150 on Button |
| UI-008 | Visual regression | PENDING | - | - |
| UI-009 | Responsive/accessibility | PENDING | - | aria-invalid, aria-disabled, sr-only used; full QA pending |
| BACKUP-001 | Retention policy matrix | PENDING | - | TBD: retention periods not decided |
| BACKUP-002 | Provider-derived cache cleanup | PENDING | - | - |
| BACKUP-003 | DB backup verification | PENDING | - | REQUIRES EXTERNAL SETUP: Supabase backup/PITR config |
| BACKUP-004 | Object storage backup verification | PENDING | - | - |
| BACKUP-005 | Secret recovery separation | PENDING | - | - |
| BACKUP-006 | Deletion ledger replay | PENDING | - | - |
| BACKUP-007 | Restore runbook | PENDING | - | - |
| BACKUP-008 | External side-effect reconciliation | PENDING | - | - |
| BACKUP-009 | Restore tests | PENDING | - | - |
| BACKUP-010 | Backup health monitoring | PENDING | - | - |
| BACKUP-011 | RPO/RTO documentation | PENDING | - | TBD: RPO/RTO not decided |
| TEST-001 | Static checks | TESTED | - | `pnpm typecheck` passed 6/6 packages 2026-10-09. `npx tsc --noEmit` passes clean on apps/portal as of 2026-10-11 (Phase 6 billing code included). |
| TEST-002 | Unit tests | PENDING | - | - |
| TEST-003 | API contracts | PENDING | - | - |
| TEST-004 | RLS/tenant tests | PENDING | Docker/Supabase | Migrations written; tests blocked on Supabase local stack |
| TEST-005 | Provider integration mocks | PENDING | - | - |
| TEST-006 | Billing tamper/concurrency | PENDING | - | - |
| TEST-007 | AI adversarial tests | PENDING | - | - |
| TEST-008 | Playwright E2E | PENDING | - | - |
| TEST-009 | Visual regression | PENDING | - | - |
| TEST-010 | Accessibility/responsive tests | PENDING | - | - |
| TEST-011 | CI gates | PENDING | - | - |
| DEPLOY-001 | Migrations as code | IMPLEMENTED | - | supabase/migrations/ — 8 migration files; 001–008 applied to `kgttncfkzdrgswfkkdji`; 006 brand_brain, 007 google/reviews, 008 billing |
| DEPLOY-002 | Staging/production promotion | PENDING | - | - |
| DEPLOY-003 | Secrets/env validation | IMPLEMENTED | - | requireEnv() in portal/admin lib/env.ts; .env.example in all apps |
| DEPLOY-004 | Observability | PENDING | - | - |
| DEPLOY-005 | System Health | PENDING | - | - |
| DEPLOY-006 | Rollback/degraded mode | PENDING | - | - |
| DEPLOY-007 | Documentation/status accuracy | IMPLEMENTED | - | This checklist and PROJECT-STATUS.md updated with evidence |

## Status rules
Allowed: PENDING, IN_PROGRESS, IMPLEMENTED, TESTED, CONFIGURED, COMPLETED, BLOCKED, REQUIRES_EXTERNAL_APPROVAL, LEGAL_REVIEW_REQUIRED, FUTURE, NOT_APPLICABLE (reason required). Never remove completed history; supersede explicitly. Before declaring a domain complete, search all child requirements and hard rules and verify applicable completion gates.
