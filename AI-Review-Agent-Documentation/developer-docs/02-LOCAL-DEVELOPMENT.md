# Local Development

Use separate dev/staging/prod environments. Keep `.env.example` with variable names only; validate required env at startup. Never commit secrets. Apply migrations/seeds through code. Run typecheck/lint/unit/integration/build before PR. Provider integrations should have safe dev/test modes or mocks; never point local work at production credentials by default. Vercel preview deployments must not inherit production secrets.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
