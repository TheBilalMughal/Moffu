-- Waitlist entries (public form submissions)
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  email      text        NOT NULL,
  source     text        NOT NULL DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit their own entry
CREATE POLICY "public_insert_waitlist" ON public.waitlist_entries
  FOR INSERT WITH CHECK (true);

-- Only platform admins can read / delete
CREATE POLICY "platform_members_read_waitlist" ON public.waitlist_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_members pm
      WHERE pm.user_id = auth.uid() AND pm.is_active = true
    )
  );

CREATE POLICY "platform_members_delete_waitlist" ON public.waitlist_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.platform_members pm
      WHERE pm.user_id = auth.uid() AND pm.is_active = true
    )
  );

-- Allow public (unauthenticated) to read only the waitlist_enabled setting
-- so the marketing site can show/hide the Join Waitlist CTA without auth
CREATE POLICY "public_read_waitlist_setting" ON public.platform_settings
  FOR SELECT USING (key = 'waitlist_enabled');

-- Seed the default value (off by default)
INSERT INTO public.platform_settings (key, value)
VALUES ('waitlist_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
