-- Add complaint analysis columns to reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_complaint       BOOLEAN       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS complaint_summary  TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS complaint_analyzed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fetching unanalyzed low-rating reviews efficiently
CREATE INDEX IF NOT EXISTS idx_reviews_complaint_analysis
  ON reviews (rating, is_complaint, complaint_analyzed_at)
  WHERE rating <= 3;

-- Index for fetching confirmed complaints
CREATE INDEX IF NOT EXISTS idx_reviews_is_complaint
  ON reviews (location_id, is_complaint, published_at DESC)
  WHERE is_complaint = TRUE;
