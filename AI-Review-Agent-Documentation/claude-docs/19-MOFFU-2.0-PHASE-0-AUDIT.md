# Moffu 2.0 — Phase 0 Audit

**Audit date:** 2026-11-16 (Asia/Karachi)  
**Repository:** `E:\Moffu`  
**Live project inspected read-only:** Supabase `kgttncfkzdrgswfkkdji`

## Executive summary

The repository already has a working Google Profile analysis path. It calls Google Business Profile, Profile Performance, and Places from the `google-profile-analysis` Edge Function; normalizes primary and additional categories separately from the profile description; computes a transparent Moffu readiness heuristic; and returns live data without saving an analysis report. The portal route and server function both check `feature_google_profile`, with additional server-side user, location ownership, account, subscription, and Google-connection checks.

Phase 1 can extend this vertical slice without adding tables or retaining additional Google/Places content. The first local implementation enriches every readiness check with stable evidence metadata and displays provenance, freshness, coverage, and methodology in the existing Google Profile page.

**Do not add or apply database migrations until migration history is reconciled.** The checkout contains 69 migration files while the connected Supabase history reports 73 applied migrations. Comparing filename versions shows 28 matching versions, 41 local-only versions, and 45 remote-only versions. This discrepancy is not evidence of missing production tables; it is a blocker for new DDL until explained.

## Repository and runtime evidence

| Item | Evidence | State |
|---|---|---|
| Branch and HEAD | `main`, `cd5ad2671929999bcc165d86f8a7ecd7c621747b` | Verified locally |
| Initial working tree | Existing changes: `ReviewsPage.tsx` modified; `REQUIREMENTS-INDEX.md` modified; Moffu 2.0 specification untracked | Verified locally; preserved |
| Runtime/toolchain | Node `v22.17.1`; pnpm `12.4.2`; root package pins pnpm 12.4.2 | Verified locally |
| Portal stack | React `18.3.1`, Vite `5.4.21`; scripts include build, lint, typecheck | Verified locally |
| Test inventory | `supabase/functions/google-profile-analysis/analysis.test.cjs` is the focused test file found for this slice | Source inventory only; not run |
| Portal route | `/google-profile` wrapped in `FeatureGatePage(feature_google_profile)` | Source-inspected |
| Functions and UI | `google-profile-analysis/index.ts`, `analysis.ts`, `GoogleProfilePage.tsx`, `profile-analysis.service.ts` | Source-inspected |

The portal also contains Reviews, Complaints, Insights, Competitors, Brand Brain, Billing, Settings, Team, Campaigns, Feedback, and Marketing routes. The repository has distinct React/Vite portal and admin surfaces plus a Next.js public website.

## Google Profile vertical slice

### Existing behavior

- The browser calls `google-profile-analysis` with the selected saved location ID and one of the supported 5/10/20/30 km radii.
- The Edge Function verifies the bearer session through Supabase Auth, constrains the location query to the caller’s `user_id`, requires an active account and subscription, checks the Google Profile entitlement, and verifies the Google connection.
- Profile Business Information, performance, keyword impressions, Places data, and synced-review counts are requested server-side. Google tokens and admin API settings are not sent to the browser.
- The API read mask includes `categories` independently from `profile.description`; category normalization and the portal display use distinct values.
- Competitor results are de-duplicated by place ID, checked against coordinates (including zero), distance-filtered to the requested circle, and presented in distance order. This is a nearby sample, not a measured Google Maps ranking.
- Readiness weights total 100. Unknown profile checks are excluded from the score. The page already identifies the score as Moffu’s diagnostic rather than a Google score.
- The function has a process-local rate limit and in-flight coalescing. This does not provide distributed rate limiting across Edge Function instances.
- Analysis and Places response content are not persisted by this function. It does update refreshed access-token/expiry fields when needed. Synced review records are existing product data and remain stored under current rules.

### Authorization and entitlement notes

- `feature_google_profile` is enforced by both route-level gating and the analysis function. Phase 1 reuses this established entitlement; it does not add a parallel auth or billing system.
- The endpoint reads a missing `plan_entitlements` row as allowed unless the row explicitly contains `false`. Preserve that existing catalog behavior for this feature; new paid operations must define stricter behavior separately.
- Google locations and reviews use the current user-scoped model (`user_id`), while organizations and membership tables also exist. This slice does not migrate ownership.
- `google_connection_tokens` has RLS enabled and zero user policies in live `pg_policies`; service-role access in the Edge Function is the intended access path. Do not add a client policy for tokens.

## Supabase inspection

### Migration reconciliation

- Checked-in migration files: 69.
- Connected project migration history: 73 entries.
- Exact filename-version overlap: 28.
- Local-only versions: 41; remote-only versions: 45.
- Core tables confirmed live include `google_connections`, `google_connection_tokens`, `google_locations`, `reviews`, `profiles`, `subscriptions`, `plan_entitlements`, `usage_events`, `feature_flags`, and `org_feature_flags`.
- RLS is enabled on the inspected core tables. `google_connection_tokens` has no user-facing RLS policies, as expected for service-role-only token access.

This history divergence requires a migration-by-migration reconciliation before adding or applying any schema changes. Existing production tables were observed directly, so the mismatch must not be represented as a missing production schema.

### Advisor snapshot

The connected project returned no health advisories. Security advisor findings include:

- One `SECURITY DEFINER` view finding for `public.org_external_members` (ERROR).
- Three RLS-enabled/no-policy notices: `google_connection_tokens`, `ref_id_sequences`, and `security_events`. The token table’s service-only use is documented above; the other two need separate intent review.
- Warnings for mutable function `search_path`, extensions in `public`, and functions executable as `SECURITY DEFINER` by `anon`/`authenticated` roles. Review function-by-function; do not mass-revoke or alter unrelated functions as part of Profile Doctor.
- Leaked-password protection is disabled according to the Auth advisor.

Performance advisories include unindexed foreign keys, RLS initialization-plan warnings, duplicate indexes, multiple permissive policies, and unused indexes. These are broader database review items, not prerequisites for this no-DDL slice.

Remediation references: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter), [Edge Function security](https://supabase.com/docs/guides/functions/auth), and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Baseline evidence and limitations

| Area | Evidence state | Notes |
|---|---|---|
| Google Profile frontend/backend contract | Source-inspected | No authenticated customer browser session exercised in this audit. |
| Category extraction | Source-inspected | GBP read mask and normalizer include primary/additional categories separately from description. Live provider permission remains an external/runtime configuration. |
| Location authorization and plan access | Source-inspected | Function checks the current user, saved location, active account/subscription, and existing entitlement. |
| Live provider authorization/configuration | Blocked | No live Google Business Profile customer session was exercised. Supabase admin key presence does not prove GBP permission or Places API success. |
| Auth/onboarding, review publishing, Brand Brain, billing, admin, campaigns, feedback | Documented-only/source-inspected | Existing code and status documentation establish ownership/routes, not a fresh end-to-end pass. |
| Supabase migration parity | Blocked | 69 local files and 73 remote history rows differ materially; no DDL was attempted. |
| Tests/build/browser QA | Tests, production build, and browser QA not run | Portal typecheck was run after implementation; see Phase 1 evidence below. |
| Production deployment/provider approvals | Blocked/not attempted | No deployment, provider write, customer message, billing change, or production schema write was performed. |

## Phase 1 scope and safety decisions

1. Extend the existing readiness check contract with stable evidence IDs, status, severity, observed value, source, observation timestamp, capability limitations, and methodology version.
2. Keep the current 100-point Moffu weight model and explicitly label operational thresholds as Moffu heuristics.
3. Render score coverage and per-check evidence/freshness in the existing Google Profile page, with a plain statement that the score is not Google’s score and this view is not persisted as a report.
4. Preserve the existing `feature_google_profile` gate, user/location authorization checks, Google source of truth, existing category field, and review workflows.
5. Do not add persistence for Google/Places content, new tables, migrations, GeoRank, autonomous profile edits, or external publishing in this slice.
6. Keep feedback invitation policy work as a separate reviewable change; do not modify customer-facing feedback routing in this Profile Doctor slice.

## Phase 1 implementation evidence

Status: **Implemented locally; validation pending.**

- `google-profile-analysis/analysis.ts` now emits evidence-aware checks, explicit source/capability limits, and methodology `moffu-local-readiness-v2`.
- `profile-analysis.service.ts` carries the response type for the expanded check schema.
- `GoogleProfilePage.tsx` shows evidence source, observation time, severity, methodology, and assessed-weight coverage.
- No migration, database mutation, provider write, or deployment was performed.
- Portal typecheck passed: `pnpm --filter @moffu/portal typecheck`.
- Node tests, production build, and browser visual QA were not run. `deno check` could not run because Deno is not installed in this environment.
- Do not mark this slice fully tested until the remaining checks and visual QA are run.

