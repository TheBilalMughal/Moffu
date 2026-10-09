# Billing and Entitlements

Version plans/prices/add-ons/entitlements. EntitlementService is the only business-feature limit authority. Browser cannot submit authoritative totals. Provider-hosted checkout/portal handles sensitive payment methods. Verified webhooks/reconciliation control subscription state. Add-on quantities change effective limits; downgrades never auto-delete resources. Refund approval is separate from provider completion. Historical price/FX snapshots remain immutable.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
