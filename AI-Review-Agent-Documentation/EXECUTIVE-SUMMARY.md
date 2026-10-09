# AI Review Agent - Executive Summary

## Product
AI Review Agent is a SaaS reputation-management platform for businesses that want faster, more consistent responses to online customer reviews without losing brand voice or operational control. The V1 product focuses on Google Business Profile.

## Core proposition
**A brand-trained AI reputation agent, not a generic AI reply generator.** Each business configures a persistent Brand Brain: tone, reply length, languages, negative-review rules, prohibited promises, preferred examples and location-specific overrides. A shared external LLM produces drafts using that context; the system does not train a separate LLM per customer.

## Customer journey
A business signs up, verifies its account, creates an organization, connects Google, selects locations and configures its Brand Brain. New Google reviews appear in a unified inbox. The system analyzes language and risk, creates an on-brand draft, and lets an authorized user edit, approve and publish. High-risk categories remain manual. Reports show review and response activity using provider-policy-aware data.

## Why the architecture matters
The product separates AI generation from business authority. The LLM never receives Google credentials and cannot publish on its own. Google remains the source of truth for review content and published replies. Authorization, tenant isolation, entitlements, rate limits, audit and provider reconciliation are enforced by the backend.

## Technology
- Next.js public marketing website on Vercel.
- React customer portal and React internal Admin portal on Vercel.
- Supabase PostgreSQL, Auth, RLS and Storage.
- Google Business Profile API via OAuth.
- Provider-agnostic AI gateway; no proprietary LLM in V1.
- Provider-neutral billing architecture, intended Australia-first Stripe integration subject to production configuration.
- Resend for transactional email behind an EmailProvider abstraction.
- PostHog for privacy-controlled product analytics, not canonical business state.
- Durable background jobs for review sync, AI work, notifications, exports, cleanup and reconciliation.

## Product surfaces
The customer portal covers Reviews, Brand Brain, Locations, Reports, Team, Billing, Google integration, Notifications, Security, Privacy and Support. Internal Admin provides organization/customer 360 views, platform RBAC, billing/refunds, Google troubleshooting, AI activity, system health, logs, compliance and configuration.

## Safety and trust
The design includes strict multi-tenant RLS, granular permissions, source/version checks before publishing, high-risk review escalation, idempotent external writes, audit trails, privacy/data-rights workflows, legal/consent versioning, data retention controls, backup/restore reconciliation and no hidden AI training from customer edits.

## Commercial architecture
Plans, prices, entitlements and add-ons are versioned and Admin-configurable rather than hard-coded. Add-ons can extend location, AI, team or future module capacity. Historical pricing and FX snapshots are preserved. Checkout and payment state are provider-authoritative; browser redirects never activate subscriptions by themselves.

## International readiness
The core is multi-market, multi-currency and multi-language ready. UI locale is separate from country, currency, timezone, legal jurisdiction and AI reply language. The product is responsive web-first; native mobile apps and push notifications are future scope.

## Design direction
A clean, operational SaaS aesthetic centered on deep green `#0D4C3C`, neutral surfaces, restrained iconography and real product UI. The product intentionally avoids generic “AI website” patterns such as purple gradients, glowing orbs, sparkle/robot imagery, emoji navigation and pill-heavy controls.

## Delivery discipline
The project includes a persistent master checklist and status system. Every approved requirement is tracked atomically from PENDING through implementation, testing, configuration and completion. Claude is instructed to inspect the actual repository/Supabase state, automatically remember pending work through project files, and never declare features complete based on UI alone.

## Launch dependencies
Production launch still depends on actual provider and business configuration: Google API/OAuth approval, final domains/DNS, Supabase production/backup settings, verified Resend domain, billing provider/webhooks/tax/entity setup, final pricing, legal review, privacy/retention decisions, monitoring and a tested disaster-recovery process. These are tracked separately so they cannot be forgotten.

## Long-term expansion
The architecture can later support additional review providers, agency workflows, public/mobile clients, push notifications, more AI providers or self-hosted models, advanced automation and broader analytics without changing the core principle: AI proposes; authorized backend workflows decide and act.
