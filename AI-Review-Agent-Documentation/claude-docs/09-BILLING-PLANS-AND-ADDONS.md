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
