-- Migration: 001 — Extensions and human reference ID system
-- Purpose: Enable required PostgreSQL extensions and create immutable
--          human-readable reference IDs (e.g. ORG-00001, USR-00042).
-- Human IDs are stable route-facing identifiers; UUIDs are internal PKs.
-- Never use MAX()+1. Uses a concurrency-safe global sequence per entity type.

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------
-- Reference ID system
-- -----------------------------------------------------------------------

-- Registry of entity prefixes and their sequences
create table public.ref_id_sequences (
  entity_type  text        primary key,
  prefix       text        not null unique,
  last_value   bigint      not null default 0,
  min_digits   int         not null default 5,
  created_at   timestamptz not null default now()
);

comment on table public.ref_id_sequences is
  'Global registry of human reference ID prefixes and counters. '
  'One row per entity type. Never delete rows — sequences are immutable.';

-- Seed entity types
insert into public.ref_id_sequences (entity_type, prefix, min_digits) values
  ('user',         'USR', 5),
  ('organization', 'ORG', 5),
  ('invitation',   'INV', 5),
  ('location',     'LOC', 5),
  ('review',       'REV', 7),
  ('draft',        'DFT', 7),
  ('ticket',       'TKT', 5),
  ('job',          'JOB', 7);

-- Atomic next-value function (advisory lock per entity type)
create or replace function public.next_ref_id(p_entity_type text)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_prefix    text;
  v_next      bigint;
  v_digits    int;
begin
  -- Row-level lock to prevent concurrent gap
  select prefix, last_value + 1, min_digits
  into   v_prefix, v_next, v_digits
  from   public.ref_id_sequences
  where  entity_type = p_entity_type
  for update;

  if not found then
    raise exception 'Unknown entity type for ref_id: %', p_entity_type;
  end if;

  update public.ref_id_sequences
  set    last_value = v_next
  where  entity_type = p_entity_type;

  return v_prefix || '-' || lpad(v_next::text, v_digits, '0');
end;
$$;

comment on function public.next_ref_id(text) is
  'Returns the next human reference ID for the given entity type. '
  'Thread-safe via row-level lock. Example: next_ref_id(''organization'') → ORG-00001';

-- RLS: ref_id_sequences is internal; no direct client access
alter table public.ref_id_sequences enable row level security;

-- No policies added — service role only via security-definer functions
