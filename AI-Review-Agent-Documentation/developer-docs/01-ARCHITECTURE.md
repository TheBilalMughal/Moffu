# Architecture

Clients -> versioned API/services -> Supabase/Auth/Postgres/RLS + durable jobs -> Google/AI/Billing/Email/Storage/Analytics adapters. Shared contracts define schemas/errors/permissions/enums/types. Service boundaries keep provider DTOs out of domain models. Human reference IDs map to UUIDs before authorization. Use transactions for DB invariants but never hold DB transactions across long external calls.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
