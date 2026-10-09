# Testing, Deployment and Observability

## Test layers
Static checks -> unit -> integration -> E2E -> production monitoring. Test RLS cross-tenant isolation, permission matrix, owner/admin protections, API contracts, review state/stale/concurrency, OAuth/provider failures, AI adversarial/structured validation, billing tamper/webhook/refund/usage concurrency, notification recipients, privacy/support, SEO, responsive/accessibility and visual design rules.

Use Playwright for critical E2E. Stable fixtures. CI: install -> typecheck -> lint -> unit -> integration -> build -> selected E2E.

## Deployment
Feature branch -> PR -> CI -> review -> merge -> staging -> smoke -> production. Separate dev/staging/prod configs/credentials. Migrations as code; phased destructive changes. Vercel previews never receive production secrets.

## Observability
Logs/metrics/traces/alerts with request IDs and no sensitive payloads. Audit logs separate from system/security logs. System Health shows actual state/freshness. Monitor jobs, integrations, backup/retention, provider errors, slow queries and data-quality pipelines. Backups and restore tests are operational requirements.
