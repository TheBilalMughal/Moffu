create table public.portal_page_visibility (
  page_key text primary key,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.portal_page_visibility enable row level security;

revoke all on public.portal_page_visibility from public, anon, authenticated;
grant select on public.portal_page_visibility to authenticated;
grant insert, update on public.portal_page_visibility to authenticated;

create policy portal_page_visibility_read_authenticated
  on public.portal_page_visibility for select to authenticated
  using (true);

create policy portal_page_visibility_insert_platform_owner
  on public.portal_page_visibility for insert to authenticated
  with check (
    public.get_platform_role() in ('owner', 'super_admin')
    and updated_by = auth.uid()
  );

create policy portal_page_visibility_update_platform_owner
  on public.portal_page_visibility for update to authenticated
  using (public.get_platform_role() in ('owner', 'super_admin'))
  with check (
    public.get_platform_role() in ('owner', 'super_admin')
    and updated_by = auth.uid()
  );

insert into public.portal_page_visibility (page_key, is_visible) values
  ('overview', true),
  ('reviews', true),
  ('complaints', true),
  ('insights_trends', true),
  ('insights_ratings', true),
  ('insights_agent_rules', true),
  ('google_profile', true),
  ('seo_leads', true),
  ('georank', true),
  ('competitors', true),
  ('brand_brain', true),
  ('monthly_digest', true),
  ('campaigns', true),
  ('marketing', true),
  ('feedback', true),
  ('team', true),
  ('plan', true),
  ('billing', true),
  ('account', true),
  ('preferences', true),
  ('integrations', true)
on conflict (page_key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'portal_page_visibility'
  ) then
    alter publication supabase_realtime add table public.portal_page_visibility;
  end if;
end;
$$;
