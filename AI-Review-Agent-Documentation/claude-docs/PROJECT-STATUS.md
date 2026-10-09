# Project Status

## Current milestone
PHASE 1 — Foundation (IN PROGRESS)

## Completed (Phase 1)
- Monorepo initialized: pnpm workspaces + Turborepo, root `package.json`, `tsconfig.base.json`, `.gitignore`, `.prettierrc`
- `packages/config`: shared ESLint and TypeScript configs (base/react/next)
- `packages/types`: shared TypeScript types — auth, organization, RBAC, common primitives
- `packages/ui`: design tokens (#0D4C3C brand palette), Button/Input/Label/Alert primitives, `cn()` utility
- `apps/web`: Next.js 14 marketing site scaffold, Tailwind, globals.css, placeholder homepage, `.env.example`
- `apps/portal`: Vite/React customer portal, Supabase auth client, auth service + store (Zustand), Login/Signup/ForgotPassword/ResetPassword/VerifyEmail pages, AuthGuard/GuestGuard, route structure, `.env.example`
- `apps/admin`: Vite/React admin portal, platform RBAC auth store, AdminLoginPage, AdminAuthGuard (checks platform_members), `.env.example`
- `supabase/`: Supabase project initialized (`config.toml`), 5 migrations written:
  - `000001`: Extensions (uuid-ossp, pgcrypto, citext) + human reference ID system (`next_ref_id()`)
  - `000002`: Regions, countries, currencies (reference data, all `is_active=false` pending TBD launch decisions)
  - `000003`: User profiles (auto-trigger on auth.users insert), organizations, org_members, invitations — RLS policies, sole owner protection
  - `000004`: Customer RBAC (permission registry, role_permissions, user overrides, platform_members), last-super-admin protection, `has_permission()` function
  - `000005`: Audit events + security events (append-only, RLS)

## Phase 1 completion gates
- **DONE**: `pnpm typecheck` — 6/6 packages pass (2026-10-09). Fixed: `vite/client` types missing in portal/admin tsconfigs, and `onAuthStateChange` callback async signature mismatch.
- **NOTE**: `pnpm install` exits code 1 due to pnpm 12.4.2 `ERR_PNPM_IGNORED_BUILDS` security check for esbuild. All packages ARE installed (424 cached). Run `pnpm approve-builds` interactively to permanently resolve; typecheck/build work regardless.
- Supabase migrations NOT tested: Docker Desktop not installed; local Supabase stack cannot start
- No `.env.local` files — Supabase credentials not yet provided

## Phase 2 planned
- Onboarding flow (org creation, country/timezone, Brand Brain setup)
- Google OAuth connection (disabled/mocked until credentials provided)
- Review workflow foundation

## External/configuration
See `EXTERNAL-ACTIONS.md`.
- **BLOCKS migrations test**: Docker Desktop required for local Supabase OR provide cloud Supabase credentials
- **BLOCKS all auth/UI testing**: Supabase project URL + anon key required in `.env.local`

## Rule
When asked "pending kya hai?" inspect actual code/database/config/tests; never guess from chat history.
