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
| ONBOARD-001 | Create org | PENDING | AUTH-001 | organizations table exists; create-org UI not yet built |
| ONBOARD-002 | Country/timezone | PENDING | ONBOARD-001 | countries/regions tables exist; UI TBD |
| ONBOARD-003 | Google connect | PENDING | - | REQUIRES EXTERNAL SETUP: Google Cloud OAuth not configured |
| ONBOARD-004 | Location selection | PENDING | ONBOARD-003 | - |
| ONBOARD-005 | Brand Brain steps | PENDING | - | - |
| ONBOARD-006 | Synthetic Test Agent | PENDING | - | - |
| ONBOARD-007 | Server-derived READY | PENDING | - | - |
| ONBOARD-008 | Resume incomplete onboarding | PENDING | - | - |
| GOOGLE-001 | OAuth state/PKCE | PENDING | - | REQUIRES EXTERNAL SETUP: Google Cloud project + GBP API access |
| GOOGLE-002 | Secure token storage | PENDING | - | - |
| GOOGLE-003 | Accounts/locations fetch | PENDING | - | - |
| GOOGLE-004 | Explicit location mapping | PENDING | - | - |
| GOOGLE-005 | Initial sync | PENDING | - | - |
| GOOGLE-006 | Connection health | PENDING | - | - |
| GOOGLE-007 | Reconnect | PENDING | - | - |
| GOOGLE-008 | Disconnect/revoke cleanup | PENDING | - | - |
| GOOGLE-009 | Quota/backoff | PENDING | - | - |
| GOOGLE-010 | Ambiguous write reconciliation | PENDING | - | - |
| REVIEWS-001 | Inbox filters/pagination | PENDING | - | - |
| REVIEWS-002 | Review detail | PENDING | - | - |
| REVIEWS-003 | Generate draft | PENDING | - | - |
| REVIEWS-004 | Regenerate/version | PENDING | - | - |
| REVIEWS-005 | Edit draft | PENDING | - | - |
| REVIEWS-006 | Approve exact version | PENDING | - | - |
| REVIEWS-007 | Publish checks | PENDING | - | - |
| REVIEWS-008 | Stale handling | PENDING | - | - |
| REVIEWS-009 | Needs Attention | PENDING | - | - |
| REVIEWS-010 | Existing Google reply handling | PENDING | - | - |
| REVIEWS-011 | Direct Google edits win | PENDING | - | - |
| REVIEWS-012 | History/provider merge | PENDING | - | - |
| AI-001 | Provider abstraction | PENDING | - | TBD: LLM provider selection not locked |
| AI-002 | Context builder | PENDING | - | - |
| AI-003 | Language detection | PENDING | - | - |
| AI-004 | Risk classifier | PENDING | - | - |
| AI-005 | Brand Brain load | PENDING | - | - |
| AI-006 | Structured output | PENDING | - | - |
| AI-007 | Schema validator | PENDING | - | - |
| AI-008 | Promise/hallucination guard | PENDING | - | - |
| AI-009 | Repetition guard | PENDING | - | - |
| AI-010 | Preference confirmation | PENDING | - | - |
| AI-011 | Roman Urdu/mixed language | PENDING | - | - |
| AI-012 | Telemetry minimization | PENDING | - | - |
| CUSTOMER-001 | Dashboard | PENDING | AUTH-001 | Placeholder exists; real dashboard Phase 6 |
| CUSTOMER-002 | Reviews navigation | PENDING | - | - |
| CUSTOMER-003 | Brand Brain pages | PENDING | - | - |
| CUSTOMER-004 | Locations | PENDING | - | - |
| CUSTOMER-005 | Reports | PENDING | - | - |
| CUSTOMER-006 | Team | PENDING | - | - |
| CUSTOMER-007 | Billing | PENDING | - | REQUIRES EXTERNAL SETUP: Stripe not configured; TBD pricing |
| CUSTOMER-008 | Integrations | PENDING | - | - |
| CUSTOMER-009 | Notifications | PENDING | - | - |
| CUSTOMER-010 | Organization settings | PENDING | - | - |
| CUSTOMER-011 | Profile/security | PENDING | - | - |
| CUSTOMER-012 | Privacy/data | PENDING | - | - |
| CUSTOMER-013 | Support | PENDING | - | - |
| ADMIN-001 | Action dashboard | PENDING | - | - |
| ADMIN-002 | Global search | PENDING | - | - |
| ADMIN-003 | Org 360 | PENDING | - | - |
| ADMIN-004 | User management | PENDING | - | - |
| ADMIN-005 | Restrictions | PENDING | - | - |
| ADMIN-006 | Internal notes | PENDING | - | - |
| ADMIN-007 | Impersonation | PENDING | - | - |
| ADMIN-008 | Google troubleshooting | PENDING | - | - |
| ADMIN-009 | AI activity | PENDING | - | - |
| ADMIN-010 | System health | PENDING | - | - |
| ADMIN-011 | Logs/audit | PENDING | - | - |
| ADMIN-012 | Refund workflow | PENDING | - | - |
| ADMIN-013 | Regions/countries/currencies | PENDING | - | Reference tables seeded (all inactive); admin UI TBD |
| ADMIN-014 | Feature/config controls | PENDING | - | - |
| BILLING-001 | Versioned plans | PENDING | - | TBD: plan names and pricing not decided |
| BILLING-002 | Versioned prices | PENDING | - | TBD: prices, markets, currencies not decided |
| BILLING-003 | Entitlements | PENDING | - | D-014: Free weekly; paid monthly, including annual subscriptions. Documentation approved 2026-10-11; runtime unverified. |
| BILLING-004 | Add-on catalog | PENDING | - | TBD: add-on names/prices not decided |
| BILLING-005 | Add-on quantities | PENDING | - | - |
| BILLING-006 | Effective entitlement service | PENDING | - | - |
| BILLING-007 | Checkout server validation | PENDING | - | - |
| BILLING-008 | Verified webhooks | PENDING | - | REQUIRES EXTERNAL SETUP: Stripe webhook endpoint |
| BILLING-009 | Subscription lifecycle | PENDING | - | - |
| BILLING-010 | Invoices/payments | PENDING | - | - |
| BILLING-011 | Payment recovery | PENDING | - | - |
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
| EMAIL-001 | Resend adapter | PENDING | - | REQUIRES EXTERNAL SETUP: Resend domain + SPF/DKIM |
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
| TEST-001 | Static checks | TESTED | - | `pnpm typecheck` passed 6/6 packages 2026-10-09. Fixed: vite/client types in portal/admin tsconfigs; async onAuthStateChange callback. pnpm install exits 1 (esbuild approve-builds pending) but all 424 packages installed and functional. |
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
| DEPLOY-001 | Migrations as code | IMPLEMENTED | - | supabase/migrations/ — 5 migration files with sequential naming |
| DEPLOY-002 | Staging/production promotion | PENDING | - | - |
| DEPLOY-003 | Secrets/env validation | IMPLEMENTED | - | requireEnv() in portal/admin lib/env.ts; .env.example in all apps |
| DEPLOY-004 | Observability | PENDING | - | - |
| DEPLOY-005 | System Health | PENDING | - | - |
| DEPLOY-006 | Rollback/degraded mode | PENDING | - | - |
| DEPLOY-007 | Documentation/status accuracy | IMPLEMENTED | - | This checklist and PROJECT-STATUS.md updated with evidence |

## Status rules
Allowed: PENDING, IN_PROGRESS, IMPLEMENTED, TESTED, CONFIGURED, COMPLETED, BLOCKED, REQUIRES_EXTERNAL_APPROVAL, LEGAL_REVIEW_REQUIRED, FUTURE, NOT_APPLICABLE (reason required). Never remove completed history; supersede explicitly. Before declaring a domain complete, search all child requirements and hard rules and verify applicable completion gates.
