# Moffu 2.0 — Phase 2 GeoRank source and architecture review

**Reviewed:** 2026-11-16  
**State:** Source-neutral domain core implemented locally; provider use, durable scans, and customer-facing GeoRank remain gated.

## Executive result

DataForSEO Google Maps SERP is a technical candidate, not an approved Moffu GeoRank source. Its API supports coordinate-centered Maps queries, result depth, device, and `search_this_area`; however, DataForSEO's published terms leave the customer's compliance with upstream search-engine rights to the customer, and its legal FAQ says it cannot confirm whether a particular product use complies with its terms. Moffu's commercial local-rank analytics use therefore needs written source-rights review before live scans or retained customer results.

The repository's existing `google-search-business` function is not a GeoRank adapter: it sends a single Pakistan/English Maps SERP query with depth 10, without a selected location's coordinate grid, durable task lifecycle, cost reservation, or rank-history contract. It must not be reused or surfaced as local rank measurement.

No database schema change is safe yet. The read-only migration comparison ran before this Phase 2 migration was created: at that point there were 69 local files, 73 remote history rows, 29 exact pairs, 40 local-only pairs, and 44 remote-only pairs. The new local GeoRank migration is not deployed; the checkout now has 70 files and 41 local-only pairs. Reconcile migration history before applying scan/job/reservation tables.

## Candidate capability and current economics

The official [DataForSEO Maps Live Advanced API documentation](https://docs.dataforseo.com/v3/serp-maps-live-advanced/) specifies `location_coordinate` as latitude, longitude, and zoom; supports `search_this_area`, device, and depth up to 700. Its example says one task per live request, and the response identifies Maps items as `maps_search` with a `rank_group`; the local adapter follows those shapes and sends one request per sampled point. This establishes technical capability, not permission for Moffu's product use.

At review time, official [Maps API pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api) listed $0.002 per Live SERP, $0.0012 per Priority SERP, and $0.0006 per Standard SERP, each covering up to 100 results. Additional result depth is billed in additional result batches. Rates can change; the adapter must obtain current/configured pricing and enforce a budget before submission rather than hard-code these review values.

The current [DataForSEO legal FAQ](https://dataforseo.com/help-center/quick-answers-to-frequently-asked-legal-questions) says its terms do not grant upstream Google rights, make customers responsible for upstream terms, prohibit raw standalone redistribution, and do not confirm an individual product's compliance. The [Terms of Service §7](https://dataforseo.com/terms-of-service) restricts using SERP data to compete with or adversely affect originating search engines. This report is a product/engineering gate, not legal advice or a determination that the use is permitted or prohibited.

Separately, [Google Maps Platform Terms §3.2.3](https://cloud.google.com/maps-platform/terms) restrict extracting/storing Maps content outside the Services and creating content from such content. GeoRank must not assume that a Maps/Places coordinate already stored by Moffu can be repurposed as an external scan-grid center without a source-specific rights review. Use only a center coordinate with documented permitted source and purpose.

## Existing repository findings

- `supabase/functions/google-search-business/index.ts` calls DataForSEO's Maps `live/advanced` endpoint with `location_name: Pakistan`, `language_name: English`, and `depth: 10`. It authenticates a signed-in user but accepts no location ID, tenant scope, center coordinate, grid, idempotency key, or usage reservation.
- `supabase/functions/google-competitors/index.ts` calls Google Places Nearby Search. Places ordering is discovery order and must not be relabeled as local rank. It has legacy identity/location issues already described in the master spec; the newer Google Profile analysis has separate category-based Places sample behavior.
- The Phase 2 branch contains a GeoRank customer page, authenticated Edge Function, scan/point/reservation migration, and cost reservation RPC. Edge Function `georank` is now deployed as v1 with JWT verification on; it only checks configuration until the scan schema and activation gates are ready. The migration has not been applied.
- No scan request was sent to DataForSEO or Google. No provider credentials were read or printed. No Supabase data or migration history was changed.

## Local Phase 2 slice

Added provider-neutral helpers in `supabase/functions/_shared/georank-core.ts`:

- Deterministic odd-square grid generation from a documented center coordinate and axis spacing using great-circle offsets; coordinates wrap correctly at the antimeridian.
- Point-state validation that only accepts a positive rank for `found`; failed, pending, and cancelled points remain unknown rather than rank zero.
- Completion, top-3/top-10 coverage, and mean observed rank with valid/found denominators and a survivorship-bias flag.
- Configurable cost estimation from a provider's billable-unit model and budget cap. No vendor price or provider is embedded in the core.

For an odd square of side `N` and spacing `s`, center-to-edge distance along either axis is `(N - 1) × s / 2`. This is not a corner distance or a circular radius. The core caps a grid at the caller-provided maximum (225 points by default); entitlement/provider limits must be applied before scan creation.

Focused tests are in `supabase/functions/_shared/georank-core.test.cjs`. They cover geometry, invalid configurations, antimeridian wrapping, missing/failing observations, invalid rank/state pairs, and over-budget estimation.

The local vertical slice adds `/georank`, location-owner and plan-entitlement checks, an authenticated `georank` function, strict grid/locale/device/depth allowlists, a user-scoped scan and point schema, RLS read policies, an atomic monthly spend reservation RPC, provider-reported cost reconciliation, 30-day result expiry with hourly `pg_cron` cleanup, scan history, a sampled-grid table, and truthful coverage denominators. The provider adapter uses the documented Maps result type/rank group and submits one live task per point with bounded concurrency. It stores only the target rank/status and point coordinates, not the provider's full result set.

The server disables scans unless all are configured server-side: `DATAFORSEO_AUTH`, `GEORANK_ENABLED=true`, `GEORANK_SOURCE_RIGHTS_APPROVED=true`, `GEORANK_PRICE_PER_REQUEST_USD`, and `GEORANK_MONTHLY_CAP_USD`. The Google Maps API key in Admin is not a DataForSEO ranking credential. Scan estimates display before the user submits billable requests. Source-rights approval and coordinate use remain unresolved, so the gate must stay disabled.

The current worker is a bounded synchronous Edge Function call, not a crash-resumable queue with leases/retries/cancellation. That durable-job requirement remains open before production automation.

## Gates before a real provider adapter and durable scan

1. Obtain counsel/vendor-reviewed written rights for Moffu's exact customer-facing use: rank observations, derived metrics, retention period, tenant display, export, and deletion. If no acceptable source/rights combination is available, keep GeoRank unavailable.
2. Identify a permitted scan-center coordinate source and record provenance/consent. Do not use GBP/Places coordinates outside their allowed purpose.
3. Reconcile local and production Supabase migration history before applying the new migration. Remote migration bodies were not compared.
4. Review the migration on a clean staging branch; run security/performance advisors and tenant-isolation checks before production DDL.
5. Add crash-resumable background work (leases, retries, cancellation, partial completion) and reconcile provider timeouts without releasing unknown spend.
6. Confirm the DataForSEO key and all GeoRank limits through server-side secrets; do not place the provider secret in Admin's Google Maps API setting or browser code.
7. Keep GeoRank disabled until permitted provider use/coordinate provenance is approved and a staged provider response passes cost, tenant-isolation, and output-contract review.

## Supabase migration-history re-audit

Read-only comparison against project `kgttncfkzdrgswfkkdji` on 2026-11-16 found:

- At audit time: 69 checked-in SQL files and 73 remote history rows.
- At audit time: 29 exact `(version, name)` pairs, 40 local-only pairs, and 44 remote-only pairs. The new, unapplied GeoRank migration adds one local-only pair, bringing the current checkout to 70 files and 41 local-only pairs.
- Two duplicate local version IDs: `20241025000028` (`add_feature_brand_brain_growth_scale`, `plans_admin_rls`) and `20241025000029` (`fix_annual_price_format`, `prefill_plan_display`).
- 26 migration names appear locally and remotely with different version IDs, including `waitlist`, `feedback_gating`, `location_insights`, several 2024-named changes re-stamped in October/November 2026, and recent page views/review highlights/Google location changes.

This is migration metadata only; remote SQL bodies were not retrieved or compared. No schema state or migration history was changed. The old Phase 0 count of 28 matching filename/version pairs was an initial comparison and is superseded by this normalized exact-pair comparison. The duplicate version IDs and re-stamped names require repository/history reconciliation before creating or applying Phase 2 DDL.

## Phase 2 checklist

| Requirement | State | Evidence / blocker |
|---|---|---|
| Approved provider and upstream use/retention/display rights | BLOCKED | DataForSEO is a technical candidate only; terms do not resolve Moffu's intended product use; obtain written rights review |
| Source-neutral geometry, state, metrics, and cost core | TESTED | `_shared/georank-core.ts`; 7 focused tests pass; strict standalone TypeScript check passes |
| Local scan schema, history, and atomic cost reservation | IMPLEMENTED LOCALLY | `20261116075126_georank_scans_and_usage_reservations.sql`; not applied due migration-history mismatch |
| Crash-resumable jobs, leases, retry, and cancellation | NOT STARTED | Current handler is bounded synchronous work; production queue worker remains required |
| Provider adapter | IMPLEMENTED BUT DISABLED | `supabase/functions/georank/index.ts`; no external requests made; rights and coordinate provenance unresolved |
| Competitor Radar integration | IN_PROGRESS | Existing GBP/Places competitor sample remains; no GeoRank comparisons exposed |
| Customer GeoRank UI | IMPLEMENTED LOCALLY, GATED | `/georank`; estimate, scan grid, metrics and history; needs migration, rights, and server config |
