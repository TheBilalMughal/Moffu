export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface GeoGridPoint extends GeoCoordinate {
  index: number;
  row: number;
  column: number;
}

export type GeoPointStatus = 'found' | 'not_found_within_depth' | 'failed' | 'pending' | 'cancelled';

export interface GeoPointObservation {
  status: GeoPointStatus;
  rank: number | null;
}

export interface GeoScanMetrics {
  planned_points: number;
  valid_points: number;
  found_points: number;
  not_found_within_depth_points: number;
  failed_points: number;
  pending_points: number;
  cancelled_points: number;
  completion_percent: number;
  top_3_coverage_percent: number | null;
  top_10_coverage_percent: number | null;
  mean_observed_rank: number | null;
  has_survivorship_bias: boolean;
}

export interface GeoScanPricing {
  cost_per_billable_unit_usd: number;
  results_per_billable_unit: number;
  max_depth: number;
  max_points: number;
  request_multiplier?: number;
}

export interface GeoScanCostEstimate {
  request_count: number;
  billable_units: number;
  estimated_cost_usd: number;
  within_budget: boolean;
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const DEFAULT_MAX_GRID_POINTS = 225;

function assertCoordinate({ latitude, longitude }: GeoCoordinate): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('INVALID_CENTER_COORDINATES');
  }
}

function destination(center: GeoCoordinate, eastMeters: number, northMeters: number): GeoCoordinate {
  const distance = Math.hypot(eastMeters, northMeters);
  if (distance === 0) return { ...center };

  const toRadians = Math.PI / 180;
  const toDegrees = 180 / Math.PI;
  const bearing = Math.atan2(eastMeters, northMeters);
  const angularDistance = distance / EARTH_RADIUS_METERS;
  const latitude1 = center.latitude * toRadians;
  const longitude1 = center.longitude * toRadians;
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
    Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude2 = longitude1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
    Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
  );
  const longitudeDegrees = ((longitude2 * toDegrees + 540) % 360) - 180;
  return { latitude: latitude2 * toDegrees, longitude: longitudeDegrees };
}

/** Build an odd square grid using great-circle offsets; grid spacing is axis-to-axis meters. */
export function createGeoGrid(
  center: GeoCoordinate,
  gridSize: number,
  spacingMeters: number,
  maxPoints = DEFAULT_MAX_GRID_POINTS,
): GeoGridPoint[] {
  assertCoordinate(center);
  if (!Number.isInteger(gridSize) || gridSize < 1 || gridSize % 2 === 0 ||
      !Number.isInteger(maxPoints) || maxPoints < 1 || gridSize * gridSize > maxPoints) {
    throw new Error('INVALID_GRID_SIZE');
  }
  if (!Number.isFinite(spacingMeters) || spacingMeters <= 0) {
    throw new Error('INVALID_GRID_SPACING');
  }

  const half = Math.floor(gridSize / 2);
  const points: GeoGridPoint[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const offset = destination(center, (column - half) * spacingMeters, (half - row) * spacingMeters);
      points.push({ index: points.length, row, column, ...offset });
    }
  }
  return points;
}

/** Failed, pending, and cancelled points stay unknown; they never become rank zero. */
export function calculateGeoScanMetrics(
  observations: GeoPointObservation[],
  depth: number,
): GeoScanMetrics {
  if (!Number.isInteger(depth) || depth < 1) throw new Error('INVALID_RESULT_DEPTH');

  let found = 0;
  let notFound = 0;
  let failed = 0;
  let pending = 0;
  let cancelled = 0;
  let top3 = 0;
  let top10 = 0;
  let rankTotal = 0;

  for (const observation of observations) {
    if (observation.status === 'found') {
      if (!Number.isInteger(observation.rank) || observation.rank! < 1 || observation.rank! > depth) {
        throw new Error('INVALID_FOUND_RANK');
      }
      found += 1;
      rankTotal += observation.rank!;
      if (observation.rank! <= 3) top3 += 1;
      if (observation.rank! <= 10) top10 += 1;
    } else {
      if (observation.rank !== null) throw new Error('RANK_REQUIRES_FOUND_STATUS');
      if (observation.status === 'not_found_within_depth') notFound += 1;
      else if (observation.status === 'failed') failed += 1;
      else if (observation.status === 'pending') pending += 1;
      else if (observation.status === 'cancelled') cancelled += 1;
      else throw new Error('INVALID_POINT_STATUS');
    }
  }

  const valid = found + notFound;
  const percent = (numerator: number, denominator: number) => denominator ? 100 * numerator / denominator : null;
  return {
    planned_points: observations.length,
    valid_points: valid,
    found_points: found,
    not_found_within_depth_points: notFound,
    failed_points: failed,
    pending_points: pending,
    cancelled_points: cancelled,
    completion_percent: observations.length ? 100 * valid / observations.length : 0,
    top_3_coverage_percent: percent(top3, valid),
    top_10_coverage_percent: percent(top10, valid),
    mean_observed_rank: found ? rankTotal / found : null,
    has_survivorship_bias: found > 0 && found < valid,
  };
}

/** Provider-neutral estimate; the adapter supplies its current billable unit and price. */
export function estimateGeoScanCost(
  gridSize: number,
  keywordCount: number,
  depth: number,
  pricing: GeoScanPricing,
  budgetUsd: number,
): GeoScanCostEstimate {
  if (!Number.isInteger(gridSize) || gridSize < 1 || gridSize % 2 === 0 ||
      !Number.isInteger(keywordCount) || keywordCount < 1 ||
      !Number.isInteger(pricing.max_points) || pricing.max_points < 1 || gridSize * gridSize > pricing.max_points ||
      !Number.isInteger(depth) || depth < 1 || depth > pricing.max_depth ||
      !Number.isInteger(pricing.max_depth) || pricing.max_depth < 1 ||
      !Number.isFinite(pricing.cost_per_billable_unit_usd) || pricing.cost_per_billable_unit_usd < 0 ||
      !Number.isInteger(pricing.results_per_billable_unit) || pricing.results_per_billable_unit < 1 ||
      !Number.isFinite(pricing.request_multiplier ?? 1) || (pricing.request_multiplier ?? 1) < 1 ||
      !Number.isFinite(budgetUsd) || budgetUsd < 0) {
    throw new Error('INVALID_COST_ESTIMATE_INPUT');
  }

  const requestCount = gridSize * gridSize * keywordCount;
  const unitsPerRequest = Math.ceil(depth / pricing.results_per_billable_unit);
  const billableUnits = requestCount * unitsPerRequest * (pricing.request_multiplier ?? 1);
  const estimatedCost = billableUnits * pricing.cost_per_billable_unit_usd;
  return {
    request_count: requestCount,
    billable_units: billableUnits,
    estimated_cost_usd: Math.round(estimatedCost * 1_000_000) / 1_000_000,
    within_budget: estimatedCost <= budgetUsd,
  };
}
