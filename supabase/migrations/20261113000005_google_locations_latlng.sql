-- Add lat/lng to google_locations for competitor proximity search
ALTER TABLE google_locations ADD COLUMN IF NOT EXISTS latitude  FLOAT8;
ALTER TABLE google_locations ADD COLUMN IF NOT EXISTS longitude FLOAT8;
