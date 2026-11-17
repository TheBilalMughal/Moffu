-- Migration: review_topics
-- Purpose: Store AI-extracted topic tags per review for Topic Intelligence feature.

-- Add analyzed flag to reviews so we don't reprocess
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS topics_analyzed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_topics_unanalyzed
  ON reviews (location_id, topics_analyzed_at)
  WHERE topics_analyzed_at IS NULL;

-- Topic tags table
CREATE TABLE IF NOT EXISTS public.review_topics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID        REFERENCES public.google_locations(id) ON DELETE CASCADE,
  topic       TEXT        NOT NULL,
  sentiment   TEXT        NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, topic)
);

COMMENT ON TABLE public.review_topics IS
  'AI-extracted topic tags per review (e.g. staff_service, wait_time) with sentiment.';

CREATE INDEX idx_review_topics_org_location
  ON public.review_topics (org_id, location_id, topic, sentiment);

CREATE INDEX idx_review_topics_review_id
  ON public.review_topics (review_id);

-- RLS
ALTER TABLE public.review_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_topics_select_org_member"
  ON public.review_topics FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );
