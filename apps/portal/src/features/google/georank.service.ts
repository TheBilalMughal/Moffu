import { supabase } from '@/lib/supabase';

export type GeoPoint = {
  index: number;
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  status: 'found' | 'not_found_within_depth' | 'failed' | 'pending' | 'cancelled';
  rank: number | null;
};

export type GeoScanResponse = {
  scan_id: string;
  keyword: string;
  grid_size: number;
  result_depth: number;
  status: 'completed' | 'partial' | 'failed' | 'running';
  metrics: {
    planned_points: number;
    valid_points: number;
    found_points: number;
    not_found_within_depth_points: number;
    failed_points: number;
    completion_percent: number;
    top_3_coverage_percent: number | null;
    top_10_coverage_percent: number | null;
    mean_observed_rank: number | null;
    has_survivorship_bias: boolean;
  };
  points: GeoPoint[];
  estimated_cost_usd: number;
  actual_cost_usd?: number | null;
  cost_reconciliation_pending?: boolean;
  expires_at: string;
  created_at?: string;
};

export type GeoRankStatus = {
  available: boolean;
  provider: string;
  surface: string;
  location: { id: string; name: string; has_coordinates: boolean; has_verified_provider_id: boolean };
  blockers: string[];
};

export type GeoRankRequest = {
  location_id: string;
  keyword: string;
  grid_size: number;
  spacing_meters: number;
  result_depth: number;
  country_code: string;
  language_code: string;
  device: 'desktop' | 'mobile';
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('georank', { body });
  if (error) {
    let code = 'GEORANK_REQUEST_FAILED';
    try {
      const context = (error as any).context;
      if (context instanceof Response && context.status === 404) throw new Error('GEORANK_FUNCTION_NOT_DEPLOYED');
      const parsed = context instanceof Response ? await context.clone().json() : context?.body;
      code = parsed?.error ?? code;
    } catch (reason) {
      code = reason instanceof Error && reason.message === 'GEORANK_FUNCTION_NOT_DEPLOYED'
        ? reason.message
        : code;
    }
    throw new Error(code);
  }
  return data as T;
}

export const georankService = {
  getStatus(locationId: string) {
    return invoke<GeoRankStatus>({ action: 'status', location_id: locationId });
  },
  getHistory(locationId: string) {
    return invoke<{ history: GeoScanResponse[] }>({ action: 'history', location_id: locationId });
  },
  estimate(request: GeoRankRequest) {
    return invoke<{ estimate: { estimated_cost_usd: number; within_budget: boolean; request_count: number }; point_count: number; available: boolean }>(
      { action: 'estimate', ...request },
    );
  },
  start(request: GeoRankRequest, idempotencyKey: string) {
    return invoke<GeoScanResponse>({ action: 'start', ...request, idempotency_key: idempotencyKey });
  },
};
