# API Contracts

REST `/api/v1`. Success `{data,meta}`, error `{error:{code,message,requestId}}`. Cursor pagination and server-side filters. Critical writes accept idempotency keys; mutable resources use versions/optimistic concurrency. Stable errors include auth/forbidden/not-found/validation/conflict/Google reconnect/quota/AI failure/stale draft/entitlement/usage/billing/rate/service unavailable. Each endpoint documents auth, permission, scope, entitlement, input, output, errors, idempotency, audit, usage and side effects.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
