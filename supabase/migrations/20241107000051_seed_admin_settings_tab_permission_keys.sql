-- Migration: 051 — Seed per-tab admin settings permission keys
INSERT INTO public.customer_permissions (key, description) VALUES
  ('admin.settings.general.view',   'View general settings'),
  ('admin.settings.general.edit',   'Edit general settings'),
  ('admin.settings.packages.view',  'View packages settings'),
  ('admin.settings.packages.edit',  'Edit packages settings'),
  ('admin.settings.ai.view',        'View AI keys settings'),
  ('admin.settings.ai.edit',        'Edit AI keys settings'),
  ('admin.settings.google.view',    'View Google API settings'),
  ('admin.settings.google.edit',    'Edit Google API settings'),
  ('admin.settings.sync.view',      'View review sync settings'),
  ('admin.settings.sync.edit',      'Edit review sync settings'),
  ('admin.settings.email.view',     'View email settings'),
  ('admin.settings.email.edit',     'Edit email settings'),
  ('admin.settings.security.view',  'View security settings'),
  ('admin.settings.security.edit',  'Edit security settings')
ON CONFLICT (key) DO NOTHING;
