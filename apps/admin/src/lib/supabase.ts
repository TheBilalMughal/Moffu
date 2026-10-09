import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase browser client for the admin portal.
 * Uses anon key + platform RBAC/RLS.
 * Service-role key is NEVER used in the browser — sensitive operations
 * go through server-side API routes or Supabase Edge Functions.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
