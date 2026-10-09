# Testing

Risk-weighted testing: type/lint/build; unit domain rules; integration DB/RLS/API/provider mocks; E2E critical journeys; visual/accessibility/responsive regression. Explicitly test cross-tenant denial, stale review/draft, duplicate publish, ambiguous provider outcomes, billing tampering/webhook duplication, quota concurrency, privacy deletion/reconciliation, notification recipients, owner/admin protections and mobile critical workflows.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
