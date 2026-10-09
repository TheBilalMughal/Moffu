# System Architecture

## Surfaces
- `example.com`: Next.js marketing, SSR/SSG, SEO/indexable.
- `app.example.com`: React customer portal, private/noindex.
- `admin.example.com`: React internal Admin, private/noindex.

## Backend
Versioned `/api/v1` service-oriented backend using Supabase Auth/Postgres/RLS. Services: Auth, Organization, Permission, Onboarding, GoogleBusiness, Review, BrandBrain, AI, Publish, Notification, Billing, Entitlement, Usage, Audit, Admin, Job, Storage, Privacy, Support.

## External adapters
`ReputationProvider` (Google first), `AIProvider`, `BillingProvider`, `EmailProvider`, `StorageProvider`, optional ProductAnalyticsProvider. Provider DTOs stay separate from internal domain models.

## Request lifecycle
Auth -> account state -> org membership -> permission -> scope -> validation -> entitlement/rate checks -> service -> DB/provider -> audit/usage -> safe response.

## Global non-negotiables
- V1 surfaces: Next.js public marketing site, React customer portal, React internal Admin portal. Responsive web only; native apps and advanced PWA capabilities are FUTURE.
- Backend: Supabase PostgreSQL + Auth + RLS. Sensitive provider operations execute server-side. Never expose service-role keys, OAuth refresh tokens, LLM keys or billing secrets to browsers.
- Google is source of truth for Google review content and published replies. AI generates drafts; backend authorizes all external actions.
- Primary UI color is `#0D4C3C`. No pill/capsule visual language, emojis as product icons, generic AI gradients, glowing orbs, sparkle/robot/brain imagery or fake AI typing.
- No Dead UI: every visible control is wired, deliberately disabled with truthful state, or omitted.
- Never invent pricing, legal conclusions, retention periods, provider limits, RPO/RTO, launch languages or external approval status. Preserve TBDs.
- Tenant isolation, RLS, permissions, scopes, entitlements, rate limits, audit and privacy are backend-enforced.
- External writes (Google, billing, refunds, email where relevant) are idempotent/reconciled; ambiguous outcomes are checked before retry.
- Completion means applicable UI + backend + DB + migrations + RLS + permissions + validation + provider integration + jobs + audit + errors + responsive/accessibility + tests + docs/config verification.
