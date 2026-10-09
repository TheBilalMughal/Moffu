# Authentication, RBAC and RLS

Supabase Auth handles identity. Organization membership and platform roles are separate. Permission resolution includes role/custom role/user override and region/org/location scope; deny wins. RLS mirrors tenant access and must be tested for cross-org reads/writes/ref guessing. Sole Owner and final Super Admin cannot be accidentally removed. Admin impersonation records actual/effective actor and never bypasses sensitive restrictions.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
