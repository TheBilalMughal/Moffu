-- Fix 1: trigger_welcome_email called extensions.net.http_post which doesn't exist.
-- pg_net lives in schema "net", not "extensions.net".
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/welcome-email',
    headers := '{"Content-Type":"application/json","x-webhook-secret":"moffu-welcome-2026"}'::jsonb,
    body    := jsonb_build_object(
                 'record', jsonb_build_object(
                   'id',                 NEW.id,
                   'email',              NEW.email,
                   'raw_user_meta_data', NEW.raw_user_meta_data,
                   'created_at',         NEW.created_at
                 )
               )
  );
  RETURN NEW;
END;
$$;

-- Fix 2: handle_new_user had no ON CONFLICT guard. If a profile row already exists
-- for this user (admin-created, partial prior failure, etc.) the INSERT threw a
-- duplicate-key violation and rolled back the auth.users INSERT entirely.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
