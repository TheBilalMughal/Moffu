-- Migration: 054 — Add logo_url to organizations
alter table public.organizations add column if not exists logo_url text;

-- Storage bucket for org logos (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own org logo path
create policy "org logo upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'org-logos');

create policy "org logo update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'org-logos');

create policy "org logo public read"
  on storage.objects for select
  to public
  using (bucket_id = 'org-logos');
