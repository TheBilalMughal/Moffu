# Google Integration

Connect flow: authorize server request -> create secure OAuth state -> consent -> validate callback -> exchange tokens -> store secrets separately -> fetch accounts/locations -> explicit mapping -> sync. Review publish re-fetches provider state, validates exact draft/source version/risk/permission/scope, writes through provider adapter and records attempt. Ambiguous timeout triggers provider reconciliation before retry. Reconnect/revocation/location-access-loss are first-class states. Current Google docs/policy must be rechecked before production.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
