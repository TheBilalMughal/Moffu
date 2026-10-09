# Start Here

## Product
A multi-tenant SaaS reputation agent. V1 integrates Google Business Profile only. Merchant onboarding builds a structured Brand Brain. Reviews are fetched from Google, analyzed for language/risk, drafted by an external LLM, then edited/approved/published by authorized humans. Future automation must remain explicit, granular and policy-safe.

## Workstream router
- Foundation/database/auth/RLS -> 02, 03, 04.
- Google/reviews -> 05 plus 04 and 10 for jobs.
- AI/Brand Brain -> 06 plus 05 review lifecycle.
- Customer UI -> 07 + 16.
- Admin -> 08 + 04 + 16.
- Billing/add-ons/payments -> 09 + 04 + 10.
- Jobs/email/notifications -> 10.
- Storage/support/privacy -> 11.
- Legal/consent/analytics -> 12.
- Rate limits -> 13.
- i18n/mobile responsive -> 14.
- Backup/retention/DR -> 15.
- Testing/deployment/observability -> 17.

Before work, consult `PROJECT-STATUS.md`, `PROJECT-MASTER-CHECKLIST.md`, `EXTERNAL-ACTIONS.md`, and `TBD-DECISIONS.md` only as needed.
