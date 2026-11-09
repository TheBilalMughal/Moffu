# Claude Operating Contract

You are implementing this repository as a persistent engineering agent. The project files are the durable source of truth; chat history is not.

## Mandatory loop for every user request
1. Read the request and `AI-Review-Agent-Documentation/claude-docs/PROJECT-STATUS.md`.
2. Use `AI-Review-Agent-Documentation/claude-docs/REQUIREMENTS-INDEX.md` to identify affected domains and load only relevant specs.
3. Inspect current repository, migrations, Supabase state, tests and configuration before editing.
4. Resolve dependencies. Implement approved prerequisites in the same vertical slice when safe; surface external/TBD blockers instead of inventing them.
5. Implement the complete requested behavior across all applicable layers.
6. Run relevant tests/build/migrations and visually inspect UI work.
7. Update `AI-Review-Agent-Documentation/claude-docs/PROJECT-MASTER-CHECKLIST.md`, `AI-Review-Agent-Documentation/claude-docs/PROJECT-STATUS.md` and implementation evidence.
8. Never ask the user to restate a documented requirement or remember the roadmap.

## Authority order
1. Latest explicit user-approved change.
2. Locked decisions in `AI-Review-Agent-Documentation/claude-docs/DECISIONS.md`.
3. Authoritative feature specification.
4. Architecture/security/privacy rules.
5. Existing implementation.
6. Implementation preference.

## Context efficiency
Do not read the full documentation set for every task. Always read this file + status/index, then only the workstream docs. Cross-domain work may require multiple specs.

## Completion discipline
Never mark IMPLEMENTED because UI exists; never mark TESTED until tests pass; never mark CONFIGURED until real external configuration is verified; never mark COMPLETED while applicable gates remain open.

## Global non-negotiables
- V1 surfaces: Next.js public marketing site, React customer portal, React internal Admin portal. Responsive web only; native apps and advanced PWA capabilities are FUTURE.
- Backend: Supabase PostgreSQL + Auth + RLS. Sensitive provider operations execute server-side. Never expose service-role keys, OAuth refresh tokens, LLM keys or billing secrets to browsers.
- Google is source of truth for Google review content and published replies. AI generates drafts; backend authorizes all external actions.
- Primary UI color is `#6C55E8` (purple), hover `#5A42D1`. No pill/capsule visual language, emojis as product icons, generic AI gradients, glowing orbs, sparkle/robot/brain imagery or fake AI typing.
- No Dead UI: every visible control is wired, deliberately disabled with truthful state, or omitted.
- Never invent pricing, legal conclusions, retention periods, provider limits, RPO/RTO, launch languages or external approval status. Preserve TBDs.
- Tenant isolation, RLS, permissions, scopes, entitlements, rate limits, audit and privacy are backend-enforced.
- External writes (Google, billing, refunds, email where relevant) are idempotent/reconciled; ambiguous outcomes are checked before retry.
- Completion means applicable UI + backend + DB + migrations + RLS + permissions + validation + provider integration + jobs + audit + errors + responsive/accessibility + tests + docs/config verification.

## Documentation locations
- Project root: `E:\Moffu`.
- Resolve the documentation paths in this file from the project root.
- Start with `AI-Review-Agent-Documentation/claude-docs/00-START-HERE.md`.
- Authoritative implementation specs, decisions, status and checklists live in `AI-Review-Agent-Documentation/claude-docs/`. Resolve numbered specs and bare document filenames mentioned within that folder relative to that folder.
- Human developer reference documentation lives in `AI-Review-Agent-Documentation/developer-docs/`.
- Update status and checklists in their existing documentation folder; do not create duplicate copies in the project root.
