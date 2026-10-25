-- ── Broadcasts (admin → portal users) ────────────────────────────────────────

create table public.broadcasts (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text        not null,
  type         text        not null default 'info' check (type in ('info', 'warning', 'success', 'error')),
  target_type  text        not null check (target_type in ('all', 'plan', 'org', 'user')),
  target_value text,                -- plan slug | org_id | user_id (null when all)
  status       text        not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at      timestamptz,
  sent_count   integer     not null default 0,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now()
);

-- Per-user notifications (portal inbox)
create table public.user_notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  broadcast_id uuid        references public.broadcasts(id) on delete set null,
  title        text        not null,
  body         text        not null,
  type         text        not null default 'info',
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.broadcasts         enable row level security;
alter table public.user_notifications enable row level security;

-- Platform members manage broadcasts
create policy "platform_members_manage_broadcasts"
  on public.broadcasts for all to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true));

-- Platform members can read/insert user_notifications (for broadcast send)
create policy "platform_members_manage_user_notifications"
  on public.user_notifications for all to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true));

-- Portal users read their own notifications
create policy "users_read_own_notifications"
  on public.user_notifications for select to authenticated
  using (user_id = auth.uid());

-- Portal users mark own notifications as read
create policy "users_update_own_notifications"
  on public.user_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index user_notifications_user_idx on public.user_notifications (user_id, is_read, created_at desc);
create index broadcasts_status_idx        on public.broadcasts (status, created_at desc);

-- ── Feature Flags ─────────────────────────────────────────────────────────────

create table public.feature_flags (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null unique,
  description      text,
  enabled_globally boolean     not null default false,
  rollout_pct      integer     not null default 0 check (rollout_pct between 0 and 100),
  tags             text[]      not null default '{}',
  created_by       uuid        references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Org-level overrides (override global flag for specific org)
create table public.org_feature_flags (
  id       uuid        primary key default gen_random_uuid(),
  org_id   uuid        not null references public.organizations(id) on delete cascade,
  flag_id  uuid        not null references public.feature_flags(id) on delete cascade,
  enabled  boolean     not null,
  set_by   uuid        references auth.users(id),
  set_at   timestamptz not null default now(),
  unique (org_id, flag_id)
);

alter table public.feature_flags     enable row level security;
alter table public.org_feature_flags enable row level security;

create policy "platform_members_manage_feature_flags"
  on public.feature_flags for all to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true));

create policy "platform_members_manage_org_feature_flags"
  on public.org_feature_flags for all to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.is_active = true));

create index org_feature_flags_flag_idx on public.org_feature_flags (flag_id);
create index org_feature_flags_org_idx  on public.org_feature_flags (org_id);

-- Seed a few common flags
insert into public.feature_flags (name, description, enabled_globally, tags) values
  ('new_dashboard_ui',     'Redesigned customer dashboard (beta)',        false, array['ui','beta']),
  ('ai_batch_replies',     'Generate AI replies in batch for all reviews', false, array['ai','beta']),
  ('advanced_analytics',   'Usage analytics and export in portal',         false, array['analytics']),
  ('google_auto_sync',     'Automatic hourly Google review sync',           false, array['google','automation']),
  ('review_sentiment',     'Sentiment analysis badge on review cards',      false, array['ai','ui']);
