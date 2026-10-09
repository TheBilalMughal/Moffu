# Troubleshooting Guide

Start from request ID and user/org/reference ID, then classify: auth/session, permission/scope/RLS, entitlement/rate, DB invariant, job/queue, Google, AI, billing, email/storage or frontend state. Never “fix” by disabling RLS, using service-role in browser, bypassing permission checks, retrying ambiguous external writes blindly, or changing workflow state manually without reconciliation. Capture sanitized evidence and add regression tests for confirmed defects.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
