-- Migration: 006 — Brand Brain
-- Purpose: Per-user brand voice configuration used by AI reply generation.
-- NOTE: Scoped to user_id for now (no org creation flow yet).
--       Will migrate to org_id when org onboarding is added.

create table public.brand_brain (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references public.profiles(id) on delete cascade,
  -- Business info
  business_name            text,
  business_type            text,
  business_desc            text,
  -- Tone & personality
  tone                     text        not null default 'professional'
    check (tone in ('professional', 'friendly', 'formal', 'casual')),
  -- Reply settings
  reply_length             text        not null default 'medium'
    check (reply_length in ('short', 'medium', 'long')),
  use_customer_name        boolean     not null default true,
  use_emoji                boolean     not null default false,
  -- Language
  primary_language         text        not null default 'English',
  reviewer_lang_behaviour  text        not null default 'primary'
    check (reviewer_lang_behaviour in ('primary', 'match')),
  -- Negative review handling
  negative_rule            text        not null default 'cautious'
    check (negative_rule in ('manual', 'cautious', 'normal')),
  -- Prohibited phrases
  prohibited_phrases       text[]      not null default '{}',
  -- Style reference
  example_reply            text,
  -- Timestamps
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- One brand brain per user
  unique (user_id)
);

comment on table public.brand_brain is
  'Brand voice configuration per user. '
  'Scoped to user_id until org onboarding is implemented.';

create index idx_brand_brain_user_id on public.brand_brain(user_id);

create trigger brand_brain_updated_at
  before update on public.brand_brain
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------

alter table public.brand_brain enable row level security;

-- Users can read their own brand brain
create policy "brand_brain_select_own"
  on public.brand_brain
  for select
  using (user_id = auth.uid());

-- Users can insert their own brand brain
create policy "brand_brain_insert_own"
  on public.brand_brain
  for insert
  with check (user_id = auth.uid());

-- Users can update their own brand brain
create policy "brand_brain_update_own"
  on public.brand_brain
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
