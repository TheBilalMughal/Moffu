import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase browser client for the customer portal.
 * Uses the anon key — RLS enforces all data access.
 * Service-role key is NEVER used in the browser.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
