import { supabase } from '@/lib/supabase';

export interface GoogleGrowthSite {
  siteUrl: string;
  permissionLevel: string | null;
}

export interface GoogleGrowthProperty {
  property: string;
  displayName: string;
  parentAccount?: string;
}

export interface GoogleGrowthStatus {
  connected: boolean;
  googleEmail?: string | null;
  searchConsoleSiteUrl?: string | null;
  ga4PropertyId?: string | null;
  scopes?: string[];
  resources?: {
    searchConsole: { items: GoogleGrowthSite[]; error: string | null };
    analytics: { items: GoogleGrowthProperty[]; error: string | null };
  } | null;
}

export interface SearchConsolePeriod {
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; averagePosition: number }>;
}

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface GoogleGrowthReport {
  days: number;
  dataThrough: string;
  searchConsole: { current: SearchConsolePeriod; previous: SearchConsolePeriod };
  analytics: { current: AnalyticsPeriod; previous: AnalyticsPeriod };
}

async function invoke<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-growth', { body: { action, ...values } });
  if (error) {
    const context = (error as unknown as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error ?? error.message);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const googleGrowthService = {
  status: () => invoke<GoogleGrowthStatus>('status'),
  start: () => invoke<{ auth_url: string }>('start'),
  configure: (searchConsoleSiteUrl: string, ga4PropertyId: string) =>
    invoke<{ success: boolean }>('configure', { searchConsoleSiteUrl, ga4PropertyId }),
  report: (days: 28 | 90) => invoke<GoogleGrowthReport>('report', { days }),
  disconnect: () => invoke<{ success: boolean }>('disconnect'),
};
