ALTER TABLE public.google_locations
  ADD COLUMN IF NOT EXISTS dataforseo_place_id text;
