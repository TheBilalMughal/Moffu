# Database and Supabase

## Core model
`auth.users` + profiles; organizations/members/relationships; regions/countries/timezones/currencies/exchange_rates; brands; locations; Google connections/secrets/mappings/cache; review workflows/drafts/publish attempts; Brand Brain/rules/examples/versions/preferences; customer/platform RBAC; invitations; audit/security events; notifications; billing/subscriptions/invoices/payments/refunds/usage; AI generations/prompt versions; flags; notes; impersonation; jobs/integration events; files; support; privacy/legal/consent/analytics/retention.

## IDs
UUID is real PK/FK. A concurrency-safe global sequence/entity reference system creates immutable human IDs. Never `MAX()+1`. Human route IDs resolve expected entity type -> UUID -> authorization; wrong type returns safe 404.

## RLS
Tenant-sensitive tables carry `org_id` where appropriate. Central helpers include membership, permission, platform permission and scope/location checks. Customer clients never use service-role bypass. Trusted service operations still validate caller/tenant/scope and audit.

## Integrity
Sole Owner protection, soft-delete with explicit retention, atomic ownership/invite/refund transitions, unique/idempotency constraints, UTC canonical timestamps, exact money/minor units, migrations-as-code, RLS isolation tests mandatory.
