# Moffu 2.0 — Master Specification and Codex Implementation Prompt

## 1. Mission and working instructions

Evolve the existing repository, [TheBilalMughal/Moffu](https://github.com/TheBilalMughal/Moffu), into an **AI Local SEO & Google Maps Growth Platform**.

Product promise:

> Get discovered. Build trust. Win more local customers.

Moffu should help businesses understand their local visibility, maintain accurate Google Business Profiles, respond to customers, identify competitive opportunities, prioritize improvements, and measure subsequent results.

Preserve the current product and customer data. Extend working features through incremental changes. Audit before editing.

Treat this document as the target product specification and implementation brief. Its proposed tables, endpoints, scores, and limits are design requirements to reconcile with the current system—not claims that they already exist.

### Execution rules

1. Read applicable `AGENTS.md`, root `CLAUDE.md`, and the existing documentation before changes.
2. Inspect the current checkout, branch, uncommitted changes, migrations, tests, provider integrations, and available environment configuration.
3. Establish the actual implementation baseline before choosing files to edit.
4. Preserve existing authentication, Google connections, review workflows, Brand Brain, billing, customer records, and routes.
5. Reuse existing services, shared packages, UI components, permission systems, and provider abstractions.
6. Make additive, backward-compatible migrations. Do not rewrite migration history.
7. Implement complete vertical slices across UI, backend, schema, authorization, jobs, tests, and documentation.
8. Continue independently through safe local work. Record external blockers and continue unrelated work.
9. Do not purchase services, change live billing, publish Google changes, send customer messages, or deploy production changes without applicable authorization.
10. Never report a feature as complete because a page exists.

Begin with Phase 0, then implement Phase 1 locally behind feature flags. Treat subsequent phases as the ordered roadmap; do not attempt a simultaneous platform rewrite.

## 2. Repository baseline and evidence

The source inspection found the following foundation:

| Area | Existing foundation | Implementation direction |
|---|---|---|
| Workspace | pnpm workspaces and Turborepo | Preserve workspace conventions and lockfile |
| Public website | Next.js in `apps/web` | Keep marketing and public feedback surfaces here |
| Customer portal | React/Vite, React Router, Zustand in `apps/portal` | Build customer growth features here |
| Internal admin | React/Vite in `apps/admin` | Extend operational controls here |
| Backend | Supabase functions and PostgreSQL migrations | Extend existing backend |
| Shared code | `packages/types`, `packages/ui`, `packages/config` | Reuse before creating new packages |
| Customer features | Reviews, complaints, insights, Google profile, competitors, Brand Brain, billing, team, campaigns, feedback, marketing | Preserve and improve |
| Google integration | OAuth, location discovery, review sync, reply publishing, profile/performance functions | Audit and consolidate |
| Billing | Catalog, entitlements, usage code, Paddle integration code | Preserve; verify runtime behavior |
| Operations | Existing scheduled-sync and analysis functions | Audit scheduling before adding infrastructure |

Sources: [workspace configuration](https://github.com/TheBilalMughal/Moffu/blob/main/package.json), [portal routes](https://github.com/TheBilalMughal/Moffu/blob/main/apps/portal/src/App.tsx), [operating contract](https://github.com/TheBilalMughal/Moffu/blob/main/CLAUDE.md), and [project status](https://github.com/TheBilalMughal/Moffu/blob/main/AI-Review-Agent-Documentation/claude-docs/PROJECT-STATUS.md).

**Important correction:** do not build the customer dashboard inside Next.js merely because the earlier conversation proposed it. The existing customer portal uses React/Vite.

### Findings requiring audit

- `google-profile-analysis/analysis.ts` already provides normalized profile data, readiness checks, metric parsing, keyword normalization, and competitor normalization. Extend this foundation.
- The legacy `google-competitors` function labels Places response order as `position`, uses the saved description as a category keyword, matches businesses by name, and rejects zero-valued coordinates through truthiness checks. These require correction.
- The newer profile-analysis path uses verified place identity, coordinate validation, distance filtering, and explicit data warnings. Reconcile the two paths.
- `feedback-gate` returns the Google review URL only for happy responses. Replace this sentiment-dependent invitation behavior while preserving feedback records.
- OAuth callback code writes token fields directly into a server-side token table. Application-level encryption is not established by that code; inspect actual database protections and access.
- Billing helpers contain count-then-check usage logic and allow missing entitlement rows in inspected paths. Verify concurrency behavior and deliberate defaults.
- Documentation contains conflicting historical statements about color, billing provider, and completion status. Resolve from current decisions, implementation evidence, and user instructions; document the resolution.

Sources: [analysis helpers](https://github.com/TheBilalMughal/Moffu/blob/main/supabase/functions/google-profile-analysis/analysis.ts), [legacy competitors](https://github.com/TheBilalMughal/Moffu/blob/main/supabase/functions/google-competitors/index.ts), [feedback endpoint](https://github.com/TheBilalMughal/Moffu/blob/main/supabase/functions/feedback-gate/index.ts), [OAuth callback](https://github.com/TheBilalMughal/Moffu/blob/main/supabase/functions/google-oauth-callback/index.ts), and [billing helper](https://github.com/TheBilalMughal/Moffu/blob/main/supabase/functions/_shared/billing.ts).

These are source-level findings. Recheck them at the implementation commit; they are not proof of production exploitability or deployment state.

## 3. Product boundaries

### Core modules

1. **Profile Doctor:** GBP readiness and Local SEO diagnostics.
2. **Review Intelligence:** reviews, replies, sentiment, complaints, and recurring themes.
3. **GeoRank:** location-specific keyword visibility measurements.
4. **Competitor Radar:** nearby business discovery and evidence-based comparison.
5. **AI Growth Agent:** prioritized plans, drafts, approvals, and follow-up measurement.
6. **Growth Analytics:** profile performance, visibility trends, action history, and reports.

The differentiator is the connected workflow:

**Evidence → recommendation → owner decision → action → later measurement.**

### Exclusions from the initial release

- Guaranteed rankings, revenue, or customer acquisition.
- Fake reviews, incentivized reviews, review suppression, or sentiment-based review invitations.
- Autonomous edits to business identity, address, category, or service area.
- Native mobile applications.
- A new billing provider or replacement authentication system.
- Proprietary LLM training on customer or Google content.
- Full agency white-labeling before tenant and location access are verified.
- A generic chatbot that can execute arbitrary tools.

Preserve documented market, currency, and language decisions. Do not introduce the earlier suggested Pakistan pricing or assume a market change.

## 4. Phase 0 — Audit before editing

Create an audit report in the existing documentation structure containing:

### Repository and functionality inventory

- Commit SHA, branch, working-tree state, and dependency versions.
- Customer, admin, and public route inventory.
- Existing service and function ownership.
- Existing feature flags, permissions, and entitlement keys.
- Current review and publishing state machines.
- Google account/location resource identifier formats.
- Existing data retention and deletion mechanisms.
- Provider configuration and secret-storage paths.
- Scheduled jobs, authentication, retries, and failure handling.
- Existing tests and actual commands that run them.

### Database audit

Compare checked-in migrations with the accessible database migration history.

Identify:

- Missing migrations and undocumented remote changes.
- User-scoped versus organization-scoped ownership.
- RLS policies, grants, views, functions, and Storage access.
- Google location ownership and team access.
- Billing ownership, annual-plan allowance behavior, and overrides.
- Duplicate records, missing indexes, and cross-tenant foreign-key risks.

Use read-only inspection against production. Reproduce migrations and experiments locally or in staging.

### Baseline verification

Record pass, fail, or blocked results for:

- Signup, login, reset, logout, onboarding, and invitations.
- Google connect, reconnect, disconnect, and selected locations.
- Review sync, AI drafting, approval, publishing, and reconciliation.
- Brand Brain global configuration and location overrides.
- Profile analysis, competitors, insights, complaints.
- Billing catalog, subscription state, entitlements, and webhook replay.
- Campaigns, feedback, marketing, and admin controls.

Deliver an evidence table with **verified**, **source-inspected**, **documented-only**, and **blocked** states. Never equate those states.

## 5. Google integrations and data rights

Maintain separate adapters and capability records for:

| Source | Intended use |
|---|---|
| Authorized GBP APIs | Merchant profile, owned-location reviews, supported management operations |
| GBP Performance API | Available performance metrics and monthly keyword impressions |
| Places API | Permitted discovery and place details |
| Approved ranking provider | Supported location-specific search observations |
| Merchant-provided data | Confirmed services, business context, goals, and operational actions |

GBP Performance supplies performance and keyword-impression resources; it does not establish arbitrary keyword rank at neighborhood grid points. [Performance API reference](https://developers.google.com/my-business/reference/performance/rest)

### Policy gates

GBP operations require merchant authorization and specific consent for external actions. Its policy also restricts storage, aggregation, and use outside the project. Review those constraints before persisting history or sending content to an LLM; merchant consent alone does not override provider terms. [GBP API policies](https://developers.google.com/my-business/content/policies)

For every source, document permitted fields, purposes, processing, retention, exports, attribution, and deletion. Places has field-specific storage rules and attribution requirements; permission to retain a place ID does not authorize retaining all place content. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)

Do not use GBP `GoogleLocations` as a competitor or lead-generation database. Do not expose a programmatic proxy to Moffu’s GBP project. [GBP API policies](https://developers.google.com/my-business/content/policies)

Treat rights to retain derived scores, summaries, embeddings, and historical comparisons as separate questions. If a proposed use is unresolved, disable that use and document the blocker.

## 6. Profile Doctor and Local SEO

Extend the existing profile-analysis module and `/google-profile` experience.

### Diagnostics

Assess supported and applicable fields:

- Accurate business name.
- Primary and additional categories.
- Phone and location website.
- Description.
- Regular and special hours.
- Storefront or service-area configuration.
- Supported service information.
- Review response coverage and response time.
- Available photo/post freshness signals.
- Website consistency against merchant-confirmed information.

For every check return:

- Stable check ID and methodology version.
- Status: `pass`, `action`, `unknown`, or `not_applicable`.
- Severity and weight.
- Observed value and source.
- Observation timestamp.
- Explanation and suggested action.
- Evidence reference and capability restrictions.

A service-area business must not fail for lacking a public storefront address. Unsupported API fields must remain unknown.

### Website audit

Add later in Phase 1 or as a separate bounded slice:

- HTTP/HTTPS availability and redirect behavior.
- Title, meta description, canonical, robots, and sitemap checks.
- LocalBusiness structured-data validation.
- Contact and address consistency.
- Location-page relevance and duplicate metadata.
- Optional performance integration after cost and quota review.

Only crawl merchant-authorized domains. Bound pages, redirects, response size, and time. Block private-network destinations, metadata endpoints, unsafe schemes, and redirects into them. Do not infer ranking guarantees from audit checks.

### Profile edits

Initially produce recommendations and editable drafts. Publish only supported fields through a reviewed before/after diff and explicit approval. Require fresh source state and reject stale approvals.

## 7. Review Intelligence and Feedback

Preserve the current review inbox, drafts, Brand Brain, complaints, and publishing workflow.

Add:

- Topic classification with evidence references.
- Recurring praise and complaint trends.
- Response backlog, response coverage, and median response time.
- Period comparisons with sample sizes.
- Merchant corrections to classifications.
- Suggested operational tasks linked to evidence.
- Language-aware summaries where supported.

Distinguish synced-review samples from Google’s total review count. Avoid business-wide claims from incomplete samples.

### AI controls

- Use structured, validated outputs.
- Version prompts, models, and analysis methodology.
- Treat reviews and website text as untrusted input.
- Minimize personal data sent to providers.
- Do not infer sensitive traits.
- Reuse existing AI-provider settings and Brand Brain behavior.
- Save learning or preference changes only after merchant confirmation.
- Permit analysis only when source rights and AI-provider processing terms support it.

### Feedback correction

Replace happy-only public-review routing with a neutral experience. Customers must have the same opportunity to leave an honest public review regardless of sentiment. Private feedback remains optional and available to everyone. Preserve historical responses and campaign records. [Google fake-engagement policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en)

## 8. GeoRank — compliant visibility measurement

GeoRank is a flagship feature with an explicit data-source gate.

### Source selection

Do not label these as measured Maps rank:

- Places Nearby Search ordering.
- Places Text Search ordering.
- Distance from the business.
- GBP keyword impressions.
- AI-generated estimates.

Evaluate providers using:

- Documented collection methodology and upstream rights.
- Supported search surface, geography, language, and device.
- Location precision and result depth.
- Commercial display and historical-storage rights.
- Derived-analysis and export rights.
- Attribution and deletion obligations.
- API reliability, cost, rate limits, and support.

A provider’s availability or marketing claim does not establish compliance.

Do not implement direct scraping, CAPTCHA bypass, or proxy evasion. If no acceptable provider is configured, show an honest unavailable state and continue other modules. Demo scans must be clearly labeled and isolated from customer metrics.

### Scan configuration

A scan records:

- Organization and existing location ID.
- Verified target place identity.
- Keyword.
- Search surface and provider.
- Country, language, and device when supported.
- Center coordinates and source.
- Grid dimensions and spacing.
- Requested result depth.
- Estimated billable units.
- Methodology version and configuration hash.

Define geometry precisely. For an odd square grid of side `N` and spacing `s`, center-to-edge distance along an axis is `(N−1)×s/2`. Do not call that corner distance or circular radius.

Allow only provider-supported, entitlement-approved grid sizes.

### Scan lifecycle

`queued → running → completed | partial | failed | cancelled`

Each point records:

- Coordinates, index, and observation time.
- Status: `found`, `not_found_within_depth`, `failed`, `pending`, or `cancelled`.
- Rank only when observed.
- Provider task/reference ID.
- Search depth and configuration.
- Permitted evidence and expiry metadata.

Unknown and failed results must not become rank zero or “not found.”

### Metrics

- **Completion:** valid observed points ÷ planned points.
- **Top-3 coverage:** valid points with rank ≤3 ÷ valid observed points.
- **Top-10 coverage:** valid points with rank ≤10 ÷ valid observed points.
- **Mean observed rank:** mean across found points, accompanied by found/valid counts.
- **Optional depth-capped metric:** use `depth+1` for valid not-found points only, with explicit labeling.

Display denominators. Warn about incomplete scans and survivorship bias in mean observed rank.

Compare scans only when keyword, provider, surface, grid, locale, device, and depth are compatible. Explain any methodology break.

### Experience

Provide a numbered grid, accessible results table, legend, scan progress, point details, date history, and compatible-scan comparison. Use symbols and labels as well as color.

Never interpolate unsampled neighborhoods into measured results.

## 9. Competitor Radar

Extend `/competitors`; consolidate legacy and newer discovery code.

Provide:

- Nearby discovery using permitted sources.
- Manual selection through validated place identity.
- Radius, category, and keyword context.
- Permitted ratings, counts, categories, and distance.
- GeoRank comparisons only from compatible ranking observations.
- Review themes only when the source permits sufficient access and processing.
- Suggested opportunities with explicit evidence.

Always disclose the source, timestamp, ordering, result/sample limit, and missing data.

Use place identity rather than name matching. Separate discovery order from search rank. Do not claim competitors’ private GBP performance, exact traffic, revenue, or full review history.

## 10. AI Growth Agent

Implement a controlled planning workflow using existing provider abstractions.

### Agent loop

1. Gather authorized, current evidence.
2. Run deterministic diagnostics.
3. Generate structured recommendations.
4. Deduplicate against existing actions.
5. Prioritize with an explainable formula.
6. Present a weekly plan.
7. Obtain required approval.
8. Execute supported tools through backend authorization.
9. Reconcile external outcomes.
10. Measure later observations.

### Action record

Include:

- Tenant, location, title, and action type.
- Evidence references and freshness.
- Reason, confidence basis, and expected outcome.
- Effort, priority, dependencies, and risk.
- Proposed payload and current-value diff.
- Assigned member and due date.
- Approval identity, timestamp, and payload hash.
- Execution attempts and provider references.
- Measurement window and result status.

State machine:

`recommended → accepted → drafted → awaiting_approval → approved → executing → completed`

Also support `dismissed`, `blocked`, `failed`, `cancelled`, and `needs_reapproval`.

A completed manual task requires merchant confirmation. An external write requires provider confirmation or reconciliation.

### Tool boundaries

Allow bounded tools such as reading authorized evidence, generating drafts, creating tasks, and executing an approved supported change.

Do not allow arbitrary SQL, arbitrary URLs, unrestricted code execution, or model-selected tenant identities.

Recheck permissions, entitlements, token scopes, location access, approval validity, and current source state at execution time. A conversational “yes” alone must not authorize an unspecified payload.

Automate internal analysis and reminders first. Keep Google publishing behind explicit approval.

## 11. Growth Score and Growth Timeline

Keep the existing readiness methodology intact until a versioned replacement is validated.

Proposed Growth Score dimensions:

- Profile readiness.
- Review responsiveness.
- Customer experience.
- Measured local visibility.
- Maintenance activity.

Before enabling a composite score, define measurable inputs, weights, freshness, minimum sample sizes, applicable checks, and missing-data behavior.

For assessed checks:

`score = 100 × earned assessed weight ÷ available assessed weight`

Show coverage separately. Return no score when evidence is insufficient. Prevent a nearly empty profile from appearing healthy through a high score with minimal coverage.

The score is a Moffu diagnostic—not a Google score or ranking prediction.

Growth Timeline connects recommendations, approvals, merchant actions, and later metrics. Use “observed after” language; do not claim causation from before/after correlation.

## 12. Architecture and implementation placement

Preserve the existing architecture:

- `apps/portal/src/features/`: customer modules.
- `apps/admin/src/features/`: administrative controls.
- `apps/web`: public pages.
- `supabase/functions/`: sensitive integrations and bounded backend handlers.
- `supabase/migrations/`: additive schema changes.
- `packages/types`: shared contracts.
- `packages/ui`: shared UI primitives.

Create new packages only when reuse warrants them. Do not introduce a separate worker application by default.

### Background processing

Audit existing Cron and sync functions. Use durable persisted jobs for long scans, reports, and retryable analysis.

Required properties:

- Atomic enqueue and usage reservation.
- Durable leases and heartbeats.
- Bounded batches and concurrency.
- Provider timeouts and retry classification.
- Exponential backoff with jitter.
- Maximum attempts and dead-letter handling.
- Cancellation and expired-lease recovery.
- Signed, replay-protected callbacks where applicable.
- Idempotent ingestion.
- Reconciliation after uncertain external outcomes.

An in-memory map may reduce duplicate requests within one process; it is not a distributed lock or durable job queue.

## 13. Supabase schema design

Reconcile the following logical model with actual schema. Extend existing entities before creating duplicates.

### Ownership migration

The repository contains both organization models and user-scoped Google/billing paths. Do not simply add `org_id` and assume migration is complete.

1. Map existing users, memberships, connections, locations, and subscriptions.
2. Resolve ambiguous ownership explicitly.
3. Add compatible ownership fields.
4. Backfill deterministically.
5. Verify counts, relationships, and access.
6. Introduce organization-aware service methods.
7. Retain compatibility during transition.
8. Enforce constraints after verification.
9. Remove legacy paths only in a separate migration.

Billing ownership may remain user-scoped initially. Explicitly map the paying account to organizations and prevent one person’s entitlement from leaking across unrelated tenants.

### Proposed logical tables

| Entity | Essential fields |
|---|---|
| `growth_keywords` | org, location, keyword, locale, surface, active |
| `geo_scan_configs` | org, location, grid, provider, depth, config hash |
| `geo_scans` | config snapshot, state, requested/completed counts, costs, timestamps |
| `geo_scan_points` | scan, point index, coordinates, status, rank, provider reference |
| `competitor_watchlists` | org, location, competitor identity, enabled |
| `competitor_observations` | source, permitted fields, observation/expiry times |
| `local_audit_runs` | location, rules version, coverage, score, state |
| `local_audit_findings` | run, check, status, severity, evidence |
| `review_insight_runs` | location, source window, model/prompt version, sample size |
| `review_insight_items` | topic, classification, evidence references, confidence |
| `growth_plans` | org, location, planning period, state |
| `growth_actions` | plan, action type, evidence, priority, lifecycle |
| `action_approvals` | action version, approver, payload hash, expiry |
| `action_attempts` | action, outcome, idempotency key, provider reference |
| `growth_score_snapshots` | version, component scores, coverage, time |
| `job_runs` | type, tenant, payload reference, lease, attempts, state |
| `usage_reservations` | billing account, period, units, reservation state |
| `data_source_policies` | source/version, permitted use, expiry rules, review status |

Persist provider-derived rows only when retention and processing are permitted. Logical history requirements do not override source restrictions.

### Constraints and indexes

- UUID keys and UTC timestamps.
- Tenant/location consistency through composite keys or equivalent database constraints.
- Unique scan-point index per scan.
- Unique provider callback/task ingestion keys.
- Unique idempotency keys within their operation scope.
- Rank >0 only for `found`; null otherwise.
- Finite coordinates within geographic bounds.
- Positive bounded dimensions, spacing, depth, and units.
- Index tenant/location/date queries and job lease/state queries.
- Keep raw provider payloads out of general-purpose JSON storage unless explicitly permitted.

### RLS and privileged access

Enable RLS on exposed tables and define operation-specific policies with active membership, role, and location authorization. Updates require both existing-row and new-row checks. Protect views, Storage, and RPC functions as well as tables. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

Keep credentials and internal job controls inaccessible to browser roles. Service-role handlers must independently authorize every requested resource.

Do not derive authorization from user-editable metadata. Audit privileged functions, fixed search paths, execution grants, and recursion risks.

## 14. API and service contracts

Use existing Edge Function conventions; these names are proposed capabilities to reconcile with current names:

- Profile audit: run, latest result, history.
- Geo scan: estimate, create, status, results, cancel.
- Competitor watchlist: add, remove, compare.
- Review insights: generate, retrieve, correct.
- Growth plan: generate, retrieve.
- Growth action: transition, approve, execute, reconcile.
- Report: create, status, authorized download.

All sensitive handlers must enforce:

1. Authentication.
2. Active account and organization membership.
3. Resource and location access.
4. Permission.
5. Entitlement and budget.
6. Input validation.
7. Idempotency.
8. Source capabilities and data rights.

Use stable error codes and request IDs. Return partial availability per section. Do not expose provider response bodies, credentials, or internal stack traces.

## 15. Security requirements

Prioritize:

- Cross-tenant access through service-role functions.
- User-scoped to organization-scoped transitions.
- OAuth state expiry, single use, binding, and replay protection.
- Refresh-token preservation when reconnect responses omit it.
- Token encryption, restricted decryption, rotation, and revocation.
- Server-only secret management and masked administration.
- Provider URL and error-log redaction.
- Concurrent quota reservations.
- Webhook signature verification and duplicate delivery.
- Prompt injection and unsafe model tool use.
- SSRF through website audits.
- XSS in reviews, content previews, and generated text.
- CSV formula injection and unsafe downloads.
- Public feedback-token guessing and submission replay.
- Admin impersonation scope and auditability.

Audit repository history for secrets without printing them. If exposure is confirmed, document required rotation; deletion from a current file is insufficient.

Disconnecting a Google account must stop relevant jobs and prevent future writes. Preserve only data that remains authorized and permitted.

## 16. Billing and cost controls

Preserve current catalog and Paddle integration unless a separately authorized migration is required.

Proposed entitlement keys:

- `feature_profile_doctor`
- `feature_georank`
- `feature_competitor_radar`
- `feature_growth_agent`
- `feature_growth_reports`
- `tracked_keywords`
- `competitors_per_location`
- `georank_units`
- `max_grid_points`
- `minimum_scan_interval`
- `growth_plan_generations`

Map these to existing naming conventions.

Define the billable unit precisely. A useful internal estimate is keywords × grid points × locations × scheduled scans, then adjusted for the provider’s actual charging model.

Before enqueueing paid work:

- Show estimated usage.
- Reserve units transactionally.
- Enforce tenant and platform budgets.
- Reconcile actual provider charges.
- Release unused reservations according to documented rules.
- Avoid charging twice for retries or duplicate callbacks.

Missing paid-feature entitlements deny access. Preserve legitimate existing unlimited settings and contractual overrides through explicit migration rules.

Keep annual payment frequency separate from allowance renewal. Do not invent prices or grant annual users a year’s usage upfront.

## 17. Dashboard UX

Extend the established portal shell and navigation.

Suggested groups:

- Overview.
- Reputation: Reviews, Complaints, Review Intelligence.
- Local Growth: Profile Doctor, GeoRank, Competitors, Growth Plan.
- Engage: Campaigns, Feedback, Marketing.
- Brand Brain.
- Reports.
- Team, Billing, Settings.

Preserve old URLs or provide deliberate redirects.

### Overview

Show:

- Selected organization and location.
- Data freshness and connection issues.
- Profile readiness with coverage.
- Review response backlog.
- GeoRank summary when configured.
- Available GBP performance.
- Three prioritized actions.
- Recent actions and observations.

### Visual requirements

Follow the current root contract’s purple primary color `#6C55E8`, hover `#5A42D1`, while recording its conflict with older green-color documentation.

Use restrained cards, clear tables, readable typography, consistent spacing, and semantic status colors. Avoid capsule styling, emoji icons, generic AI gradients, and fake typing effects.

Every visible control must work, be truthfully disabled, or be omitted.

### States and accessibility

Support:

- Loading.
- Empty.
- Not configured.
- Not authorized.
- Unsupported.
- Stale.
- Partial.
- Failed.
- Budget exhausted.
- Reconnect required.

Show missing data as unavailable rather than zero. Cancel or invalidate requests when locations change to prevent stale cross-location display.

Provide keyboard navigation, focus handling, accessible dialogs, chart summaries, and a GeoRank table alternative. Verify desktop, tablet, and mobile layouts.

## 18. Internal admin

Extend existing admin modules with:

- Provider capabilities and configuration.
- Masked credentials and connection testing.
- Google connection and sync health.
- Job queue, retries, and dead letters.
- GeoRank consumption and cost reconciliation.
- Entitlements and tenant rollout flags.
- AI usage, failures, and model configuration.
- Data-policy review and purge-job status.
- Audited support actions.

Admin UI access alone must not authorize backend operations. Support personnel should receive only the scopes needed for their tasks.

## 19. Phased implementation

| Phase | Scope | Exit gate |
|---|---|---|
| 0 | Audit, baseline, architecture reconciliation, source-rights matrix | Evidence-backed plan and critical risks identified |
| 1 | Extend Profile Doctor and Review Intelligence; neutral feedback flow; authorization and billing prerequisites | Tested customer value with existing product preserved |
| 2 | Approved GeoRank adapter, durable scans, cost controls, Competitor Radar | Real permitted scans, truthful metrics, reliable recovery |
| 3 | Growth Agent, approvals, action execution, Growth Timeline | Evidence-linked plans and reconciled approved actions |
| 4 | Reporting, scheduling, multi-location operations, agency access, scale hardening | Operational readiness and verified isolation |

Do not assign calendar commitments until Phase 0 establishes scope, team capacity, and external dependencies.

Within every phase, deliver small usable slices. Keep incomplete features disabled. Do not expose a production feature backed by mock data.

## 20. Tests and acceptance criteria

### Regression

The baseline authentication, onboarding, Google, reviews, Brand Brain, billing, team, campaign, feedback, marketing, and admin flows continue working.

A failing pre-existing check must be identified separately from a regression.

### Tenant and role isolation

Using two organizations and multiple roles:

- Tenant A cannot read or change Tenant B’s rows, files, jobs, scans, or reports.
- Changing request IDs cannot bypass authorization.
- Viewers cannot approve or execute writes.
- Revoked membership blocks subsequent operations.
- A job revalidates authorization before external execution.

### Profile Doctor

- Unsupported values are unknown.
- Service-area profiles receive applicable checks.
- Scores and coverage match documented fixtures.
- Rule versions preserve interpretation of historical results.
- Missing provider data never becomes a misleading zero.

### GeoRank

- Coordinates at zero are valid.
- Invalid coordinates and unsafe scan sizes are rejected.
- Grid points are reproducible.
- Failed points remain distinct from not-found points.
- Formulas match fixtures with partial scans.
- Duplicate callbacks do not duplicate results or usage.
- Worker crashes resume safely.
- Incompatible scans cannot silently produce a trend.
- Places discovery order never appears as measured rank.
- Missing provider configuration shows an honest unavailable state.

### Growth Agent and publishing

- Each recommendation references accessible evidence.
- Untrusted text cannot change tool permissions.
- Edited payloads invalidate prior approvals.
- Expired approvals and revoked permissions block execution.
- Concurrent execution produces one logical action.
- Ambiguous provider outcomes reconcile before retry.
- External failure does not mark an action complete.
- Manual completion requires merchant confirmation.

### Billing and jobs

- Parallel requests cannot overspend a quota.
- Missing entitlements deny the new paid operation.
- Annual-plan allowance cadence remains correct.
- Reservations recover after failed or cancelled jobs.
- Webhook and callback replays are safe.
- A downgrade prevents disallowed future work without deleting customer content.

### Feedback

- Happy and unhappy customers have equal access to the public-review invitation.
- Private feedback remains available to everyone.
- Expired and reused tokens behave predictably.
- Concurrent submissions do not create duplicate responses.

### Security and data lifecycle

- Browser builds contain no privileged credentials.
- Tokens and provider secrets do not appear in logs.
- SSRF fixtures block private and metadata destinations.
- Stored content cannot execute scripts.
- Purging removes expired content and disallowed derived artifacts.
- Exports enforce source restrictions and tenant access.

### Validation commands

Inspect the repository’s scripts and test configuration first. Run the applicable lint, typecheck, unit, database, integration, browser, and build checks.

A root `test` script does not prove individual packages contain tests. Add meaningful tests for new behavior and report when a command runs no tests.

Use synthetic fixtures for routine tests. Use authorized staging credentials for real-provider verification.

## 21. Deployment and operations

Before production release:

1. Verify migration replay against a representative sanitized database.
2. Validate backup and restore procedures.
3. Apply additive schema before dependent code.
4. Deploy compatible backend and frontend versions.
5. Keep new features disabled initially.
6. Verify auth, permissions, provider configuration, and critical flows.
7. Enable a small authorized pilot.
8. Monitor failures, cost, job lag, and data freshness.
9. Expand only after acceptance gates pass.

Prepare a feature-flag rollback and backward-compatible code rollback. Do not roll back by deleting customer data.

Track job failures, authorization denials, token refresh failures, provider latency, scan completeness, usage discrepancies, purge failures, and publishing reconciliation.

Define operational targets from evidence; do not invent retention periods, recovery guarantees, or provider limits.

## 22. Required implementation deliverables

Maintain these within the existing documentation structure:

- Moffu 2.0 specification.
- Repository audit and evidence matrix.
- Architecture decisions.
- Ownership migration plan.
- Data-source and rights matrix.
- Schema and API contracts.
- Permission and entitlement matrix.
- Test and acceptance results.
- Configuration checklist without secrets.
- Deployment and rollback runbook.
- Updated project status, master checklist, and implementation evidence.

Use distinct status labels:

- Designed.
- Implemented locally.
- Tested locally.
- Verified in staging.
- Configured.
- Deployed.
- Verified in production.
- Blocked.

For each delivered slice, report what changed, validation performed, remaining blockers, and deployment state.

## 23. First implementation instruction

Start by auditing the current project and producing the Phase 0 evidence report. Then implement the smallest complete Phase 1 slice:

**Extend the existing Google Profile analysis into Profile Doctor with persistent results only where permitted, explicit evidence freshness, transparent score coverage, backend-enforced access, responsive UI, meaningful tests, and updated documentation.**

Address the feedback invitation behavior and shared security or billing prerequisites as separate reviewable changes.

Preserve current customer functionality throughout. GeoRank must remain unavailable until its data source, rights, methodology, and economics are verified.


---

## 24. Repository-grounded audit addendum

Audit snapshot: GitHub default branch main, commit cd5ad2671929999bcc165d86f8a7ecd7c621747b (2026-11-13 18:49 UTC), checked against source on 2026-11-14. The implementing checkout was subsequently inspected on 2026-11-16: branch `main`, same HEAD, with pre-existing changes to `ReviewsPage.tsx` and `REQUIREMENTS-INDEX.md`, plus the local master specification. The connected Supabase project was inspected read-only. Detailed live/local evidence and migration divergence are recorded in `19-MOFFU-2.0-PHASE-0-AUDIT.md`; production user journeys and provider authorization remain unverified.

### Confirmed source findings and documentation drift

- **Google analysis foundation exists:** google-profile-analysis/analysis.ts has profile normalization, separate category/description fields, coordinate validation (including zero), distance calculation, Moffu readiness scoring with unknowns/coverage, metrics parsing, keyword normalization, and identity-based competitor normalization.
- **Legacy competitor path remains inconsistent:** google-competitors/index.ts still uses the saved description as a Places keyword, treats Places response order as position after rankby=prominence, identifies the merchant by case-insensitive name, and rejects latitude or longitude equal to zero through truthiness checks. The project-status document says the category keyword was fixed, so the implementation task must reconcile this documentation/source mismatch before changing behavior. Places result order must not be presented as measured local search rank.
- **Feedback invitation is sentiment-gated in the current endpoint:** feedback-gate/index.ts returns the Google review URL from POST only when sentiment is happy. The neutral invitation change in this spec is a separate policy-sensitive fix; preserve existing feedback records and tests while changing the experience.
- **OAuth callback controls need review:** google-oauth-callback/index.ts compares the submitted state with the stored OAuth state and clears it after completion, but the inspected flow has no explicit state expiry. Token upsert writes tokens.refresh_token directly, so reconnect behavior when Google omits a replacement refresh token must be checked. The callback source alone does not establish whether database-level or infrastructure encryption is present; inspect grants, RLS, deployment secrets, and platform protections before making an encryption claim.
- **Billing usage checks are not atomic reservations in the inspected helper:** _shared/billing.ts reads usage count and returns an allow/deny result separately from later usage-event recording. Concurrent requests therefore need an audit and a transactional reservation mechanism for new metered GeoRank work. The helper also allows access when an entitlement row is absent; new paid features must fail closed while preserving explicit existing overrides.
- **Repo-level toolchain discrepancy:** root package.json declares pnpm@12.4.2, while .github/workflows/ci.yml configures pnpm 8. Resolve the intended pinned version from the lockfile, installed packages, CI evidence, and repository rules before relying on automation. Do not change Turbo commands/config without resolving the installed turbo package and reading its bundled docs/README.md and relevant docs first.
- **Function deployment workflow has broad impact:** the main-branch CI job loops over and deploys every Edge Function with --no-verify-jwt. Audit this against each function's manual authentication and the live deployment configuration; do not use a routine docs or portal change to redeploy unrelated functions accidentally.
- **Database history may be incomplete in Git:** checked-in migrations include later alterations of google_locations, while the inspected migration directory does not clearly contain the original Google/review table creation migration described in older status notes. This is not proof that production schema is missing; compare the full checked-in tree, local schema, and live migration history before any DDL.
- **Historical documentation is not runtime evidence:** status files contain older provider/configuration/completion claims alongside newer Paddle, Google Profile, and production notes. Treat every state as documented-only until confirmed against current source, Supabase, Vercel, or an authorized provider smoke test.

### Evidence labels for the implementation handoff

| Evidence class | What the snapshot supports |
|---|---|
| Source-inspected | Current main contains the React/Vite portal, Next.js website, React/Vite admin, Supabase Edge Functions, existing Google Profile analysis, legacy competitor path, and the cited source-level behaviors above. |
| Documented-only | Project-status statements about live Paddle, migration application, deployed functions, and production behavior until checked against current external state. |
| Not verified in this audit | Current deployed Edge Function versions/configuration, Google project approval, token encryption at rest, Vercel production state, real customer journeys, and GeoRank vendor rights/costs. |
| Audit completed | Local Git and read-only Supabase inventory/advisors; migration history differs materially from checked-in migration filenames. Reconcile before DDL. |

Keep these distinctions in the Phase 0 report. Recheck all source findings at the implementation commit; none of them alone proves production exploitability or confirms current deployed behavior.

### Phase 1 implementation update — 2026-11-16

- **Implemented locally:** Profile Doctor check payload now includes evidence references, source, observation timestamp, capability limitations, observed value, severity, status, weight, and methodology version `moffu-local-readiness-v2`.
- **Implemented locally:** Google Profile page presents assessed-weight coverage, methodology, evidence provenance/freshness, and the non-Google-score limitation. Analysis is computed for the current view and is not saved as a report.
- **Preserved:** Existing `feature_google_profile` route and server-side identity/location/account/subscription checks. No new table, migration, production write, deploy, Google publishing action, or feedback-flow behavior.
- **Validation:** Portal typecheck passed. Node tests, production build, and visual QA were not run; Deno typecheck is unavailable because Deno is not installed. Do not mark this slice fully tested until remaining checks are run.
- **Current blockers:** Migration filename/history reconciliation before DDL; authorized Google account smoke check before claiming live provider readiness.

