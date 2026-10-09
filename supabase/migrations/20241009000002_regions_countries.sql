-- Migration: 002 — Regions, countries, timezones, currencies
-- Purpose: Reference data for localization and billing.
-- TBD: Exact list of supported launch locales and currencies.
-- TBD: Final billing market configuration (D-011: Australia-first, multi-market core).

create table public.regions (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,  -- e.g. 'AU', 'US', 'EU'
  name        text        not null,
  is_active   boolean     not null default false,  -- TBD: which regions are live at launch
  created_at  timestamptz not null default now()
);

comment on table public.regions is 'Geographic billing/compliance regions. Active status is TBD pending launch market decisions.';

create table public.countries (
  id            uuid        primary key default gen_random_uuid(),
  region_id     uuid        not null references public.regions(id),
  code          text        not null unique,  -- ISO 3166-1 alpha-2
  name          text        not null,
  default_tz    text,                          -- IANA timezone
  currency_code text,                          -- ISO 4217; TBD billing config
  is_active     boolean     not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.countries is 'Countries with their region, default timezone and currency. Active status and currencies are TBD.';

create table public.currencies (
  code          text        primary key,  -- ISO 4217
  name          text        not null,
  symbol        text        not null,
  minor_units   int         not null default 2,
  is_active     boolean     not null default false,  -- TBD
  created_at    timestamptz not null default now()
);

comment on table public.currencies is 'Supported currencies. Exact supported currencies and pricing are TBD.';

-- Indexes
create index idx_countries_region_id on public.countries(region_id);
create index idx_countries_code on public.countries(code);

-- RLS: reference tables are read-only for authenticated users, no direct writes
alter table public.regions   enable row level security;
alter table public.countries enable row level security;
alter table public.currencies enable row level security;

create policy "regions_read_authenticated"
  on public.regions for select to authenticated using (true);

create policy "countries_read_authenticated"
  on public.countries for select to authenticated using (true);

create policy "currencies_read_authenticated"
  on public.currencies for select to authenticated using (true);

-- Seed minimal reference data (TBD: final list at launch)
insert into public.regions (code, name, is_active) values
  ('AU', 'Australia / Pacific', false),  -- TBD: enable at launch
  ('US', 'United States', false),
  ('EU', 'Europe', false);

insert into public.currencies (code, name, symbol, minor_units, is_active) values
  ('AUD', 'Australian Dollar', 'A$', 2, false),  -- TBD: enable at launch
  ('USD', 'US Dollar', '$', 2, false),
  ('EUR', 'Euro', '€', 2, false),
  ('GBP', 'British Pound', '£', 2, false);
