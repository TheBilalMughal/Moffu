# Frontend and UI Design System

Use central tokens/primitives. Primary `#0D4C3C`, light neutral surfaces, moderate rectangular radius, restrained outline icons. No pills, emojis or generic AI decoration. Customer portal prioritizes review workflow; Admin is denser. Reviews are split view desktop/list-detail mobile. Airline-style filters/date picker. Every page has loading/empty/error/permission/integration states. Critical flows are mobile usable and keyboard accessible. No optimistic Google publish, finance or permission changes.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
