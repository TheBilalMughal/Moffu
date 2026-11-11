-- Contact form submissions from the marketing site
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Only service-role (admin) can read; anyone can insert (anon key)
create policy "Public can insert contact messages"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);
