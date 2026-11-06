import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DateRangePicker } from '@/components/DateRangePicker';

function today() { return new Date().toISOString().split('T')[0] ?? ''; }
function monthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0] ?? '';
}

interface MonthMetric {
  key: string;        // YYYY-MM
  label: string;
  newOrgs: number;
  newSubs: number;
  churned: number;
  aiDrafts: number;
  replies: number;
  mrrCents: number;
}

interface PlanDist {
  plan: string;
  count: number;
}

function downloadCSV(rows: MonthMetric[]) {
  const header = 'Month,New Orgs,New Subscriptions,Churned,AI Drafts,Replies,MRR (USD)';
  const lines = rows.map(r =>
    [r.label, r.newOrgs, r.newSubs, r.churned, r.aiDrafts, r.replies, (r.mrrCents / 100).toFixed(2)].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `moffu-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function BarChart({ data, color = '#0D4C3C', height = 80 }: { data: number[]; color?: string; height?: number }) {
  const W = 400; const padL = 4; const padR = 4; const plotW = W - padL - padR;
  const max = Math.max(...data, 1);
  const n = data.length; const slotW = plotW / n; const barW = Math.max(3, Math.floor(slotW * 0.6));
  return (
    <svg viewBox={`0 0 ${W} ${height + 2}`} className="w-full" preserveAspectRatio="none">
      <line x1={padL} x2={W - padR} y1={height} y2={height} stroke="#E5EAE8" strokeWidth="1" />
      {data.map((v, i) => {
        const cx = padL + i * slotW + slotW / 2;
        const bH = Math.max(0, (v / max) * height);
        return v > 0
          ? <rect key={i} x={cx - barW / 2} y={height - bH} width={barW} height={bH} fill={color} rx="1" />
          : <circle key={i} cx={cx} cy={height} r="1.5" fill="#E5EAE8" />;
      })}
    </svg>
  );
}

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthMetric[]>([]);
  const [planDist, setPlanDist] = useState<PlanDist[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { load(dateFrom, dateTo); }, [dateFrom, dateTo]);

  async function load(from: string, to: string) {
    setLoading(true);
    const fromISO = from ? from + 'T00:00:00.000Z' : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const toISO   = to   ? to + 'T23:59:59.999Z'   : new Date().toISOString();
    const [orgsRes, subsRes, auditRes, usageRes, planRes] = await Promise.all([
      supabase.from('organizations').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('subscriptions').select('id, plan_id, status, created_at').gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('audit_events').select('action, created_at').eq('action', 'subscription_cancelled').gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('usage_events').select('event_type, created_at').in('event_type', ['ai_draft', 'published_reply']).gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('subscriptions').select('plan_id, status').eq('status', 'active'),
    ]);

    // Plan name map
    const { data: planRows } = await supabase.from('plans').select('id, name, slug');
    const planMap = new Map<string, string>((planRows ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]));
    const planNameMap = new Map<string, string>((planRows ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

    // Plan distribution
    const distCounts: Record<string, number> = {};
    (planRes.data ?? []).forEach((s: { plan_id: string }) => {
      const slug = planMap.get(s.plan_id) ?? 'unknown';
      distCounts[slug] = (distCounts[slug] ?? 0) + 1;
    });
    setPlanDist(Object.entries(distCounts).sort((a, b) => b[1] - a[1]).map(([plan, count]) => ({ plan, count })));

    // Build month buckets spanning the selected range
    const start = from ? new Date(from + 'T00:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end   = to   ? new Date(to + 'T23:59:59')   : new Date();
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const buckets: MonthMetric[] = [];
    const cur = new Date(startMonth);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, label: cur.toLocaleString('en', { month: 'short', year: '2-digit' }), newOrgs: 0, newSubs: 0, churned: 0, aiDrafts: 0, replies: 0, mrrCents: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }

    type OrgRow = { created_at: string };
    (orgsRes.data ?? []).forEach((o: OrgRow) => {
      const b = buckets.find(b => o.created_at.startsWith(b.key));
      if (b) b.newOrgs++;
    });
    type SubRow = { created_at: string };
    (subsRes.data ?? []).forEach((s: SubRow) => {
      const b = buckets.find(b => s.created_at.startsWith(b.key));
      if (b) b.newSubs++;
    });
    type AuditRow = { created_at: string };
    (auditRes.data ?? []).forEach((a: AuditRow) => {
      const b = buckets.find(b => a.created_at.startsWith(b.key));
      if (b) b.churned++;
    });
    type UsageRow = { event_type: string; created_at: string };
    (usageRes.data ?? []).forEach((u: UsageRow) => {
      const b = buckets.find(b => u.created_at.startsWith(b.key));
      if (!b) return;
      if (u.event_type === 'ai_draft') b.aiDrafts++;
      else if (u.event_type === 'published_reply') b.replies++;
    });

    setMonths(buckets);
    setLoading(false);
  }

  const totals = useMemo(() => ({
    newOrgs: months.reduce((s, m) => s + m.newOrgs, 0),
    newSubs: months.reduce((s, m) => s + m.newSubs, 0),
    churned: months.reduce((s, m) => s + m.churned, 0),
    aiDrafts: months.reduce((s, m) => s + m.aiDrafts, 0),
    replies: months.reduce((s, m) => s + m.replies, 0),
  }), [months]);

  const churnRate = totals.newSubs > 0 ? ((totals.churned / totals.newSubs) * 100).toFixed(1) : '0.0';

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Reports & Analytics</h1>
          <p className="text-sm text-[#6B7280] mt-1">Platform-wide growth, revenue and engagement metrics.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} alignRight />
          <button onClick={() => downloadCSV(months)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E5EAE8] rounded-xl hover:bg-[#F3F4F6] text-[#374151] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'New Orgs', value: totals.newOrgs.toLocaleString(), color: 'text-[#0D4C3C]' },
          { label: 'New Subscriptions', value: totals.newSubs.toLocaleString(), color: 'text-[#1D4ED8]' },
          { label: 'Churned', value: totals.churned.toLocaleString(), color: 'text-red-600' },
          { label: 'Churn Rate', value: `${churnRate}%`, color: totals.churned > 0 ? 'text-red-600' : 'text-[#059669]' },
          { label: 'AI Drafts', value: totals.aiDrafts.toLocaleString(), color: 'text-[#374151]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white shadow-sm rounded-xl px-5 py-4">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* New Orgs chart */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <p className="text-sm font-semibold text-[#111827]">New Organisations</p>
          </div>
          <div className="px-5 py-4">
            <BarChart data={months.map(m => m.newOrgs)} color="#0D4C3C" />
            <div className="flex items-center justify-between mt-2">
              {months.filter((_, i) => i % Math.ceil(months.length / 6) === 0).map(m => (
                <span key={m.key} className="text-[9px] text-[#9CA3AF]">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
        {/* AI Usage chart */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <p className="text-sm font-semibold text-[#111827]">AI Drafts Generated</p>
          </div>
          <div className="px-5 py-4">
            <BarChart data={months.map(m => m.aiDrafts)} color="#6EE7B7" />
            <div className="flex items-center justify-between mt-2">
              {months.filter((_, i) => i % Math.ceil(months.length / 6) === 0).map(m => (
                <span key={m.key} className="text-[9px] text-[#9CA3AF]">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white shadow-sm rounded-xl overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <p className="text-sm font-semibold text-[#111827]">Active Plan Distribution</p>
          </div>
          <div className="px-5 py-4">
            {planDist.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No data.</p>
            ) : (() => {
              const total = planDist.reduce((s, p) => s + p.count, 0);
              const COLORS = ['#0D4C3C', '#6EE7B7', '#1D4ED8', '#7C3AED', '#C2410C', '#374151'];
              return planDist.map((p, i) => (
                <div key={p.plan} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#374151] capitalize">{p.plan}</span>
                    <span className="text-xs text-[#6B7280]">{p.count} · {((p.count / total) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(p.count / total) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Monthly table */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <p className="text-sm font-semibold text-[#111827]">Monthly Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            {loading ? <p className="p-6 text-sm text-[#9CA3AF] text-center">Loading…</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#F3F4F6]">
                  {['Month', 'New Orgs', 'New Subs', 'Churned', 'Net', 'AI Drafts', 'Replies'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {[...months].reverse().map(m => {
                    const net = m.newSubs - m.churned;
                    return (
                      <tr key={m.key} className="hover:bg-[#F8FAF9]">
                        <td className="px-4 py-3 text-sm text-[#374151]">{m.label}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-[#0D4C3C]">{m.newOrgs}</td>
                        <td className="px-4 py-3 text-right text-sm">{m.newSubs}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-500">{m.churned || '—'}</td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${net >= 0 ? 'text-[#059669]' : 'text-red-500'}`}>{net > 0 ? `+${net}` : net}</td>
                        <td className="px-4 py-3 text-right text-sm">{m.aiDrafts.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm">{m.replies.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#E5EAE8] bg-[#F8FAF9] font-semibold">
                    <td className="px-4 py-3 text-xs text-[#6B7280] uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right text-sm text-[#0D4C3C]">{totals.newOrgs}</td>
                    <td className="px-4 py-3 text-right text-sm">{totals.newSubs}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-500">{totals.churned || '—'}</td>
                    <td className={`px-4 py-3 text-right text-sm ${totals.newSubs - totals.churned >= 0 ? 'text-[#059669]' : 'text-red-500'}`}>{totals.newSubs - totals.churned > 0 ? `+${totals.newSubs - totals.churned}` : totals.newSubs - totals.churned}</td>
                    <td className="px-4 py-3 text-right text-sm">{totals.aiDrafts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm">{totals.replies.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
