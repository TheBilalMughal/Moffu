function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Copy apps/admin/.env.example to apps/admin/.env.local and fill in the value.`,
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
  appUrl: optionalEnv('VITE_APP_URL') ?? 'http://localhost:3002',
  portalUrl: optionalEnv('VITE_PORTAL_URL') ?? 'http://localhost:3001',
  posthogKey: optionalEnv('VITE_POSTHOG_KEY'),
  posthogHost: optionalEnv('VITE_POSTHOG_HOST') ?? 'https://app.posthog.com',
} as const;
