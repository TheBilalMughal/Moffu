# HeyMoffu — Pricing and Admin Management Handoff

Date: 11 October 2026

Status: Product requirements and implementation handoff. This document does not certify that billing or quota enforcement is implemented. Integrate into the existing partially completed product; do not restart it.

## 1. Source of truth

All commercial pricing and plan configuration must be managed through the internal Admin portal and persisted in the database. Public website pricing, customer portal, checkout, and backend entitlement enforcement must consume the same published, versioned catalog.

Do not hard-code plan names, plan count, prices, discounts, limits, support labels, feature lists, badges or display order into application components. The table below is the initial user-supplied configuration, not a permanent code constant. Idempotent initial seed data is acceptable; redeployments must never overwrite subsequent Admin changes.

## 2. Initial pricing configuration

Currency: USD. Annual upfront payment: 20% discount. Monthly equivalents are display amounts, not monthly installments.

| Feature | Free | Starter | Growth | Scale |
| --- | --- | --- | --- | --- |
| Monthly price | $0 | $19 | $49 | $99 |
| Annual billing — monthly equivalent | — | $15.20 | $39.20 | $79.20 |
| Total annual payment | — | $182.40 | $470.40 | $950.40 |
| Locations | 1 | 1 | 3 | 5 |
| Published replies | 7 / week | 100 / month | 300 / month | 1,000 / month |
| AI drafts | 14 / week | 200 / month | 600 / month | 2,000 / month |
| Usage reset | Weekly | Monthly | Monthly | Monthly |
| Team members, owner included | 1 | 2 | 5 | 10 |
| Brand Brain profiles | — | 2 | 3 | All |
| Support | Help guides | Standard email | Priority email | Priority email |

Custom: show “Contact sales”; do not invent a fixed price or unlimited access.

The table preserves the latest supplied screenshot. Free Brand Brain was blank and Scale says “All”. Before enforcing these two entitlements, confirm what they mean. A blank cell must not silently mean zero, and “All” must not silently become unlimited profile creation. Preserve these labels in design previews and flag unresolved entitlement semantics before publishing the affected configuration.

## 3. Admin portal controls

Authorized internal administrators can:

- Create and edit draft plans; preview, publish and archive plan versions.
- Configure names, descriptions, visibility, display order, optional featured badge, feature labels and support tier.
- Configure currency, monthly price, annual discount and resulting annual charge. Use integer minor currency units and a defined rounding rule; display the actual annual charge and derived monthly equivalent consistently.
- Configure locations, published replies, AI drafts, team members and Brand Brain entitlements using typed values (boolean, numeric limit, explicit unlimited, enum), not display-string parsing.
- Configure usage cadence separately from payment cadence. Initial defaults: Free weekly; paid monthly, including annual subscriptions.
- Configure available add-ons and Custom contact-sales behavior when those features exist. Do not ship invented add-on prices.
- Review audit history showing actor, time, previous/new values and published version.

Validation must prevent negative prices or limits, invalid discounts and unresolved required entitlements from being published. Zero and unlimited must be distinct. Customer/tenant administrators cannot edit the platform catalog.

## 4. Consistent pricing and checkout

- Fetch public pricing through an appropriate read-only public endpoint/view exposing only published public fields.
- The backend resolves plan versions, entitlements, prices and totals; never trust browser-supplied amounts or limits.
- Refresh/invalidate pricing caches when an Admin publishes a new version so the website and portal show the same catalog.
- Checkout must reference the appropriate active provider price and server-side plan version. Detect stale selections and show the current price before charging.
- Keep provider integration behind the existing billing abstraction. If using Stripe, create a new provider price for changed amounts instead of pretending to mutate an existing price.
- Publishing an edit must not silently reprice existing subscribers or reduce their entitlements. Keep their subscribed version until an explicit, previewed migration/change policy is chosen.
- Preserve invoices, price history and audit records; archive rather than delete plans with subscribers.
- Activate paid entitlements only after verified payment-provider events/reconciliation, not merely a success-page redirect. Handle duplicate/out-of-order events idempotently.

## 5. Usage and reset behavior

Free renews every seven days. Paid usage renews monthly even when the customer pays annually. Never grant a full annual allowance upfront or subdivide paid monthly allowances into weekly quotas.

Locations, members and Brand Brain profiles are capacity entitlements. Only metered reply/draft allowances reset. Do not delete reviews, drafts, profiles or usage-event history at reset.

Persist explicit period start/end timestamps and enforce quotas server-side with atomic reservations/commit/release so concurrent requests cannot overspend. Retries must not double-charge usage. Show current usage, remaining allowance and next reset timestamp in the portal.

Before implementation, document the remaining details: period anchor and timezone; month-end/leap-year behavior; carryover; upgrade/downgrade and cancellation transitions; treatment of purchased packs. Changing plans must not accidentally reset allowances or multiply credits.

Proposed metering behavior to confirm against existing implementation: one successful AI draft consumes one draft unit; user-requested regeneration consumes another; manual editing is not AI usage; failed attempts release reserved quota; publishing consumes a reply unit only on confirmed success. Define whether edits to an already-published reply consume a new unit. These counting semantics must be explicit rather than inferred from labels.

## 6. Integrate with existing progress

Read root CLAUDE.md, current status/index, billing spec and relevant existing code/migrations first. Identify what already works and reuse it. Do not replace existing auth, styling, routes, schema or provider integration unnecessarily.

Implement the smallest coherent changes covering Admin configuration, database/migrations/RLS, published pricing reads, checkout and backend enforcement as applicable. Keep incomplete external integrations truthfully disabled or labelled; do not fabricate successful payments or resets.

Reconcile existing documentation with these latest requirements. Earlier notes calling all prices TBD or describing an AUD launch are superseded for this USD pricing proposal; retain unrelated tax/legal/provider questions. Keep the two ambiguous Brand Brain cells unresolved until clarified.

## 7. Required verification

- A permitted Admin can publish a price/limit change and see matching values on website and portal without a code deployment.
- A customer or unauthorized user cannot modify prices, plan versions, provider mappings or effective entitlements.
- Annual totals and monthly equivalents match the configured discount and rounding policy.
- Existing subscriptions retain their versions after a new catalog version is published.
- Boundary tests cover seven-day Free renewals, monthly paid renewals, annual payment with monthly usage, month-end behavior and concurrent generation requests.
- Duplicate provider callbacks/usage retries do not grant or consume quota twice; failures release reservations.
- Stored customer content survives quota resets.
- Run relevant repository tests/build checks and inspect the affected UI. Distinguish tested local behavior from verified live provider behavior.

Update the original status/checklist files with actual evidence. Report remaining decisions or missing credentials precisely.
