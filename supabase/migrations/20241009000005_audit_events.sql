-- Migration: 005 — Audit events and security events
-- Purpose: Durable audit log for all significant actions.
-- Audit records are append-only (no UPDATE/DELETE via RLS).
-- Actual/effective actor distinction is required for impersonation.

create type public.audit_actor_type as enum ('user', 'system', 'platform_admin');

create table public.audit_events (
  id              uuid        primary key default gen_random_uuid(),
  -- Actor: who took the action
  actor_type      public.audit_actor_type not null default 'user',
  actor_user_id   uuid        references public.profiles(id),
  -- Effective actor: set when a platform admin impersonates
  effective_user_id uuid      references public.profiles(id),
  -- Scope
  org_id          uuid        references public.organizations(id),
  -- Action
  action          text        not null,  -- e.g. 'review.published', 'member.invited'
  resource_type   text,                  -- e.g. 'review', 'organization'
  resource_id     text,                  -- UUID or human ref_id of affected resource
  -- Payload (sanitized — no secrets/PII beyond what's needed for audit)
  metadata        jsonb       not null default '{}',
  -- Attribution
  ip_address      inet,
  user_agent      text,
  -- Time
  created_at      timestamptz not null default now()
);

comment on table public.audit_events is
  'Append-only audit log. Never updated or deleted during normal operations. '
  'effective_user_id is set when a platform admin acts via impersonation.';

create index idx_audit_actor       on public.audit_events(actor_user_id, created_at desc);
create index idx_audit_org         on public.audit_events(org_id, created_at desc) where org_id is not null;
create index idx_audit_resource    on public.audit_events(resource_type, resource_id, created_at desc);
create index idx_audit_action      on public.audit_events(action, created_at desc);
create index idx_audit_created_at  on public.audit_events(created_at desc);

-- RLS: append-only. Only service role inserts.
-- Org members can read their org's audit events (platform admins via service role).
alter table public.audit_events enable row level security;

create policy "audit_events_select_org_members"
  on public.audit_events for select to authenticated
  using (org_id is not null and public.is_org_member(org_id));

-- No INSERT/UPDATE/DELETE policies — only service role can write audit events

-- -----------------------------------------------------------------------
-- Security events (auth-level: failed logins, suspicious activity)
-- -----------------------------------------------------------------------

create table public.security_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references public.profiles(id),
  event_type    text        not null,  -- e.g. 'login_failed', 'password_reset_requested'
  ip_address    inet,
  user_agent    text,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);

comment on table public.security_events is
  'Security-relevant auth events for abuse detection and compliance.';

create index idx_security_events_user    on public.security_events(user_id, created_at desc);
create index idx_security_events_type   on public.security_events(event_type, created_at desc);
create index idx_security_events_ip     on public.security_events(ip_address, created_at desc);

alter table public.security_events enable row level security;
-- Service role only — no direct client access
