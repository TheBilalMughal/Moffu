import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId, refToSlug } from '@/lib/format';

interface ConnectionRow {
  id: string;
  user_id: string;
  google_email: string | null;
  state: string;
  connected_at: string;
  error_message: string | null;
  org_id: string;
  org_name: string;
  org_ref_id: string;
}

const STATE_COLOR: Record<string, string> = {
  CONNECTED:    'bg-[#ECFDF5] text-[#065F46]',
  DISCONNECTED: 'bg-[#F3F4F6] text-[#374151]',
  ERROR:        'bg-[#FEF2F2] text-[#991B1B]',
  PENDING:      'bg-[#FFF7ED] text-[#C2410C]',
};

const STATE_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'DISCONNECTED', label: 'Disconnected' },
  { value: 'ERROR', label: 'Error' },
  { value: 'PENDING', label: 'Pending' },
];

export function IntegrationsHealthPage() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: connData } = await supabase
      .from('google_connections')
      .select('id, user_id, google_email, state, connected_at, error_message')
      .order('state', { ascending: true })
      .order('connected_at', { ascending: false });

    if (!connData || connData.length === 0) { setConnections([]); setLoading(false); return; }

    const userIds = [...new Set(connData.map((c: { user_id: string }) => c.user_id))];
    const { data: memberData } = await supabase
      .from('org_members')
      .select('user_id, org_id')
      .in('user_id', userIds);

    const userToOrg = new Map<string, string>(
      (memberData ?? []).map((m: { user_id: string; org_id: string }) => [m.user_id, m.org_id])
    );
    const orgIds = [...new Set([...userToOrg.values()])];
    const { data: orgData } = await supabase.from('organizations').select('id, ref_id, name').in('id', orgIds);
    const orgMap = new Map<string, { ref_id: string; name: string }>(
      (orgData ?? []).map((o: { id: string; ref_id: string; name: string }) => [o.id, { ref_id: o.ref_id, name: o.name }])
    );

    type ConnData = { id: string; user_id: string; google_email: string | null; state: string; connected_at: string; error_message: string | null };
    setConnections(connData.map((c: ConnData) => {
      const orgId = userToOrg.get(c.user_id) ?? '';
      const org = orgMap.get(orgId);
      return { ...c, org_id: orgId, org_name: org?.name ?? '—', org_ref_id: org?.ref_id ?? '' };
    }));
    setLoading(false);
  }

  async function handleRetry(conn: ConnectionRow) {
    setRetrying(conn.id); setRetryMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${env.supabaseUrl}/functions/v1/google-fetch-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': env.supabaseAnonKey },
        body: JSON.stringify({ user_id: conn.user_id }),
      });
      if (!res.ok) { const d = await res.json(); setRetryMsg(d.error ?? 'Retry failed'); }
      else { setRetryMsg('Retry triggered — connection state will update shortly.'); load(); }
    } catch { setRetryMsg('Network error'); }
    finally { setRetrying(null); }
  }

  const filtered = connections.filter(c => {
    if (stateFilter !== 'all' && c.state !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.org_name.toLowerCase().includes(q) || (c.google_email ?? '').toLowerCase().includes(q) || formatId(c.org_ref_id).includes(q);
    }
    return true;
  });

  // Health summary
  const total = connections.length;
  const connected = connections.filter(c => c.state === 'CONNECTED').length;
  const errors = connections.filter(c => c.state === 'ERROR').length;
  const disconnected = connections.filter(c => c.state === 'DISCONNECTED').length;
  const healthPct = total > 0 ? Math.round((connected / total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Google Integration Health</h1>
        <p className="text-sm text-[#6B7280] mt-1">Monitor and manage all Google Business Profile connections across organisations.</p>
      </div>

      {/* Health stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Connections', value: total, color: 'text-[#111827]' },
          { label: 'Connected', value: connected, color: 'text-[#065F46]' },
          { label: 'Errors', value: errors, color: errors > 0 ? 'text-red-600' : 'text-[#9CA3AF]' },
          { label: 'Health Score', value: `${healthPct}%`, color: healthPct >= 80 ? 'text-[#059669]' : healthPct >= 50 ? 'text-[#C2410C]' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white shadow-sm rounded-xl px-5 py-4">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Health bar */}
      {total > 0 && (
        <div className="bg-white shadow-sm rounded-xl px-6 py-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#374151]">Connection Health</p>
            <span className="text-xs text-[#6B7280]">{connected}/{total} connected</span>
          </div>
          <div className="w-full h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#111111] transition-all" style={{ width: `${(connected / total) * 100}%` }} />
            <div className="h-full bg-[#FCA5A5] transition-all" style={{ width: `${(errors / total) * 100}%` }} />
            <div className="h-full bg-[#E5E7EB] transition-all" style={{ width: `${(disconnected / total) * 100}%` }} />
          </div>
          <div className="flex items-center gap-6 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-[#111111]" /><span className="text-[10px] text-[#9CA3AF]">Connected</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-[#FCA5A5]" /><span className="text-[10px] text-[#9CA3AF]">Error</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-[#E5E7EB]" /><span className="text-[10px] text-[#9CA3AF]">Disconnected</span></div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search org, Google account…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#E5E7EB] rounded-xl bg-white text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8]" />
        </div>
        <Dropdown value={stateFilter} onChange={setStateFilter} options={STATE_OPTIONS} clearable />
        <span className="text-xs text-[#9CA3AF] ml-auto">{filtered.length} connection{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {retryMsg && <div className={`mb-4 px-4 py-3 text-sm rounded-xl ${retryMsg.startsWith('Error') || retryMsg.includes('failed') ? 'bg-[#FEF2F2] text-red-700' : 'bg-[#ECFDF5] text-[#065F46]'}`}>{retryMsg}</div>}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[#9CA3AF]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-[#9CA3AF]">No connections found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Organisation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Google Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">State</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Connected</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-5 py-3.5">
                    {c.org_ref_id ? (
                      <Link to={`/clients/${refToSlug(c.org_ref_id)}`} className="font-medium text-[#111827] hover:text-[#6C55E8] transition-colors">{c.org_name}</Link>
                    ) : (
                      <span className="font-medium text-[#111827]">{c.org_name}</span>
                    )}
                    {c.org_ref_id && <p className="text-[10px] text-[#9CA3AF] font-mono">{formatId(c.org_ref_id)}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-[#374151]">{c.google_email ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded w-fit ${STATE_COLOR[c.state] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{c.state}</span>
                      {c.error_message && <span className="text-[10px] text-red-500 truncate max-w-[200px]">{c.error_message}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{formatDate(c.connected_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {(c.state === 'ERROR' || c.state === 'DISCONNECTED') && (
                      <button onClick={() => handleRetry(c)} disabled={retrying === c.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:bg-[#FAFAF7] hover:border-[#6C55E8] hover:text-[#6C55E8] transition-colors disabled:opacity-50">
                        {retrying === c.id
                          ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        }
                        {retrying === c.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

