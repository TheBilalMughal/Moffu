-- AI Provider Settings
-- Stores API keys + model for each AI provider; only one can be active at a time.

CREATE TABLE public.ai_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text        NOT NULL CHECK (provider IN ('groq','anthropic','gemini','openai')),
  label       text        NOT NULL,
  api_key     text        NOT NULL,
  model       text        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Only platform members (admins) can read/write
CREATE POLICY "platform_members_manage_ai_settings"
  ON public.ai_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_members WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger: ensure only one provider is active at a time
CREATE OR REPLACE FUNCTION public.enforce_single_active_ai_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.ai_settings SET is_active = false WHERE id != NEW.id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_ai_provider
  BEFORE INSERT OR UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_ai_provider();
