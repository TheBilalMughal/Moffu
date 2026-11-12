-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires on new user signup and calls welcome-email Edge Function
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url    text := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/welcome-email';
  _secret text := current_setting('app.welcome_webhook_secret', true);
BEGIN
  PERFORM extensions.net.http_post(
    url     := _url,
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-webhook-secret',  coalesce(_secret, '')
               ),
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

-- Drop old trigger if it exists, then create fresh
DROP TRIGGER IF EXISTS on_auth_user_created_welcome_email ON auth.users;

CREATE TRIGGER on_auth_user_created_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email();
