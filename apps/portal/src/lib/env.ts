/**
 * Runtime environment validation.
 * Fails fast at startup if required variables are missing.
 * Variable names only — no secrets embedded here.
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Copy apps/portal/.env.example to apps/portal/.env.local and fill in the value.`,
    );
  }
  return value as string;
}

function optionalEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return value && value.trim() !== '' ? (value as string) : undefined;
}

export const env = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
  appUrl: optionalEnv('VITE_APP_URL') ?? 'http://localhost:3001',
  webUrl: optionalEnv('VITE_WEB_URL') ?? 'http://localhost:3000',
  // Optional — disabled if not configured
  googleClientId: optionalEnv('VITE_GOOGLE_CLIENT_ID'),
  posthogKey: optionalEnv('VITE_POSTHOG_KEY'),
  posthogHost: optionalEnv('VITE_POSTHOG_HOST') ?? 'https://app.posthog.com',
} as const;
