-- Migration: review_highlights
-- Purpose: Store AI-extracted keyword highlights from 4-5 star reviews,
--          used to power the "Post Ideas from Reviews" section in Marketing.

create table if not exists public.review_highlights (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,
  location_id       uuid        not null references public.google_locations(id) on delete cascade,
  highlight_text    text        not null,
  keywords          text[]      not null default '{}',
  source_review_ids text[]      not null default '{}',
  generated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (org_id, location_id, highlight_text)
);

comment on table public.review_highlights is
  'AI-extracted highlights from positive reviews, used to seed social media post ideas.';

create index idx_review_highlights_org_location
  on public.review_highlights(org_id, location_id);

create index idx_review_highlights_generated_at
  on public.review_highlights(generated_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.review_highlights enable row level security;

-- Members of an org may read that org's highlights
create policy "review_highlights_select_org_member"
  on public.review_highlights
  for select
  using (
    org_id in (
      select om.org_id
      from public.org_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

-- Only service role may insert / update (edge function uses service key)
-- No insert/update/delete policies: edge function bypasses RLS via service role
