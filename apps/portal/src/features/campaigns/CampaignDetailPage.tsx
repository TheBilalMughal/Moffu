import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  from_name: string | null;
  reply_to: string | null;
  review_link: string | null;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  unsubscribed_count: number;
  total_contacts: number;
  sent_at: string | null;
  created_at: string;
  scheduled_at: string | null;
}

interface Contact {
  id: string;
  name: string | null;
  email: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-[#F3F4F6] text-[#374151]',
  scheduled: 'bg-[#EFF6FF] text-[#1D4ED8]',
  sending:   'bg-[#FFFBEB] text-[#B45309]',
  sent:      'bg-[#F0FDF4] text-[#15803D]',
  failed:    'bg-[#FEF2F2] text-[#DC2626]',
  paused:    'bg-[#F3F4F6] text-[#6B7280]',
  pending:   'bg-[#F3F4F6] text-[#6B7280]',
  bounced:   'bg-[#FFF7ED] text-[#C2410C]',
  unsubscribed: 'bg-[#F3F4F6] text-[#6B7280]',
};

function pct(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1.5 ${color ?? 'text-[#111827]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign,  setCampaign]  = useState<Campaign | null>(null);
  const [contacts,  setContacts]  = useState<Contact[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [contactQ,  setContactQ]  = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: camp }, { data: cxs }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_contacts').select('id,name,email,status,sent_at,opened_at,clicked_at,error').eq('campaign_id', id).order('created_at', { ascending: true }),
    ]);
    setCampaign(camp as Campaign);
    setContacts((cxs ?? []) as Contact[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-[#9CA3AF]">Loading…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="px-4 md:px-8 py-6">
        <p className="text-sm text-[#374151]">Campaign not found.</p>
        <Link to="/campaigns" className="text-xs text-[#6C55E8] hover:underline mt-2 inline-block">← Back to Campaigns</Link>
      </div>
    );
  }

  const filteredContacts = contacts.filter(c => {
    const matchQ = !contactQ || c.email.toLowerCase().includes(contactQ.toLowerCase()) || (c.name?.toLowerCase() ?? '').includes(contactQ.toLowerCase());
    const matchS = statusFilter === 'all' || c.status === statusFilter;
    return matchQ && matchS;
  });

  const statusCounts = contacts.reduce<Record<string, number>>((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {});

  return (
    <div className="px-4 md:px-8 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/campaigns" className="text-sm text-[#6B7280] hover:text-[#6C55E8] transition-colors">Campaigns</Link>
        <svg className="w-3.5 h-3.5 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        <span className="text-sm font-medium text-[#111827]">{campaign.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#111827]">{campaign.name}</h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${STATUS_COLORS[campaign.status] ?? ''}`}>{campaign.status}</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-xs text-[#6B7280]">Created {fmtDate(campaign.created_at)}</span>
            {campaign.sent_at && <span className="text-xs text-[#6B7280]">Sent {fmtDate(campaign.sent_at)}</span>}
            {campaign.from_name && <span className="text-xs text-[#6B7280]">From: {campaign.from_name}</span>}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Contacts"  value={campaign.total_contacts} />
        <StatCard label="Delivered"       value={campaign.sent_count}     color="text-[#1D4ED8]" sub={pct(campaign.sent_count, campaign.total_contacts) + ' delivery'} />
        <StatCard label="Opened"          value={campaign.opened_count}   color="text-[#6C55E8]" sub={pct(campaign.opened_count, campaign.sent_count) + ' open rate'} />
        <StatCard label="Clicked"         value={campaign.clicked_count}  color="text-[#B45309]" sub={pct(campaign.clicked_count, campaign.sent_count) + ' click rate'} />
        <StatCard label="Unsubscribed"    value={campaign.unsubscribed_count} color="text-[#DC2626]" sub={pct(campaign.unsubscribed_count, campaign.sent_count)} />
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        <p className="text-xs font-semibold text-[#374151] mb-3">Funnel</p>
        <div className="space-y-3">
          {[
            { label: 'Sent',         val: campaign.sent_count,          max: campaign.total_contacts, color: 'bg-[#1D4ED8]' },
            { label: 'Opened',       val: campaign.opened_count,        max: campaign.total_contacts, color: 'bg-[#111827]' },
            { label: 'Clicked',      val: campaign.clicked_count,       max: campaign.total_contacts, color: 'bg-[#B45309]' },
            { label: 'Unsubscribed', val: campaign.unsubscribed_count,  max: campaign.total_contacts, color: 'bg-[#DC2626]' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-xs text-[#6B7280] w-24 flex-shrink-0">{row.label}</span>
              <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className={`h-2 rounded-full ${row.color} transition-all`} style={{ width: row.max ? `${Math.min((row.val / row.max) * 100, 100)}%` : '0%' }} />
              </div>
              <span className="text-xs font-medium text-[#374151] w-10 text-right tabular-nums">{row.val}</span>
              <span className="text-[10px] text-[#9CA3AF] w-10 text-right tabular-nums">{pct(row.val, row.max)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message preview */}
      {campaign.subject && (
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between">
            <p className="text-xs font-semibold text-[#374151]">Email Content</p>
            <div className="flex items-center gap-4 text-xs text-[#6B7280]">
              <span>Subject: <span className="text-[#111827] font-medium">{campaign.subject}</span></span>
              {campaign.reply_to && <span>Reply-To: {campaign.reply_to}</span>}
            </div>
          </div>
          {campaign.body && (
            <div className="px-5 py-4 text-sm text-[#374151] whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto bg-[#FAFAFA]">
              {campaign.body}
            </div>
          )}
        </div>
      )}

      {/* Contacts table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#374151] flex-shrink-0">
            Contacts <span className="font-normal text-[#9CA3AF]">({contacts.length})</span>
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {/* Status filter */}
            <div className="flex items-center gap-1">
              {['all', 'sent', 'pending', 'failed', 'opened', 'unsubscribed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors capitalize ${
                    statusFilter === s ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                  }`}>
                  {s}{s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
                </button>
              ))}
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input value={contactQ} onChange={e => setContactQ(e.target.value)} placeholder="Search contacts…"
                className="pl-7 pr-3 py-1.5 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827] w-48" />
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {['Name', 'Email', 'Status', 'Sent', 'Opened', 'Clicked'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F9FAFB]">
            {filteredContacts.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No contacts match your filter</td></tr>
            ) : filteredContacts.map(c => (
              <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="px-5 py-3 text-[#374151]">{c.name || <span className="text-[#D1D5DB] italic">—</span>}</td>
                <td className="px-5 py-3 font-medium text-[#111827]">{c.email}</td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                  {c.error && <p className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={c.error}>{c.error}</p>}
                </td>
                <td className="px-5 py-3 text-xs text-[#6B7280]">{c.sent_at ? fmtDate(c.sent_at) : '—'}</td>
                <td className="px-5 py-3">
                  {c.opened_at
                    ? <span className="text-xs text-[#6C55E8] font-medium">{fmtDate(c.opened_at)}</span>
                    : <span className="text-[#D1D5DB]">—</span>}
                </td>
                <td className="px-5 py-3">
                  {c.clicked_at
                    ? <span className="text-xs text-[#B45309] font-medium">{fmtDate(c.clicked_at)}</span>
                    : <span className="text-[#D1D5DB]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
