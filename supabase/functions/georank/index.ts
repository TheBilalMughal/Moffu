import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { calculateGeoScanMetrics, createGeoGrid, estimateGeoScanCost } from '../_shared/georank-core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_GRID_SIZES = [3, 5, 7, 9] as const;
const ALLOWED_SPACINGS = [500, 1000, 2000, 5000] as const;
const ALLOWED_DEPTHS = [20, 50, 100] as const;
const EXPIRY_DAYS = 30;

function providerAuth() {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  return login && password ? btoa(`${login}:${password}`) : Deno.env.get('DATAFORSEO_AUTH') ?? '';
}

function currentConfig() {
  const auth = providerAuth();
  const price = Number(Deno.env.get('GEORANK_PRICE_PER_REQUEST_USD'));
  const cap = Number(Deno.env.get('GEORANK_MONTHLY_CAP_USD'));
  const rightsApproved = Deno.env.get('GEORANK_SOURCE_RIGHTS_APPROVED') === 'true';
  const enabled = Deno.env.get('GEORANK_ENABLED') === 'true';
  return { auth, price, cap, rightsApproved, enabled,
    ready: Boolean(auth) && Number.isFinite(price) && price > 0 && Number.isFinite(cap) && cap > 0 && rightsApproved && enabled };
}

async function entitled(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error: profileError } = await admin.from('profiles').select('status').eq('id', userId).maybeSingle();
  if (profileError) throw new Error('DATABASE_UNAVAILABLE');
  if (profile?.status !== 'active') throw new Error('ACCOUNT_INACTIVE');
  const { data: subscription, error: subscriptionError } = await admin.from('subscriptions')
    .select('plan_id,status').eq('user_id', userId).in('status', ['active', 'trialing']).maybeSingle();
  if (subscriptionError) throw new Error('DATABASE_UNAVAILABLE');
  if (!subscription) throw new Error('FEATURE_REQUIRED');
  const { data: entitlement, error: entitlementError } = await admin.from('plan_entitlements').select('bool_value')
    .eq('plan_id', subscription.plan_id).eq('key', 'feature_google_profile').maybeSingle();
  if (entitlementError) throw new Error('DATABASE_UNAVAILABLE');
  if (entitlement?.bool_value === false) throw new Error('FEATURE_REQUIRED');
}

function validateRequest(body: Record<string, unknown>) {
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim().replace(/\s+/g, ' ') : '';
  const gridSize = Number(body.grid_size);
  const spacing = Number(body.spacing_meters);
  const depth = Number(body.result_depth);
  const country = typeof body.country_code === 'string' ? body.country_code.toUpperCase() : '';
  const language = typeof body.language_code === 'string' ? body.language_code : '';
  const device = body.device;
  const locationId = typeof body.location_id === 'string' ? body.location_id : '';
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  if (!keyword || keyword.length > 120 || !ALLOWED_GRID_SIZES.includes(gridSize as typeof ALLOWED_GRID_SIZES[number]) ||
      !ALLOWED_SPACINGS.includes(spacing as typeof ALLOWED_SPACINGS[number]) ||
      !ALLOWED_DEPTHS.includes(depth as typeof ALLOWED_DEPTHS[number]) || !/^[A-Z]{2}$/.test(country) ||
      !/^[a-z]{2}$/.test(language) || !['desktop', 'mobile'].includes(String(device)) ||
      !uuid.test(locationId) || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw new Error('INVALID_REQUEST');
  return { keyword, gridSize, spacing, depth, country, language, device: device as 'desktop' | 'mobile', locationId, idempotencyKey };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'CONFIGURATION_UNAVAILABLE' }, 503);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ error: 'UNAUTHORIZED' }, 401);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'INVALID_REQUEST' }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return json({ error: 'INVALID_REQUEST' }, 400); }
    const action = body.action;
    if (!['status', 'provider_check', 'history', 'estimate', 'start'].includes(String(action))) return json({ error: 'INVALID_ACTION' }, 400);
    if (action !== 'status') await entitled(admin, user.id);

    const locationId = typeof body.location_id === 'string' ? body.location_id : '';
    if (!uuid.test(locationId)) return json({ error: 'INVALID_LOCATION' }, 400);
    const { data: location, error: locationError } = await admin.from('google_locations')
      .select('id,display_name,address,latitude,longitude,dataforseo_place_id').eq('id', locationId).eq('user_id', user.id).maybeSingle();
    if (locationError) return json({ error: 'DATABASE_UNAVAILABLE' }, 503);
    if (!location) return json({ error: 'LOCATION_NOT_FOUND' }, 404);
    if (action === 'provider_check') {
      const auth = providerAuth();
      if (!auth) return json({ connected: false, reason: 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' });
      try {
        // This endpoint is free. Do not return the account identity, balance, or raw provider response to a tenant.
        const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
          headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return json({ connected: false,
          reason: response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_FAILED' : 'PROVIDER_UNAVAILABLE' });
        const data = await response.json();
        const connected = data?.status_code === 20000 && data?.tasks?.[0]?.status_code === 20000;
        return json({ connected, reason: connected ? null : 'PROVIDER_REJECTED' });
      } catch { return json({ connected: false, reason: 'PROVIDER_UNAVAILABLE' }); }
    }
    if (action === 'history') {
      const { data: scans, error: scansError } = await admin.from('georank_scans')
        .select('id,keyword,grid_size,result_depth,status,estimated_cost_usd,actual_cost_usd,created_at,expires_at')
        .eq('user_id', user.id).eq('location_id', location.id).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(12);
      if (scansError) return json({ error: 'HISTORY_UNAVAILABLE' }, 503);
      const scanIds = (scans ?? []).map((scan: any) => scan.id);
      const { data: points, error: pointsError } = scanIds.length
        ? await admin.from('georank_points').select('scan_id,point_index,grid_row,grid_column,latitude,longitude,status,rank')
          .in('scan_id', scanIds).gt('expires_at', new Date().toISOString())
        : { data: [], error: null };
      if (pointsError) return json({ error: 'HISTORY_UNAVAILABLE' }, 503);
      const history = (scans ?? []).map((scan: any) => {
        const scanPoints = (points ?? []).filter((point: any) => point.scan_id === scan.id)
          .sort((a: any, b: any) => a.point_index - b.point_index);
        const metrics = calculateGeoScanMetrics(scanPoints.map((point: any) => ({ status: point.status, rank: point.rank })), scan.result_depth);
        return { scan_id: scan.id, keyword: scan.keyword, grid_size: scan.grid_size, result_depth: scan.result_depth,
          status: scan.status, metrics, points: scanPoints.map((point: any) => ({ index: point.point_index, row: point.grid_row,
            column: point.grid_column, latitude: point.latitude, longitude: point.longitude, status: point.status, rank: point.rank })),
          estimated_cost_usd: Number(scan.estimated_cost_usd), actual_cost_usd: scan.actual_cost_usd == null ? null : Number(scan.actual_cost_usd),
          cost_reconciliation_pending: scan.actual_cost_usd == null,
          expires_at: scan.expires_at, created_at: scan.created_at };
      });
      return json({ history });
    }
    const config = currentConfig();
    if (action === 'status') {
      const blockers: string[] = [];
      const { error: scanSchemaError } = await admin.from('georank_scans').select('id', { head: true }).limit(1);
      if (scanSchemaError) blockers.push('SCAN_SCHEMA_NOT_INSTALLED');
      if (location.latitude == null || location.longitude == null) blockers.push('LOCATION_COORDINATES_UNAVAILABLE');
      if (!location.dataforseo_place_id) blockers.push('VERIFIED_PROVIDER_PLACE_ID_REQUIRED');
      if (!config.auth) blockers.push('PROVIDER_CREDENTIALS_NOT_CONFIGURED');
      if (!config.rightsApproved) blockers.push('SOURCE_RIGHTS_NOT_APPROVED');
      if (!config.enabled) blockers.push('GEORANK_DISABLED');
      if (!Number.isFinite(config.price) || config.price <= 0 || !Number.isFinite(config.cap) || config.cap <= 0) blockers.push('COST_LIMITS_NOT_CONFIGURED');
      return json({ available: blockers.length === 0, provider: 'DataForSEO', surface: 'Google Maps', location: {
        id: location.id, name: location.display_name ?? location.address ?? 'Selected location',
        has_coordinates: location.latitude != null && location.longitude != null,
        has_verified_provider_id: Boolean(location.dataforseo_place_id),
      }, blockers });
    }

    const request = validateRequest(body);
    const { data: priorScan, error: priorError } = await admin.from('georank_scans').select('id,status')
      .eq('user_id', user.id).eq('idempotency_key', request.idempotencyKey).maybeSingle();
    if (priorError) return json({ error: 'DATABASE_UNAVAILABLE' }, 503);
    if (priorScan) return json({ error: 'IDEMPOTENCY_KEY_USED', scan_id: priorScan.id, status: priorScan.status }, 409);
    if (!config.ready) return json({ error: 'GEORANK_UNAVAILABLE', blockers: [
      ...(!config.auth ? ['PROVIDER_CREDENTIALS_NOT_CONFIGURED'] : []),
      ...(!config.rightsApproved ? ['SOURCE_RIGHTS_NOT_APPROVED'] : []),
      ...(!config.enabled ? ['GEORANK_DISABLED'] : []),
      ...((!Number.isFinite(config.price) || config.price <= 0 || !Number.isFinite(config.cap) || config.cap <= 0) ? ['COST_LIMITS_NOT_CONFIGURED'] : []),
    ] }, 503);
    if (location.latitude == null || location.longitude == null || !location.dataforseo_place_id) return json({ error: 'LOCATION_IDENTITY_OR_COORDINATES_REQUIRED' }, 409);

    const points = createGeoGrid({ latitude: location.latitude, longitude: location.longitude }, request.gridSize, request.spacing, 225);
    const estimate = estimateGeoScanCost(request.gridSize, 1, request.depth, {
      cost_per_billable_unit_usd: config.price,
      results_per_billable_unit: 100,
      max_depth: 700,
      max_points: 225,
    }, config.cap);
    if (!estimate.within_budget) return json({ error: 'SCAN_EXCEEDS_BUDGET', estimate }, 402);
    if (action === 'estimate') return json({ estimate, point_count: points.length, available: true });

    const configHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({
      keyword: request.keyword.toLowerCase(), grid_size: request.gridSize, spacing_meters: request.spacing,
      result_depth: request.depth, country_code: request.country, language_code: request.language, device: request.device,
      provider: 'dataforseo', surface: 'google_maps', methodology: 'georank-v1',
    }))).then((hash) => [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join(''));
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const { data: reservationId, error: reserveError } = await admin.rpc('reserve_georank_usage', {
      p_user_id: user.id, p_idempotency_key: request.idempotencyKey, p_period_start: periodStart,
      p_estimated_cost_usd: estimate.estimated_cost_usd, p_budget_limit_usd: config.cap,
    });
    if (reserveError) return json({ error: reserveError.message.includes('GEORANK_BUDGET_EXCEEDED') ? 'MONTHLY_BUDGET_EXCEEDED' : 'USAGE_RESERVATION_FAILED' }, 402);

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86400000).toISOString();
    const { data: scan, error: scanError } = await admin.from('georank_scans').insert({
      user_id: user.id, location_id: location.id, idempotency_key: request.idempotencyKey, keyword: request.keyword,
      provider: 'dataforseo', search_surface: 'google_maps', country_code: request.country, language_code: request.language,
      device: request.device, center_latitude: location.latitude, center_longitude: location.longitude,
      center_source: 'location_record', grid_size: request.gridSize, spacing_meters: request.spacing,
      result_depth: request.depth, methodology_version: 'georank-v1', config_hash: configHash,
      status: 'running', planned_points: points.length, estimated_cost_usd: estimate.estimated_cost_usd,
      started_at: new Date().toISOString(), expires_at: expiresAt,
    }).select('id').single();
    if (scanError || !scan) {
      // Keep the reservation held: a concurrent idempotent request may own the same reservation.
      return json({ error: 'SCAN_CREATE_FAILED' }, 503);
    }

    const initialPoints = points.map((point) => ({ scan_id: scan.id, user_id: user.id, point_index: point.index,
      grid_row: point.row, grid_column: point.column, latitude: point.latitude, longitude: point.longitude,
      status: 'pending', rank: null, expires_at: expiresAt }));
    const { error: pointsError } = await admin.from('georank_points').insert(initialPoints);
    if (pointsError) {
      await admin.from('georank_scans').update({ status: 'failed', error_code: 'POINTS_CREATE_FAILED', completed_at: new Date().toISOString() }).eq('id', scan.id);
      await admin.from('georank_usage_reservations').update({ status: 'released', updated_at: new Date().toISOString() }).eq('id', reservationId);
      return json({ error: 'SCAN_CREATE_FAILED' }, 503);
    }

    // DataForSEO's Maps Live Advanced endpoint accepts one task at a time.
    // Keep concurrency bounded and associate each response with its exact grid point.
    const outcomes: Array<{ rank: number | null; valid: boolean; cost: number | null; taskId: string | null }> = new Array(points.length);
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= points.length) return;
        const point = points[index];
        try {
          const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
            method: 'POST', headers: { Authorization: `Basic ${config.auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ keyword: request.keyword,
              location_coordinate: `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},14z`,
              language_code: request.language, device: request.device, depth: request.depth,
              search_this_area: true, tag: String(point.index) }]),
            signal: AbortSignal.timeout(18000),
          });
          const data = await response.json().catch(() => null);
          const task = data?.tasks?.[0];
          const costValue = task?.cost ?? data?.cost;
          const cost = costValue !== null && costValue !== undefined && Number.isFinite(Number(costValue)) ? Number(costValue) : null;
          const serp = task?.result?.[0];
          if (!response.ok || data?.status_code !== 20000 || task?.status_code !== 20000 || !Array.isArray(serp?.items)) {
            outcomes[index] = { rank: null, valid: false, cost, taskId: task?.id ?? null };
            continue;
          }
          const target = serp.items.find((item: any) => item.type === 'maps_search' && item.place_id === location.dataforseo_place_id);
          const rank = Number.isInteger(target?.rank_group) ? Number(target.rank_group) : null;
          if (target && (rank == null || rank < 1)) {
            outcomes[index] = { rank: null, valid: false, cost, taskId: task?.id ?? null };
            continue;
          }
          outcomes[index] = { rank: rank && rank <= request.depth ? rank : null, valid: true, cost, taskId: task?.id ?? null };
        } catch {
          outcomes[index] = { rank: null, valid: false, cost: null, taskId: null };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, points.length) }, () => worker()));
    const providerCostKnown = outcomes.every((outcome) => outcome.cost !== null);
    const actualCost = providerCostKnown ? outcomes.reduce((sum, outcome) => sum + (outcome.cost ?? 0), 0) : null;
    const results = points.map((point, index) => {
      const outcome = outcomes[index];
      return !outcome.valid ? { ...point, status: 'failed' as const, rank: null } : outcome.rank == null
        ? { ...point, status: 'not_found_within_depth' as const, rank: null }
        : { ...point, status: 'found' as const, rank: outcome.rank };
    });
    const resultRows = results.map((result) => ({ scan_id: scan.id, user_id: user.id, point_index: result.index,
      grid_row: result.row, grid_column: result.column, latitude: result.latitude, longitude: result.longitude,
      status: result.status, rank: result.rank, observed_at: result.status === 'failed' ? null : new Date().toISOString(), expires_at: expiresAt }));
    const { error: updatePointsError } = await admin.from('georank_points').upsert(resultRows, { onConflict: 'scan_id,point_index' });
    if (updatePointsError) {
      await admin.from('georank_scans').update({ status: 'failed', error_code: 'RESULTS_SAVE_FAILED', completed_at: new Date().toISOString() }).eq('id', scan.id);
      await admin.from('georank_points').update({ status: 'failed', rank: null }).eq('scan_id', scan.id);
      return json({ error: 'SCAN_RESULTS_SAVE_FAILED', scan_id: scan.id }, 503);
    }
    const metrics = calculateGeoScanMetrics(results, request.depth);
    const failed = metrics.failed_points > 0;
    const scanStatus = metrics.valid_points === 0 ? 'failed' : failed ? 'partial' : 'completed';
    const { error: finishError } = await admin.from('georank_scans').update({ status: scanStatus, actual_cost_usd: actualCost,
      completed_at: new Date().toISOString(), provider_reference: outcomes.find((outcome) => outcome.taskId)?.taskId ?? null,
      updated_at: new Date().toISOString() }).eq('id', scan.id).eq('user_id', user.id);
    if (finishError) return json({ error: 'SCAN_FINALIZE_FAILED', scan_id: scan.id }, 503);
    let costReconciliationPending = !providerCostKnown;
    if (providerCostKnown) {
      const { error: settleError } = await admin.from('georank_usage_reservations').update({ status: 'settled', actual_cost_usd: actualCost, updated_at: new Date().toISOString() })
        .eq('id', reservationId).eq('user_id', user.id);
      costReconciliationPending = Boolean(settleError);
    }
    return json({ scan_id: scan.id, status: scanStatus, keyword: request.keyword, grid_size: request.gridSize,
      result_depth: request.depth, metrics, points: results.map(({ index, row, column, latitude, longitude, status, rank }) =>
      ({ index, row, column, latitude, longitude, status, rank })), estimated_cost_usd: estimate.estimated_cost_usd,
      actual_cost_usd: actualCost, cost_reconciliation_pending: costReconciliationPending, expires_at: expiresAt });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = code === 'INVALID_REQUEST' ? 400 : code === 'FEATURE_REQUIRED' || code === 'ACCOUNT_INACTIVE' ? 403 :
      code === 'DATABASE_UNAVAILABLE' ? 503 : 500;
    return json({ error: code }, status);
  }
});
