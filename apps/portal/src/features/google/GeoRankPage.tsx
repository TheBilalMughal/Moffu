import { useEffect, useMemo, useState } from 'react';
import { useLocationStore } from '@/features/location/location.store';
import { georankService } from './georank.service';
import type { GeoRankRequest, GeoRankStatus, GeoRankProviderCheck, GeoScanResponse } from './georank.service';

const GRID_SIZES = [3, 5, 7, 9] as const;
const SPACINGS = [500, 1000, 2000, 5000] as const;
const DEPTHS = [20, 50, 100] as const;
const BLOCKER_LABELS: Record<string, string> = {
  SCAN_SCHEMA_NOT_INSTALLED: 'GeoRank database migration is not installed on this Supabase project.',
  LOCATION_COORDINATES_UNAVAILABLE: 'Selected location has no verified coordinates yet.',
  VERIFIED_PROVIDER_PLACE_ID_REQUIRED: 'The location needs its Google Maps Place ID. Refresh the Google Business Profile locations to fetch it.',
  PROVIDER_CREDENTIALS_NOT_CONFIGURED: 'Provider credentials are not configured on the server.',
  SOURCE_RIGHTS_NOT_APPROVED: 'Provider data use is waiting for rights approval.',
  GEORANK_DISABLED: 'GeoRank is disabled until its source and policy checks are complete.',
  COST_LIMITS_NOT_CONFIGURED: 'A per-request price and monthly spend cap must be configured.',
};
const ERROR_LABELS: Record<string, string> = {
  GEORANK_FUNCTION_NOT_DEPLOYED: 'GeoRank Edge Function is not deployed to the connected Supabase project yet.',
  LOCATION_IDENTITY_OR_COORDINATES_REQUIRED: 'The selected location is missing verified identity or coordinates.',
  SCAN_EXCEEDS_BUDGET: 'This scan exceeds the configured per-scan budget.',
  MONTHLY_BUDGET_EXCEEDED: 'The monthly GeoRank budget is already reserved or spent.',
  PROVIDER_REQUEST_FAILED: 'The ranking provider did not complete the request. Reserved spend remains held until reconciled.',
  FEATURE_REQUIRED: 'GeoRank requires an active plan with Google Profile access.',
};
const PROVIDER_CHECK_LABELS: Record<string, string> = {
  PROVIDER_CREDENTIALS_NOT_CONFIGURED: 'DataForSEO credentials are missing on the server.',
  PROVIDER_AUTH_FAILED: 'DataForSEO rejected the server credentials.',
  PROVIDER_REJECTED: 'DataForSEO returned an account error.',
  PROVIDER_UNAVAILABLE: 'Could not reach DataForSEO. Try again later.',
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
    <p className="text-xs font-medium text-[#6B7280]">{label}</p>
    <p className="mt-1 text-xl font-bold text-[#111827]">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</p>}
  </div>;
}

function Grid({ result, gridSize }: { result: GeoScanResponse; gridSize: number }) {
  const cells = useMemo(() => Array.from({ length: gridSize * gridSize }, (_, index) => result.points.find((point) => point.index === index)), [result, gridSize]);
  return <div className="grid w-full max-w-[560px] gap-1.5" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }} role="img" aria-label={`${gridSize} by ${gridSize} local visibility grid`}>
    {cells.map((point, index) => {
      const visible = point?.status === 'found';
      const tone = !point || point.status === 'failed' || point.status === 'pending' ? 'bg-[#E5E7EB] text-[#6B7280]' :
        !visible ? 'bg-[#FEF3C7] text-[#92400E]' : point.rank! <= 3 ? 'bg-emerald-500 text-white' :
          point.rank! <= 10 ? 'bg-sky-500 text-white' : 'bg-violet-500 text-white';
      const label = !point ? 'Pending' : point.status === 'found' ? `Rank ${point.rank}` :
        point.status === 'not_found_within_depth' ? `Not found within top ${result.result_depth}` : point.status;
      return <div key={index} title={label} className={`flex aspect-square min-h-8 items-center justify-center rounded-lg text-xs font-semibold sm:text-sm ${tone}`}>
        {point?.status === 'found' ? point.rank : point?.status === 'not_found_within_depth' ? '—' : '·'}
      </div>;
    })}
  </div>;
}

export function GeoRankPage() {
  const { selectedId, locations } = useLocationStore();
  const locationId = selectedId ?? (locations.length === 1 ? locations[0]?.id ?? null : null);
  const currentLocation = locations.find((location) => location.id === locationId);
  const [status, setStatus] = useState<GeoRankStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [providerCheck, setProviderCheck] = useState<GeoRankProviderCheck | null>(null);
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [gridSize, setGridSize] = useState<(typeof GRID_SIZES)[number]>(5);
  const [spacing, setSpacing] = useState<(typeof SPACINGS)[number]>(1000);
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]>(20);
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('en');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeoScanResponse | null>(null);
  const [history, setHistory] = useState<GeoScanResponse[]>([]);

  useEffect(() => {
    let active = true;
    setStatus(null); setProviderCheck(null); setEstimate(null); setResult(null); setHistory([]); setError(null);
    if (!locationId) return;
    setLoadingStatus(true);
    Promise.allSettled([georankService.getStatus(locationId), georankService.getHistory(locationId)]).then(([statusResult, historyResult]) => {
      if (!active) return;
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      else setError(ERROR_LABELS[statusResult.reason?.message] ?? 'Could not check GeoRank configuration.');
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value.history);
        const latest = historyResult.value.history[0];
        if (latest) { setResult(latest); setKeyword(latest.keyword); setGridSize(latest.grid_size as typeof gridSize); setDepth(latest.result_depth as typeof depth); }
      }
    }).finally(() => { if (active) setLoadingStatus(false); });
    return () => { active = false; };
  }, [locationId]);

  const request = (): GeoRankRequest | null => locationId ? ({
    location_id: locationId, keyword: keyword.trim(), grid_size: gridSize, spacing_meters: spacing,
    result_depth: depth, country_code: country, language_code: language, device,
  }) : null;

  async function handleProviderCheck() {
    if (!locationId) return;
    setCheckingProvider(true); setProviderCheck(null);
    try { setProviderCheck(await georankService.checkProvider(locationId)); }
    catch { setProviderCheck({ connected: false, reason: 'PROVIDER_UNAVAILABLE' }); }
    finally { setCheckingProvider(false); }
  }

  async function handleEstimate() {
    const body = request();
    if (!body || !body.keyword || body.country_code.length !== 2 || body.language_code.length !== 2) {
      setError('Enter a keyword, two-letter market code, and two-letter search language.'); return;
    }
    setBusy(true); setError(null); setEstimate(null);
    try {
      const response = await georankService.estimate(body);
      setEstimate(response.estimate.estimated_cost_usd);
    } catch (reason) {
      const errorCode = reason instanceof Error ? reason.message : 'GEORANK_REQUEST_FAILED';
      setError(ERROR_LABELS[errorCode] ?? BLOCKER_LABELS[errorCode] ?? 'Could not estimate this scan.');
    } finally { setBusy(false); }
  }

  async function handleStart() {
    const body = request();
    if (!body || estimate == null) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const response = await georankService.start(body, crypto.randomUUID());
      setResult(response);
      setHistory((items) => [response, ...items.filter((item) => item.scan_id !== response.scan_id)].slice(0, 12));
    } catch (reason) {
      const errorCode = reason instanceof Error ? reason.message : 'GEORANK_REQUEST_FAILED';
      setError(ERROR_LABELS[errorCode] ?? BLOCKER_LABELS[errorCode] ?? 'The scan could not be completed.');
    } finally { setBusy(false); }
  }

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6C55E8]">Local visibility</p>
      <h1 className="mt-1 text-2xl font-bold text-[#111827]">GeoRank</h1>
      <p className="mt-1 max-w-3xl text-sm text-[#6B7280]">Measure where your business appears for a search term around the selected location. Each result is a sampled point, not an estimate for the whole neighborhood.</p>
    </header>

    {!locationId ? <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#6B7280]">
      Select a single business location from the top bar to configure a GeoRank scan.
    </section> : <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold text-[#111827]">Scan setup</h2>
              <p className="mt-1 text-xs text-[#6B7280]">{status?.location.name ?? currentLocation?.display_name ?? 'Selected location'}</p></div>
            <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#4B5563]">Google Maps · {device}</span>
          </div>
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Search keyword</span>
              <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setEstimate(null); }} maxLength={120} placeholder="e.g. dentist near me" className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm outline-none focus:border-[#6C55E8] focus:ring-2 focus:ring-[#6C55E8]/10" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Grid size</span>
                <select value={gridSize} onChange={(event) => { setGridSize(Number(event.target.value) as typeof gridSize); setEstimate(null); }} className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm">
                  {GRID_SIZES.map((size) => <option key={size} value={size}>{size} × {size} ({size * size} points)</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Point spacing</span>
                <select value={spacing} onChange={(event) => { setSpacing(Number(event.target.value) as typeof spacing); setEstimate(null); }} className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm">
                  {SPACINGS.map((meters) => <option key={meters} value={meters}>{meters < 1000 ? `${meters} m` : `${meters / 1000} km`}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Search depth</span>
                <select value={depth} onChange={(event) => { setDepth(Number(event.target.value) as typeof depth); setEstimate(null); }} className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm">
                  {DEPTHS.map((count) => <option key={count} value={count}>Top {count} results</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Market country code</span>
                  <input value={country} onChange={(event) => { setCountry(event.target.value.toUpperCase().slice(0, 2)); setEstimate(null); }} maxLength={2} placeholder="e.g. PK" className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2.5 text-sm uppercase" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Language</span>
                  <input value={language} onChange={(event) => { setLanguage(event.target.value.toLowerCase().slice(0, 2)); setEstimate(null); }} maxLength={2} placeholder="en" className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2.5 text-sm" /></label>
              </div>
              <label className="block sm:max-w-[calc(50%-0.5rem)]"><span className="mb-1.5 block text-xs font-medium text-[#374151]">Device</span>
                <select value={device} onChange={(event) => { setDevice(event.target.value as typeof device); setEstimate(null); }} className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm">
                  <option value="mobile">Mobile</option><option value="desktop">Desktop</option></select></label>
              <p className="text-[11px] text-[#9CA3AF]">The center coordinate sets the local search point; country code is saved as scan metadata and does not replace location coordinates.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={!status?.available || busy || loadingStatus || !keyword.trim() || country.length !== 2 || language.length !== 2} onClick={handleEstimate} className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? 'Working…' : 'Get scan estimate'}
              </button>
              {estimate != null && <button disabled={busy} onClick={handleStart} className="rounded-xl bg-[#6C55E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5941D1] disabled:opacity-50">
                {busy ? 'Scanning…' : `Run scan · $${estimate.toFixed(4)}`}
              </button>}
            </div>
            {estimate != null && <p className="text-xs text-[#6B7280]">Starting the scan submits {gridSize * gridSize} paid provider searches. The provider-reported amount is reconciled after completion.</p>}
          </div>
        </div>

        <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-[#111827]">Connection status</h2>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status?.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {loadingStatus ? 'Checking' : status?.available ? 'Ready' : 'Unavailable'}</span></div>
          <p className="mt-1 text-xs text-[#6B7280]">Rank source: DataForSEO Google Maps results. Your Google Maps API key does not provide the rank scan itself.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={checkingProvider || loadingStatus} onClick={handleProviderCheck}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50">
              {checkingProvider ? 'Checking…' : 'Test DataForSEO connection'}
            </button>
            {providerCheck && <span role="status" className={`text-xs ${providerCheck.connected ? 'text-emerald-700' : 'text-rose-700'}`}>
              {providerCheck.connected ? 'Credentials verified (no charge)' : PROVIDER_CHECK_LABELS[providerCheck.reason ?? ''] ?? 'Connection failed.'}
            </span>}
          </div>
          <ul className="mt-5 space-y-3">
            {status?.blockers.map((blocker) => <li key={blocker} className="flex gap-2 text-xs leading-relaxed text-[#6B7280]">
              <span className="mt-0.5 text-amber-600">●</span><span>{BLOCKER_LABELS[blocker] ?? blocker}</span></li>)}
            {!loadingStatus && !status?.blockers.length && <li className="text-xs text-emerald-700">Provider, location identity, source rights, and scan limits are configured.</li>}
            {loadingStatus && <li className="text-xs text-[#9CA3AF]">Checking location identity and server-side provider readiness…</li>}
          </ul>
          <div className="mt-5 rounded-xl bg-[#F9FAFB] p-3 text-[11px] leading-relaxed text-[#6B7280]">
            Grid extent is measured from the center along each axis: (grid size − 1) × spacing ÷ 2. It is not a circular radius. Scan results expire after 30 days.
          </div>
        </aside>
      </section>

      {history.length > 0 && <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Recent scans</h2>
        <div className="mt-3 flex flex-wrap gap-2">{history.map((scan) => <button key={scan.scan_id} aria-pressed={result?.scan_id === scan.scan_id} onClick={() => {
          setResult(scan); setKeyword(scan.keyword); setGridSize(scan.grid_size as typeof gridSize); setDepth(scan.result_depth as typeof depth); setEstimate(null);
        }} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${result?.scan_id === scan.scan_id ? 'border-[#6C55E8] bg-[#F5F3FF]' : 'border-[#E5E7EB] hover:border-[#9CA3AF]'}`}>
          <span className="block font-semibold text-[#111827]">{scan.keyword}</span>
          <span className="mt-0.5 block text-[#6B7280]">{scan.grid_size}×{scan.grid_size} · {new Date(scan.created_at ?? scan.expires_at).toLocaleDateString()}</span>
        </button>)}</div>
      </section>}

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {result && <section className="space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-[#111827]">Latest scan</h2>
          <p className="mt-1 text-xs text-[#6B7280]">“{keyword}” · {new Date(result.expires_at).toLocaleDateString()} expiry · {result.status}</p></div>
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs text-[#4B5563]">{result.actual_cost_usd == null ? 'Est.' : 'Actual'} ${(result.actual_cost_usd ?? result.estimated_cost_usd).toFixed(4)}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Top 3 coverage" value={result.metrics.top_3_coverage_percent == null ? '—' : `${result.metrics.top_3_coverage_percent.toFixed(1)}%`} hint={`${result.metrics.valid_points} valid points`} />
          <Stat label="Top 10 coverage" value={result.metrics.top_10_coverage_percent == null ? '—' : `${result.metrics.top_10_coverage_percent.toFixed(1)}%`} hint="Valid points are the denominator" />
          <Stat label="Mean observed rank" value={result.metrics.mean_observed_rank == null ? '—' : result.metrics.mean_observed_rank.toFixed(1)} hint={`${result.metrics.found_points} points where found`} />
          <Stat label="Completion" value={`${result.metrics.completion_percent.toFixed(1)}%`} hint={`${result.metrics.failed_points} failed of ${result.metrics.planned_points}`} />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,.7fr)]">
          <div><h3 className="mb-3 text-sm font-semibold text-[#111827]">Sampled positions</h3><Grid result={result} gridSize={gridSize} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#6B7280]">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Top 3</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />4–10</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />Beyond 10</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-300" />Not found in requested depth</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" />Unknown / failed</span>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-[#E5E7EB]">
            <table className="w-full text-left text-xs"><caption className="sr-only">Individual scan point observations</caption>
              <thead className="bg-[#F9FAFB] text-[#6B7280]"><tr><th className="px-3 py-2">Point</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Coordinates</th></tr></thead>
              <tbody className="divide-y divide-[#F3F4F6]">{result.points.map((point) => <tr key={point.index}>
                <td className="px-3 py-2">{point.row + 1}, {point.column + 1}</td>
                <td className="px-3 py-2">{point.status === 'found' ? `#${point.rank}` : point.status === 'not_found_within_depth' ? 'Not found' : 'Unknown'}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        {result.metrics.has_survivorship_bias && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Some valid points did not return your business. Mean rank uses found points only and may be optimistic.</p>}
        {result.cost_reconciliation_pending && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Provider cost is not fully reconciled yet; the estimated amount remains reserved against your monthly cap.</p>}
      </section>}
    </>}
  </main>;
}
