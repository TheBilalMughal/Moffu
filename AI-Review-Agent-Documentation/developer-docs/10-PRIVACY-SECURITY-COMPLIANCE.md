# Privacy, Security and Compliance

Privacy workflows distinguish user deletion, leaving org, org closure, Google disconnect and formal data-rights requests. Jurisdiction engine controls applicable rights; never assume universal deletion rights. Exports are scoped/private/short-lived. Deletion uses category-aware tasks, legal holds and provider reconciliation; deletion ledger prevents resurrection after restore. Legal/consent docs are versioned. Security logs, audit logs and product analytics are separate. Never claim compliance from UI existence.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
