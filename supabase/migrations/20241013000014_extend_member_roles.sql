-- Migration: 014 — Extend member_role enum + seed permissions for new roles
-- Adds: super_admin, operations, live, finance, accounts to member_role

-- ── 1. Extend enum (PG12+ supports this inside a transaction) ─────────────────

ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'operations';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'accounts';

-- ── 2. Seed default permissions for new roles ─────────────────────────────────

-- super_admin: all permissions (mirrors owner)
INSERT INTO public.role_permissions (role, permission)
SELECT 'super_admin', key FROM public.customer_permissions
ON CONFLICT (role, permission) DO NOTHING;

-- operations: review management + locations + reports
INSERT INTO public.role_permissions (role, permission)
SELECT 'operations', key FROM public.customer_permissions
WHERE key IN (
  'reviews.view', 'reviews.generate', 'reviews.edit', 'reviews.approve',
  'reviews.publish', 'reviews.reject',
  'brand_brain.view',
  'reports.view',
  'locations.view', 'locations.manage',
  'team.view',
  'settings.view',
  'notifications.manage',
  'support.create',
  'privacy.request'
)
ON CONFLICT (role, permission) DO NOTHING;

-- live (live support): real-time review responses, read-only otherwise
INSERT INTO public.role_permissions (role, permission)
SELECT 'live', key FROM public.customer_permissions
WHERE key IN (
  'reviews.view', 'reviews.generate', 'reviews.edit',
  'brand_brain.view',
  'reports.view',
  'locations.view',
  'team.view',
  'settings.view',
  'support.create'
)
ON CONFLICT (role, permission) DO NOTHING;

-- finance: billing + reports only
INSERT INTO public.role_permissions (role, permission)
SELECT 'finance', key FROM public.customer_permissions
WHERE key IN (
  'billing.view', 'billing.manage',
  'reports.view', 'reports.export',
  'settings.view',
  'support.create',
  'privacy.request'
)
ON CONFLICT (role, permission) DO NOTHING;

-- accounts: billing view + reports view only
INSERT INTO public.role_permissions (role, permission)
SELECT 'accounts', key FROM public.customer_permissions
WHERE key IN (
  'billing.view',
  'reports.view',
  'settings.view',
  'support.create',
  'privacy.request'
)
ON CONFLICT (role, permission) DO NOTHING;
