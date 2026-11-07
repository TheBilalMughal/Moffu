import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  org_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_email: string | undefined;
  org_name: string | undefined;
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('audit_events')
        .select('id, actor_id, action, resource_type, resource_id, org_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!rows) { setLoading(false); return; }

      type RawRow = { id: string; actor_id: string | null; action: string; resource_type: string | null; resource_id: string | null; org_id: string | null; metadata: Record<string, unknown> | null; created_at: string };
      const typedRows: AuditEvent[] = (rows as RawRow[]).map((r) => ({
        ...r,
        actor_email: undefined,
        org_name: undefined,
      }));

      const actorIds = [...new Set(typedRows.filter((r) => r.actor_id).map((r) => r.actor_id!))];
      const orgIds = [...new Set(typedRows.filter((r) => r.org_id).map((r) => r.org_id!))];

      const [profilesRes, orgsRes] = await Promise.all([
        actorIds.length > 0
          ? supabase.from('profiles').select('id, email').in('id', actorIds)
          : { data: [] },
        orgIds.length > 0
          ? supabase.from('organizations').select('id, name').in('id', orgIds)
          : { data: [] },
      ]);

      const emailById = new Map((profilesRes.data ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));
      const nameById = new Map((orgsRes.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));

      setEvents(typedRows.map((r) => ({
        ...r,
        actor_email: r.actor_id ? emailById.get(r.actor_id) : undefined,
        org_name: r.org_id ? nameById.get(r.org_id) : undefined,
      })));
      setLoading(false);
    }

    load();
  }, []);

  const filtered = events.filter(
    (e) =>
      search.trim() === '' ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      (e.actor_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.resource_type ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#111827]">Audit Logs</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Platform activity log — last 200 events.</p>
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 border-b border-[#E5E7EB] px-8 pb-3">
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Filter events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8]"
          />
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 px-8 py-4">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF7] border-b border-[#E5E7EB] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Time</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actor</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Action</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Resource</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Org</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-1.5">
                          <div className="h-3 bg-[#E5E7EB] rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {search ? 'No events match your filter.' : 'No audit events recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-[#FAFAF7] transition-colors">
                      <td className="px-5 py-1.5 text-xs text-[#9CA3AF] whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-1.5 text-xs text-[#374151]">
                        {e.actor_email ?? (e.actor_id ? e.actor_id.slice(0, 8) + '…' : '—')}
                      </td>
                      <td className="px-5 py-1.5">
                        <span className="font-mono text-xs text-[#111827] bg-[#F3F4F6] rounded px-2 py-0.5">{e.action}</span>
                      </td>
                      <td className="px-5 py-1.5 text-xs text-[#374151]">
                        {e.resource_type && (
                          <span>
                            <span className="font-medium">{e.resource_type}</span>
                            {e.resource_id && <span className="text-[#9CA3AF] font-mono ml-1">{e.resource_id.slice(0, 8)}…</span>}
                          </span>
                        )}
                        {!e.resource_type && '—'}
                      </td>
                      <td className="px-5 py-1.5 text-xs text-[#374151]">
                        {e.org_name ?? (e.org_id ? e.org_id.slice(0, 8) + '…' : '—')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

