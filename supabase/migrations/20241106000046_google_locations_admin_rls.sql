-- Platform members can read all Google locations (for admin client detail view)
create policy "google_locations_read_by_platform"
  on public.google_locations for select to authenticated
  using (public.is_platform_member());
