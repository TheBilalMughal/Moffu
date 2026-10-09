# Jobs, Notifications and Email

Use durable DB-backed queue/equivalent with leases, idempotency, retry budgets, backoff/jitter, dedupe and DLQ. Core jobs cover sync, AI, notifications/email, cleanup, usage, exports, retention and reconciliation. Recipient access is recalculated at dispatch. Resend is V1 EmailProvider; templates are versioned/localized. Transactional email is separate from marketing. Provider/email outage cannot roll back the originating business transaction.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
