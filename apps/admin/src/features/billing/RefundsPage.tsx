import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatDate, formatId, refToSlug } from '@/lib/format';

interface RefundRow {
  id: string;
  org_id: string;
  org_name: string;
  org_ref_id: string;
  amount_cents: number | null;
  reason: string;
  status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  processed_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  REQUESTED:    'bg-[#EFF6FF] text-[#1D4ED8]',
  UNDER_REVIEW: 'bg-[#FFF7ED] text-[#C2410C]',
  APPROVED:     'bg-[#ECFDF5] text-[#065F46]',
  REJECTED:     'bg-[#FEF2F2] text-[#991B1B]',
  PROCESSING:   'bg-[#F3E8FF] text-[#7C3AED]',
  REFUNDED:     'bg-[#ECFDF5] text-[#065F46]',
  FAILED:       'bg-[#FEF2F2] text-[#991B1B]',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Failed' },
];

const LIFECYCLE: Record<string, string[]> = {
  REQUESTED:    ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     ['PROCESSING'],
  PROCESSING:   ['REFUNDED', 'FAILED'],
};

export function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('refund_requests')
      .select('id, org_id, amount_cents, reason, status, admin_note, reviewed_at, processed_at, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const orgIds = [...new Set(data.map((r: { org_id: string }) => r.org_id))];
    const { data: orgRows } = await supabase
      .from('organizations').select('id, ref_id, name').in('id', orgIds);
    const orgMap = new Map<string, { ref_id: string; name: string }>(
      (orgRows ?? []).map((o: { id: string; ref_id: string; name: string }) => [o.id, { ref_id: o.ref_id, name: o.name }])
    );

    setRefunds(data.map((r: { id: string; org_id: string; amount_cents: number | null; reason: string; status: string; admin_note: string | null; reviewed_at: string | null; processed_at: string | null; created_at: string }) => ({
      ...r,
      org_name: orgMap.get(r.org_id)?.name ?? '—',
      org_ref_id: orgMap.get(r.org_id)?.ref_id ?? '',
    })));
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string, note?: string) {
    setUpdating(id); setMsg(null);
    const payload: Record<string, unknown> = { status: newStatus };
    if (note !== undefined) payload.admin_note = note;
    if (['APPROVED', 'REJECTED'].includes(newStatus)) payload.reviewed_at = new Date().toISOString();
    if (['REFUNDED', 'FAILED'].includes(newStatus)) payload.processed_at = new Date().toISOString();
    const { error } = await supabase.from('refund_requests').update(payload).eq('id', id);
    setUpdating(null);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    load();
  }

  const filtered = refunds.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFrom && r.created_at < dateFrom) return false;
    if (dateTo && r.created_at > dateTo + 'T23:59:59') return false;
    if (search) {
      const q = search.toLowerCase();
      return r.org_name.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q) || formatId(r.org_ref_id).includes(q);
    }
    return true;
  });

  // Stat counts
  const counts = STATUS_OPTIONS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = refunds.filter(r => r.status === s.value).length;
    return acc;
  }, {});
  const totalAmount = refunds.filter(r => r.status === 'REFUNDED' && r.amount_cents).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Refunds</h1>
        <p className="text-sm text-[#6B7280] mt-1">Manage refund requests across all organisations.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Review', value: (counts.REQUESTED ?? 0) + (counts.UNDER_REVIEW ?? 0), color: 'text-[#C2410C]' },
          { label: 'Approved', value: counts.APPROVED ?? 0, color: 'text-[#065F46]' },
          { label: 'Refunded', value: counts.REFUNDED ?? 0, color: 'text-[#059669]' },
          { label: 'Total Refunded', value: `$${(totalAmount / 100).toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'text-[#111827]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white shadow-sm rounded-xl px-5 py-4">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search org, reason…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#E5EAE8] rounded-xl bg-white text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]" />
        </div>
        <Dropdown value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} clearable />
        <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} alignRight />
        <span className="text-xs text-[#9CA3AF] ml-auto">{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {msg && <div className="mb-4 px-4 py-3 bg-[#FEF2F2] text-red-700 text-sm rounded-xl">{msg}</div>}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#9CA3AF]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">No refund requests found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Organisation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Reason</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Requested</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filtered.map(r => {
                const nextSteps = LIFECYCLE[r.status] ?? [];
                const isExpanded = expandedId === r.id;
                return (
                  <>
                    <tr key={r.id} className="hover:bg-[#F8FAF9] cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                      <td className="px-5 py-3.5">
                        <Link to={`/clients/${refToSlug(r.org_ref_id)}`} onClick={e => e.stopPropagation()} className="font-medium text-[#111827] hover:text-[#0D4C3C] transition-colors">{r.org_name}</Link>
                        <p className="text-[10px] text-[#9CA3AF] font-mono">{formatId(r.org_ref_id)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${STATUS_COLOR[r.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{r.status}</span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#111827]">{r.amount_cents ? `$${(r.amount_cents / 100).toFixed(2)}` : '—'}</td>
                      <td className="px-5 py-3.5 text-[#374151] max-w-xs truncate">{r.reason}</td>
                      <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{formatDate(r.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {nextSteps.length > 0 && (
                          <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                            {nextSteps.map(next => (
                              <button key={next} onClick={() => updateStatus(r.id, next, noteEdit[r.id])} disabled={updating === r.id}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                  next === 'APPROVED' || next === 'REFUNDED' ? 'text-[#065F46] bg-[#ECFDF5] hover:bg-green-100' :
                                  next === 'REJECTED' || next === 'FAILED' ? 'text-red-700 bg-[#FEF2F2] hover:bg-red-100' :
                                  next === 'PROCESSING' ? 'text-[#7C3AED] bg-[#F3E8FF] hover:bg-purple-100' :
                                  'border border-[#E5EAE8] hover:bg-[#F8FAF9] text-[#374151]'
                                }`}>
                                {updating === r.id ? '…' : next.replace(/_/g, ' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-expand`} className="bg-[#FAFAF9]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Full reason</p>
                              <p className="text-sm text-[#374151]">{r.reason}</p>
                              {r.admin_note && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Admin note</p>
                                  <p className="text-sm text-[#374151] italic">{r.admin_note}</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Add / update note</label>
                              <textarea rows={2} value={noteEdit[r.id] ?? r.admin_note ?? ''} onChange={e => setNoteEdit(n => ({ ...n, [r.id]: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:border-[#0D4C3C] resize-none" />
                              <button onClick={() => supabase.from('refund_requests').update({ admin_note: noteEdit[r.id] }).eq('id', r.id).then(() => load())}
                                className="mt-1.5 px-3 py-1 text-xs font-medium border border-[#E5EAE8] rounded-lg hover:bg-[#F8FAF9] transition-colors">Save note</button>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-6 text-xs text-[#9CA3AF]">
                            {r.reviewed_at && <span>Reviewed: {formatDate(r.reviewed_at)}</span>}
                            {r.processed_at && <span>Processed: {formatDate(r.processed_at)}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
