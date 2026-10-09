# Deployment, Operations and DR

Deploy migrations/backend/workers/frontends with staged verification. Observability includes request IDs, metrics, traces, integration/job health and alerts without sensitive payloads. Backup strategy covers DB, object storage and critical config; provider capabilities are verified, not assumed. Restore occurs in isolation, replays deletion ledger/legal holds, reconciles external providers and prevents duplicate side effects before workers resume. RPO/RTO and retention periods remain explicit business/provider/legal configuration.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
