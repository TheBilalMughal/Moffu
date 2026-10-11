# Billing, Plans, Add-ons and Payments

## Model
Plan != Subscription != Usage. Versioned plans/prices/entitlements, subscriptions/events, usage events/aggregates, invoices/payments/refunds, billing webhook events and org overrides.

## Plans/add-ons
Admin-defined unlimited plan catalog; no hard-coded plan count. Entitlements BOOLEAN/LIMIT/UNLIMITED/ENUM. Add-ons are generic and quantity-based (locations, AI packs, seats, support/modules). Effective entitlement = plan version + subscription add-ons + org overrides + feature flags + subscription state.

## Australia-first provider architecture
Provider-neutral BillingProvider; intended initial provider Stripe/Stripe Billing subject to current availability/config. Primary launch currency may be AUD when configured; core remains multi-market/currency. Browser sends version refs/quantities, never authoritative price/tax/total. Hosted checkout/portal preferred for sensitive payment methods.

## Lifecycle
Verified webhook/provider reconciliation activates subscription, never success redirect alone. Upgrades/downgrades/add-on changes show authoritative preview/proration where available. Capacity reduction never auto-deletes customer resources. Payment failure uses configured dunning/grace; cancellation and refunds are reconciled.

## Tax
Tax architecture supports inclusive/exclusive and TaxService/provider adapter. Never hard-code GST legal conclusions. Billing profiles support legal business data/ABN where applicable. Preserve historical pricing/FX snapshots.

## Approved usage reset cadence - 2026-10-11
| Plan | Allowance period |
| --- | --- |
| Free | Weekly: every 7 days |
| Starter | Monthly |
| Growth | Monthly |
| Scale | Monthly |
| Custom paid | Monthly; quantities defined in the agreed plan |

Free includes 7 published replies and 14 AI drafts per weekly period. Paid quantities belong to the versioned plan configuration, not a weekly subdivision. Annual payment keeps monthly allowances; do not release 12 months of credits upfront.

Reset renews usage allowance without deleting stored reviews, drafts, Brand Brain data or historical usage events. Locations, team members and Brand Brain profiles are capacity entitlements, not resettable counters. Show the period and next reset date beside usage in the UI.

This section records an approved product requirement, not an implemented or tested reset mechanism. Exact period anchors/timezone, rollover, transition handling and final paid quantities/prices must be documented before implementation. In particular, the suggested Scale increase from 1,000 to 2,000 AI drafts is not approved by this cadence-only decision.

## Pricing table reset labels - 2026-10-11
Cadence-only display correction requested by the user. Preserve all existing prices, quantities, Brand Brain values, seats and support levels.
- Rename the shared row label Published replies / weekly to Published replies.
- Rename the shared row label AI drafts / weekly to AI drafts.
- Append / week to the existing Free reply and AI-draft quantities.
- Append / month to the existing Starter, Growth and Scale reply and AI-draft quantities.
- Add a Usage reset row: Free Weekly; Starter Monthly; Growth Monthly; Scale Monthly.
- Annual paid billing still uses monthly allowances.
This documents presentation requirements only; it does not implement reset enforcement or approve other entitlement changes.
