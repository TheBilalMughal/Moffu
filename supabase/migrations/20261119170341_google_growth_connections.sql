-- Private per-user OAuth and property configuration for Search Console + GA4.
-- Access tokens must only be read or written by service-role Edge Functions.
create table if not exists public.google_growth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  oauth_state text,
  oauth_state_expires_at timestamptz,
  scopes text[] not null default '{}',
  search_console_site_url text,
  ga4_property_id text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_growth_connections_oauth_state_idx
  on public.google_growth_connections (oauth_state)
  where oauth_state is not null;

alter table public.google_growth_connections enable row level security;
revoke all on table public.google_growth_connections from public, anon, authenticated;
grant all on table public.google_growth_connections to service_role;

comment on table public.google_growth_connections is
  'Service-role-only OAuth tokens and selected Search Console / GA4 properties for Google Growth reporting.';
