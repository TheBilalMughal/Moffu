-- Platform-level key-value settings (admin-only)
-- Used to store provider credentials like Google OAuth CLIENT_ID/SECRET
-- Edge functions read these via service role

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read/write
CREATE POLICY "platform_admins_select" ON public.platform_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_members pm
      WHERE pm.user_id = auth.uid() AND pm.is_active = true
    )
  );

CREATE POLICY "platform_admins_upsert" ON public.platform_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_members pm
      WHERE pm.user_id = auth.uid() AND pm.is_active = true
    )
  );

CREATE POLICY "platform_admins_update" ON public.platform_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.platform_members pm
      WHERE pm.user_id = auth.uid() AND pm.is_active = true
    )
  );
