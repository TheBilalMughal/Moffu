-- Migration: 050 — Seed admin.* permission keys into customer_permissions
-- These are the keys used by the admin portal Roles & Permissions page.

INSERT INTO public.customer_permissions (key, description) VALUES
  -- Dashboard
  ('admin.dashboard.view',          'View the admin dashboard'),
  -- Clients
  ('admin.clients.view',            'View clients list'),
  ('admin.clients.add',             'Add new clients'),
  ('admin.clients.edit',            'Edit client details'),
  ('admin.clients.delete',          'Delete clients'),
  ('admin.usage.view',              'View usage analytics'),
  ('admin.subscriptions.view',      'View subscriptions'),
  ('admin.subscriptions.edit',      'Edit subscriptions'),
  ('admin.subscriptions.delete',    'Cancel/delete subscriptions'),
  ('admin.reports.view',            'View reports'),
  ('admin.reports.export',          'Export reports'),
  -- Finance
  ('admin.mrr.view',                'View MRR dashboard'),
  ('admin.payments.view',           'View payments'),
  ('admin.payments.edit',           'Edit payment records'),
  ('admin.payments.refund',         'Issue refunds from payments'),
  ('admin.coupons.view',            'View coupons'),
  ('admin.coupons.add',             'Create coupons'),
  ('admin.coupons.edit',            'Edit coupons'),
  ('admin.coupons.delete',          'Delete coupons'),
  ('admin.refunds.view',            'View refund requests'),
  ('admin.refunds.create',          'Create refund requests'),
  -- Platform
  ('admin.broadcasts.view',         'View broadcasts'),
  ('admin.broadcasts.add',          'Create broadcasts'),
  ('admin.broadcasts.edit',         'Edit broadcasts'),
  ('admin.broadcasts.delete',       'Delete broadcasts'),
  ('admin.waitlist.view',           'View join waitlist'),
  ('admin.waitlist.edit',           'Edit waitlist entries'),
  ('admin.waitlist.delete',         'Delete waitlist entries'),
  ('admin.flags.view',              'View feature flags'),
  ('admin.flags.add',               'Create feature flags'),
  ('admin.flags.edit',              'Edit feature flags'),
  ('admin.flags.delete',            'Delete feature flags'),
  ('admin.integrations.view',       'View integrations health'),
  ('admin.integrations.edit',       'Edit integration settings'),
  -- Administration
  ('admin.users.view',              'View platform users'),
  ('admin.users.add',               'Add platform users'),
  ('admin.users.edit',              'Edit platform users'),
  ('admin.users.delete',            'Delete platform users'),
  ('admin.roles.view',              'View roles & permissions'),
  ('admin.roles.edit',              'Edit role permissions'),
  ('admin.audit.view',              'View audit logs'),
  -- Settings
  ('admin.settings.view',           'View platform settings'),
  ('admin.settings.edit',           'Edit platform settings')
ON CONFLICT (key) DO NOTHING;
