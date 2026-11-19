import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { googleGrowthService } from './google-growth.service';
import type { GoogleGrowthReport, GoogleGrowthStatus } from './google-growth.service';

function friendlyError(code: string) {
  const normalizedCode = code.toUpperCase();
  if (normalizedCode.includes('SERVICE_DISABLED') || normalizedCode.includes('API_NOT_ENABLED') || normalizedCode.includes('ACCESSNOTCONFIGURED')) {
    return 'The required Google API is disabled in the Cloud project for this OAuth client. Enable Search Console API and Google Analytics Admin API, then refresh properties.';
  }
  if (normalizedCode.includes('API_KEY_SERVICE_BLOCKED') || normalizedCode.includes('REQUEST_DENIED')) {
    return 'Google rejected the API request. Check the OAuth client project and API restrictions, then refresh properties.';
  }
  if (normalizedCode.includes('PERMISSION_DENIED') || normalizedCode.includes('PROPERTY_NOT_ACCESSIBLE')) {
    return 'Google denied property access. Make sure this Google account can open the Search Console site and GA4 property. If the API is enabled, add this account in each product’s access settings, then refresh properties.';
  }
  if (code === 'GOOGLE_RECONNECT_REQUIRED') return 'Google access expired. Reconnect Search Console and Analytics.';
  if (code === 'GOOGLE_CONFIGURATION_INCOMPLETE' || code === 'GOOGLE_CONFIGURATION_UNAVAILABLE') return 'Google OAuth credentials or redirect URL are not configured in Admin settings.';
  if (code === 'SELECT_BOTH_PROPERTIES') return 'Choose both a Search Console property and a GA4 property, then save.';
  if (code === 'SEARCH_CONSOLE_PROPERTY_NOT_ACCESSIBLE') return 'This Google account cannot access that Search Console property.';
  if (code === 'GA4_PROPERTY_NOT_ACCESSIBLE') return 'This Google account cannot access that GA4 property.';
  if (code === 'NO_SEARCH_CONSOLE_PROPERTIES') return 'No Search Console site is available to this Google account. Add and verify your website in Search Console, or ask a current owner to grant this account access, then refresh properties.';
  if (code === 'NO_GA4_PROPERTIES') return 'No GA4 property is available to this Google account. Add this account under the property’s Admin → Property access management, then refresh properties.';
  return code.replaceAll('_', ' ').toLowerCase();
}

function fmt(value: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function change(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 'New' : '—';
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function MetricCard({ label, current, previous, format = (value: number) => fmt(value) }: {
  label: string; current: number; previous: number; format?: (value: number) => string;
}) {
  const delta = current - previous;
  const positive = label === 'Average position' ? delta < 0 : delta > 0;
  return <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
    <p className="text-xs text-[#6B7280]">{label}</p>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">{format(current)}</p>
    <p className={`mt-1 text-xs ${delta === 0 ? 'text-[#6B7280]' : positive ? 'text-emerald-700' : 'text-rose-600'}`}>
      {change(current, previous)} <span className="text-[#9CA3AF]">vs previous period</span>
    </p>
  </div>;
}

function ResourceError({ code }: { code: string }) {
  return <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">{friendlyError(code)}</p>;
}

export function GoogleGrowthPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleGrowthStatus | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [days, setDays] = useState<28 | 90>(28);
  const [report, setReport] = useState<GoogleGrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await googleGrowthService.status();
      setStatus(result);
      setSiteUrl(result.searchConsoleSiteUrl ?? '');
      setPropertyId(result.ga4PropertyId ?? '');
    } catch (err) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Could not load Google integrations.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (params.get('google_growth') === 'connected') {
      setParams({}, { replace: true });
      void loadStatus();
    }
  }, [params, setParams, loadStatus]);

  const sites = status?.resources?.searchConsole.items ?? [];
  const properties = status?.resources?.analytics.items ?? [];
  const selectedSite = useMemo(() => sites.find(item => item.siteUrl === siteUrl), [sites, siteUrl]);
  const selectedProperty = useMemo(() => properties.find(item => item.property === propertyId), [properties, propertyId]);

  async function connect() {
    setConnecting(true); setError('');
    try {
      const result = await googleGrowthService.start();
      window.location.assign(result.auth_url);
    } catch (err) { setError(err instanceof Error ? friendlyError(err.message) : 'Could not start Google authorization.'); setConnecting(false); }
  }

  async function saveProperties() {
    if (!siteUrl || !propertyId) { setError('Choose both properties first.'); return; }
    setSaving(true); setError(''); setReport(null);
    try {
      await googleGrowthService.configure(siteUrl, propertyId);
      await loadStatus();
    } catch (err) { setError(err instanceof Error ? friendlyError(err.message) : 'Could not save properties.'); }
    finally { setSaving(false); }
  }

  async function loadReport(nextDays = days) {
    setReporting(true); setError('');
    try { setReport(await googleGrowthService.report(nextDays)); }
    catch (err) { setError(err instanceof Error ? friendlyError(err.message) : 'Could not load reports.'); }
    finally { setReporting(false); }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Search Console and Google Analytics? Stored access tokens will be removed.')) return;
    setDisconnecting(true); setError('');
    try { await googleGrowthService.disconnect(); setReport(null); await loadStatus(); }
    catch (err) { setError(err instanceof Error ? friendlyError(err.message) : 'Could not disconnect Google.'); }
    finally { setDisconnecting(false); }
  }

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#6C55E8]">Google Growth</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">SEO &amp; Leads</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">Connect Search Console and GA4 to compare organic search visibility with website visits and conversions.</p>
      </div>
      {status?.connected && <button type="button" onClick={disconnect} disabled={disconnecting}
        className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50">
        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
      </button>}
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

    {loading ? <div className="h-28 animate-pulse rounded-xl bg-[#F3F4F6]" /> : !status?.connected ? (
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8">
        <h2 className="text-base font-semibold text-[#111827]">Connect your Google data</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280]">Authorize read-only access to Search Console and Google Analytics. Moffu uses the selected properties to show website search performance and Google organic conversions.</p>
        <button type="button" onClick={connect} disabled={connecting}
          className="mt-5 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6C55E8] disabled:opacity-50">
          {connecting ? 'Opening Google…' : 'Connect Search Console + GA4'}
        </button>
        <p className="mt-3 text-xs text-[#9CA3AF]">Read-only access. This connection is separate from your Google Business Profile connection.</p>
      </section>
    ) : <>
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Connected Google account</h2>
            <p className="mt-1 text-xs text-[#6B7280]">{status.googleEmail ?? 'Google account connected'}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Read-only connected</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[#374151]">Search Console property</span>
            <select value={siteUrl} onChange={event => setSiteUrl(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111827] focus:border-[#6C55E8] focus:outline-none">
              <option value="">Choose a verified site</option>
              {sites.map(site => <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</option>)}
            </select>
            {status.resources?.searchConsole.error && <ResourceError code={status.resources.searchConsole.error} />}
            {status.resources && !status.resources.searchConsole.error && sites.length === 0 &&
              <ResourceError code="NO_SEARCH_CONSOLE_PROPERTIES" />}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#374151]">Google Analytics 4 property</span>
            <select value={propertyId} onChange={event => setPropertyId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111827] focus:border-[#6C55E8] focus:outline-none">
              <option value="">Choose a GA4 property</option>
              {properties.map(item => <option key={item.property} value={item.property}>{item.displayName}{item.parentAccount ? ` · ${item.parentAccount}` : ''}</option>)}
            </select>
            {status.resources?.analytics.error && <ResourceError code={status.resources.analytics.error} />}
            {status.resources && !status.resources.analytics.error && properties.length === 0 &&
              <ResourceError code="NO_GA4_PROPERTIES" />}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={saveProperties} disabled={saving || !siteUrl || !propertyId}
            className="rounded-lg bg-[#111827] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#6C55E8] disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? 'Saving…' : 'Save properties'}
          </button>
          <button type="button" onClick={() => void loadStatus()} disabled={loading}
            className="rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50">Refresh properties</button>
          {selectedSite && selectedProperty && <span className="text-xs text-[#6B7280]">Selected: {selectedSite.siteUrl} · {selectedProperty.displayName}</span>}
        </div>
      </section>

      {status.searchConsoleSiteUrl && status.ga4PropertyId && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Organic search and lead impact</h2>
            <p className="mt-1 text-xs text-[#6B7280]">Search Console data is delayed; report currently includes data through {report?.dataThrough ?? 'the latest finalized date'}.</p>
          </div>
          <div className="flex items-center gap-2">
            {[28, 90].map(value => <button key={value} type="button" onClick={() => setDays(value as 28 | 90)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${days === value ? 'border-[#6C55E8] bg-[#F5F3FF] text-[#6C55E8]' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'}`}>
              {value} days
            </button>)}
            <button type="button" onClick={() => void loadReport()} disabled={reporting}
              className="rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#6C55E8] disabled:opacity-50">
              {reporting ? 'Loading…' : 'Load report'}
            </button>
          </div>
        </div>

        {report && <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Search clicks" current={report.searchConsole.current.clicks} previous={report.searchConsole.previous.clicks} />
            <MetricCard label="Search impressions" current={report.searchConsole.current.impressions} previous={report.searchConsole.previous.impressions} />
            <MetricCard label="Average position" current={report.searchConsole.current.averagePosition} previous={report.searchConsole.previous.averagePosition} format={value => value ? fmt(value, 1) : '—'} />
            <MetricCard label="Google organic sessions" current={report.analytics.current.sessions} previous={report.analytics.previous.sessions} />
            <MetricCard label="Google organic users" current={report.analytics.current.users} previous={report.analytics.previous.users} />
            <MetricCard label="GA4 conversions" current={report.analytics.current.conversions} previous={report.analytics.previous.conversions} />
            <MetricCard label="Search CTR" current={report.searchConsole.current.ctr * 100} previous={report.searchConsole.previous.ctr * 100} format={value => `${fmt(value, 2)}%`} />
          </section>
          <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
            <div className="border-b border-[#F3F4F6] px-5 py-4">
              <h3 className="text-sm font-semibold text-[#111827]">Top Google search queries</h3>
              <p className="mt-1 text-xs text-[#9CA3AF]">Average position is website Search ranking, not Google Maps placement.</p>
            </div>
            {report.searchConsole.current.queries.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No query data for this period. Search Console may omit low-volume queries.</p> :
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="bg-[#F9FAFB] text-[#6B7280]"><tr>
                    <th className="px-5 py-3 font-medium">Query</th><th className="px-4 py-3 font-medium">Clicks</th>
                    <th className="px-4 py-3 font-medium">Impressions</th><th className="px-4 py-3 font-medium">CTR</th><th className="px-4 py-3 font-medium">Avg. position</th>
                  </tr></thead>
                  <tbody>{report.searchConsole.current.queries.map((row, index) => <tr key={`${row.query}-${index}`} className="border-t border-[#F3F4F6]">
                    <td className="max-w-[360px] truncate px-5 py-3 font-medium text-[#374151]">{row.query}</td>
                    <td className="px-4 py-3 text-[#374151]">{fmt(row.clicks)}</td><td className="px-4 py-3 text-[#374151]">{fmt(row.impressions)}</td>
                    <td className="px-4 py-3 text-[#374151]">{fmt(row.ctr * 100, 1)}%</td><td className="px-4 py-3 text-[#374151]">{fmt(row.averagePosition, 1)}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
          </section>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">GA4 conversions count events marked as conversions/key events in the connected property. Search Console average position is an aggregate web-search metric; neither metric is an official overall SEO score.</p>
        </>}
      </section>}
    </>}
  </main>;
}
