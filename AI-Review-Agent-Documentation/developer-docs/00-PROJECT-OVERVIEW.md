# Project Overview

The product is a multi-tenant AI reputation-management SaaS. V1 connects Google Business Profile, lets a merchant configure a Brand Brain, fetches reviews, produces risk-aware brand-specific reply drafts, and publishes only through an authorized backend workflow after human approval. Three surfaces exist: public Next.js website, React customer portal, React internal Admin. V1 is responsive web only.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
