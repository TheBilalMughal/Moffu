-- Remove duplicate google_locations rows, keeping the one with is_selected=true
-- or the latest id per (connection_id, google_location_name) pair.
DELETE FROM public.google_locations
WHERE id NOT IN (
  SELECT DISTINCT ON (connection_id, google_location_name)
    id
  FROM public.google_locations
  ORDER BY connection_id, google_location_name, is_selected DESC, id DESC
);

-- Add unique constraint so upsert works correctly going forward.
ALTER TABLE public.google_locations
  ADD CONSTRAINT google_locations_connection_id_location_name_key
  UNIQUE (connection_id, google_location_name);
