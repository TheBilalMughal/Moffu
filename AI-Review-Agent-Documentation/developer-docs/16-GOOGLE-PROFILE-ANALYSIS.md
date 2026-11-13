# Google Profile business analysis

## Behavior
The Google Profile page uses the global selected location. With All Locations selected, a local selector chooses one enabled location explicitly. Invalid selections never fall back to another business. Abort and response-identity checks prevent a late request from overwriting the next selection.

Analysis refreshes on page load, location/radius changes, manual refresh, and every 15 minutes while the page is visible. This is on-demand page automation, not an unattended scheduled monitoring service.

## Data and scope
- New authenticated Edge Function: google-profile-analysis. POST requires a location UUID and radius_km of 5, 10, 20 or 30.
- Current integration is user-scoped. User identity is validated with auth.getUser; active account and active-subscription feature access are enforced; location and connection ownership are checked explicitly before service-role reads or external calls. Team-wide access is not silently introduced.
- Google Business Information categories.primaryCategory and profile.description are separate source fields. The endpoint reads them directly for the selected resource; the legacy description column is never treated as a category.
- No schema change is required. Live fields and competitor responses are not written to a new permanent data store.
- Profile category, phone, website, hours, address/service area and metadata use the Business Information API.
- Performance uses locations:fetchMultiDailyMetricsTimeSeries for the last 30 completed UTC days and parses nested dailyMetricTimeSeries.
- Search terms use searchkeywords/impressions/monthly for the last completed UTC calendar month. Google privacy thresholds remain thresholds. First 100 terms are shown with an explicit truncation note when applicable.
- Own Google rating uses Place Details by verified place ID. No name-based identity guess.
- Competitors use Places Text Search (New) with the business category and circle location bias, followed by exact distance filtering. Up to 20 returned results, not a market census, organic rank or exhaustive radius query. Source attribution and provider attribution links are displayed.
- Geographic public query volume and geo-grid ranking require a separately configured data source. The implemented Google endpoints do not provide public radius-level search demand.

## Readiness
Moffu SEO readiness is an explicit diagnostic, not an official Google score. Nine visible checks total 100 weight. Unknown checks are excluded from the denominator and coverage is displayed. Response coverage (80%) and review recency (30 days) are Moffu heuristics, not Google ranking weights. No invented ranking or search-volume claims.

## Reliability and configuration
Requires existing Google OAuth configuration/tokens. Competitor data and own public rating additionally require GOOGLE_MAPS_API_KEY or the existing server-side google_maps_api_key setting, Places API (New), and Google billing/permissions. Missing configuration is shown as unavailable, not zero.

Provider requests have timeouts, errors are sanitized, and sections fail independently. Requests are coalesced while in flight. A small per-isolate request limiter is defense in depth only; it is not a distributed rate-limit or durable queue implementation. Provider content is not cached to disk or browser storage. Authenticated responses use Cache-Control: no-store.

## Verification
Run node --test supabase/functions/google-profile-analysis/analysis.test.cjs from the repository root. It checks category separation, unknown scoring, thresholds, nested Google metrics, zero coordinates, radius filtering, ID identity, authentication, validation and cross-user no-fallback handling.
Run the portal TypeScript check and Vite production build. Live authenticated provider verification and visual QA must be recorded separately from local checks.

## Sources
- https://support.google.com/business/answer/7091
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations
- https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
- https://developers.google.com/my-business/reference/performance/rest/v1/locations.searchkeywords.impressions.monthly/list
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies

Local verification (2026-11-13): 10 Node tests, portal TypeScript and Vite production build passed. Desktop/mobile fixture QA inspected location/category/radius/error states. Production deployment and authenticated provider verification remain pending.
