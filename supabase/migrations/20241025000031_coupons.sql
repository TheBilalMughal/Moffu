-- ── Coupons / Discounts ───────────────────────────────────────────────────────

create table public.coupons (
  id               uuid        primary key default gen_random_uuid(),
  code             text        not null unique,
  description      text,
  discount_type    text        not null check (discount_type in ('percent', 'fixed_cents')),
  discount_value   integer     not null check (discount_value > 0),
  max_uses         integer,                        -- null = unlimited
  uses_count       integer     not null default 0,
  expires_at       timestamptz,                    -- null = never expires
  is_active        boolean     not null default true,
  created_by       uuid        references auth.users(id),
  created_at       timestamptz not null default now()
);

-- Track which subscriptions have a coupon applied
create table public.subscription_coupons (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references public.subscriptions(id) on delete cascade,
  coupon_id       uuid        not null references public.coupons(id) on delete cascade,
  applied_at      timestamptz not null default now(),
  applied_by      uuid        references auth.users(id),
  unique (subscription_id, coupon_id)
);

alter table public.coupons           enable row level security;
alter table public.subscription_coupons enable row level security;

-- Platform members (admins) can manage coupons
create policy "platform_members_manage_coupons"
  on public.coupons for all to authenticated
  using (
    exists (
      select 1 from public.platform_members pm
      where pm.user_id = auth.uid() and pm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.platform_members pm
      where pm.user_id = auth.uid() and pm.is_active = true
    )
  );

create policy "platform_members_manage_subscription_coupons"
  on public.subscription_coupons for all to authenticated
  using (
    exists (
      select 1 from public.platform_members pm
      where pm.user_id = auth.uid() and pm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.platform_members pm
      where pm.user_id = auth.uid() and pm.is_active = true
    )
  );

-- Indexes
create index coupons_code_idx    on public.coupons (code);
create index coupons_active_idx  on public.coupons (is_active, expires_at);
