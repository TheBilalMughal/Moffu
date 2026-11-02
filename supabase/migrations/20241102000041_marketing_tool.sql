-- Migration: 041 — Marketing Tool
-- Purpose: AI social media post generator with content calendar,
--          image library, approval flow and scheduling.

-- ─────────────────────────────────────────────────────────────────
-- 1. marketing_settings  (org-level, one row per org)
-- ─────────────────────────────────────────────────────────────────

create table public.marketing_settings (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null references public.organizations(id) on delete cascade,
  -- Business context for AI
  business_category     text        not null default 'other'
    check (business_category in (
      'restaurant','cafe','hotel','retail','travel','beauty','healthcare',
      'education','real_estate','automotive','technology','other'
    )),
  -- Post style preferences (array: gen_z, casual, professional, inspirational, humorous)
  post_styles           text[]      not null default '{casual}',
  -- Target platforms
  target_platforms      text[]      not null default '{instagram,facebook}',
  -- Frequency goal (informational only — no auto-publish yet)
  post_frequency        text        not null default 'daily_1'
    check (post_frequency in ('daily_1','daily_2','weekly_3','weekly_1','custom')),
  -- Extra instructions for the AI (freeform)
  custom_instructions   text,
  -- Auto-approve generated posts (skip approval step)
  auto_approve          boolean     not null default false,
  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id)
);

comment on table public.marketing_settings is
  'Per-org marketing AI configuration: category, style, platforms, frequency.';

create index idx_marketing_settings_org on public.marketing_settings(org_id);

create trigger marketing_settings_updated_at
  before update on public.marketing_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 2. marketing_image_library  (org images, optionally per-location)
-- ─────────────────────────────────────────────────────────────────

create table public.marketing_image_library (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  location_id   uuid        references public.google_locations(id) on delete set null,
  uploaded_by   uuid        references public.profiles(id) on delete set null,
  name          text        not null,
  storage_path  text        not null,  -- supabase storage path
  url           text        not null,  -- public URL
  mime_type     text        not null default 'image/jpeg',
  size_bytes    bigint,
  width_px      int,
  height_px     int,
  tags          text[]      not null default '{}',
  created_at    timestamptz not null default now()
);

comment on table public.marketing_image_library is
  'Images uploaded by the org for use in social media posts.';

create index idx_marketing_images_org      on public.marketing_image_library(org_id);
create index idx_marketing_images_location on public.marketing_image_library(location_id);

-- ─────────────────────────────────────────────────────────────────
-- 3. marketing_posts  (generated posts, with variants + approval)
-- ─────────────────────────────────────────────────────────────────

create table public.marketing_posts (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,
  location_id       uuid        references public.google_locations(id) on delete set null,
  created_by        uuid        references public.profiles(id) on delete set null,

  -- What the user asked for
  platform          text        not null
    check (platform in ('instagram','facebook','linkedin','all')),
  post_type         text        not null default 'custom'
    check (post_type in ('promotional','fun_gen_z','behind_scenes','review_highlight','seasonal','custom')),
  user_context      text,       -- free-text input from user

  -- Selected variant content (denormalized for quick access)
  caption           text,
  hashtags          text[]      not null default '{}',
  image_hint        text,       -- AI-suggested image description

  -- Uploaded image (from library or direct upload)
  image_id          uuid        references public.marketing_image_library(id) on delete set null,

  -- A/B Variants stored as jsonb array: [{caption, hashtags, image_hint}]
  variants          jsonb       not null default '[]',
  selected_variant  int         not null default 0,  -- 0-indexed

  -- Approval workflow
  status            text        not null default 'draft'
    check (status in ('draft','pending_approval','approved','rejected','downloaded','scheduled','published')),
  approved_by       uuid        references public.profiles(id) on delete set null,
  approved_at       timestamptz,
  approval_notes    text,

  -- Scheduling
  scheduled_for     timestamptz,
  published_at      timestamptz,

  -- Source review (for review_highlight posts)
  source_review_id  text,

  -- Timestamps
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.marketing_posts is
  'AI-generated social media posts with variants, approval flow and scheduling.';

create index idx_marketing_posts_org        on public.marketing_posts(org_id);
create index idx_marketing_posts_location   on public.marketing_posts(location_id);
create index idx_marketing_posts_status     on public.marketing_posts(status);
create index idx_marketing_posts_scheduled  on public.marketing_posts(scheduled_for) where scheduled_for is not null;
create index idx_marketing_posts_created    on public.marketing_posts(created_at desc);

create trigger marketing_posts_updated_at
  before update on public.marketing_posts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 4. Storage bucket for marketing images
-- ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-images',
  'marketing-images',
  true,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────
-- 5. RLS — marketing_settings
-- ─────────────────────────────────────────────────────────────────

alter table public.marketing_settings enable row level security;

create policy "marketing_settings_select_member"
  on public.marketing_settings for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_settings_insert_member"
  on public.marketing_settings for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_settings_update_member"
  on public.marketing_settings for update
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  )
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- Admin read
create policy "marketing_settings_admin_select"
  on public.marketing_settings for select
  using (public.is_platform_member());

-- ─────────────────────────────────────────────────────────────────
-- 6. RLS — marketing_image_library
-- ─────────────────────────────────────────────────────────────────

alter table public.marketing_image_library enable row level security;

create policy "marketing_images_select_member"
  on public.marketing_image_library for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_images_insert_member"
  on public.marketing_image_library for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_images_delete_own"
  on public.marketing_image_library for delete
  using (uploaded_by = auth.uid());

create policy "marketing_images_admin_select"
  on public.marketing_image_library for select
  using (public.is_platform_member());

-- ─────────────────────────────────────────────────────────────────
-- 7. RLS — marketing_posts
-- ─────────────────────────────────────────────────────────────────

alter table public.marketing_posts enable row level security;

create policy "marketing_posts_select_member"
  on public.marketing_posts for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_posts_insert_member"
  on public.marketing_posts for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_posts_update_member"
  on public.marketing_posts for update
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  )
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_posts_delete_member"
  on public.marketing_posts for delete
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "marketing_posts_admin_select"
  on public.marketing_posts for select
  using (public.is_platform_member());

-- ─────────────────────────────────────────────────────────────────
-- 8. Storage RLS for marketing-images bucket
-- ─────────────────────────────────────────────────────────────────

create policy "marketing_images_storage_select"
  on storage.objects for select
  using (bucket_id = 'marketing-images');

create policy "marketing_images_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'marketing-images'
    and auth.uid() is not null
  );

create policy "marketing_images_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'marketing-images'
    and auth.uid() is not null
  );
