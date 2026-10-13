-- Add phone column to profiles for storing country-dial + national number
alter table public.profiles
  add column if not exists phone text;
