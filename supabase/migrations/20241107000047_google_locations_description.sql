-- Add description column to google_locations (from Google Business Profile)
alter table public.google_locations
  add column if not exists description text null;
