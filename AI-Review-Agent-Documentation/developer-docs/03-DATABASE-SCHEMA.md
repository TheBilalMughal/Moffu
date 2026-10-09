# Database Schema

Key aggregates: identity/org/membership; regions/countries/currency/FX; brand/location; Google connection/mapping/cache; reviews/workflows/drafts/publish attempts; Brand Brain/rules/examples/versions; RBAC; billing/usage; jobs/notifications; files/support; privacy/legal/consent; analytics; retention/audit/security. UUID PKs + global immutable human reference IDs. Tenant tables are RLS protected. Soft deletion is lifecycle, not indefinite retention. Index org/scope/status/time/provider IDs and idempotency keys based on query plans.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
