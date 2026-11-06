-- Users can read their own Google connection (portal Settings page needs this)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'google_connections'
      and policyname = 'google_connections_own_read'
  ) then
    execute $p$
      create policy "google_connections_own_read"
        on public.google_connections for select to authenticated
        using (user_id = auth.uid())
    $p$;
  end if;
end $$;

-- Users can update their own connection (auto-sync settings)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'google_connections'
      and policyname = 'google_connections_own_update'
  ) then
    execute $p$
      create policy "google_connections_own_update"
        on public.google_connections for update to authenticated
        using (user_id = auth.uid())
    $p$;
  end if;
end $$;

-- Users can read their own locations
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'google_locations'
      and policyname = 'google_locations_own_read'
  ) then
    execute $p$
      create policy "google_locations_own_read"
        on public.google_locations for select to authenticated
        using (user_id = auth.uid())
    $p$;
  end if;
end $$;

-- Users can update their own locations (toggling is_selected)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'google_locations'
      and policyname = 'google_locations_own_update'
  ) then
    execute $p$
      create policy "google_locations_own_update"
        on public.google_locations for update to authenticated
        using (user_id = auth.uid())
    $p$;
  end if;
end $$;
