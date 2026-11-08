import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { env } from '@/lib/env';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { formatDate } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Broadcast {
  id: string;
  title: string;
  body: string;
  type: string;
  target_type: string;
  target_value: string | null;
  status: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  info:    'bg-[#EFF6FF] text-[#1D4ED8]',
  success: 'bg-[#F0FDF4] text-[#15803D]',
  warning: 'bg-[#FFFBEB] text-[#B45309]',
  error:   'bg-[#FEF2F2] text-[#DC2626]',
};

const STATUS_COLORS: Record<string, string> = {
  draft:   'bg-[#F3F4F6] text-[#374151]',
  sending: 'bg-[#FFFBEB] text-[#B45309]',
  sent:    'bg-[#F0FDF4] text-[#15803D]',
  failed:  'bg-[#FEF2F2] text-[#DC2626]',
};

function canManage(role: string | null) {
  return ['owner', 'super_admin', 'admin', 'support', 'operations'].includes(role ?? '');
}

// ── Compose Modal ──────────────────────────────────────────────────────────────

interface ComposeModalProps { onClose: () => void; onSent: () => void; }

function ComposeModal({ onClose, onSent }: ComposeModalProps) {
  const { platformRole } = useAdminAuthStore();
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [type,        setType]        = useState('info');
  const [targetType,  setTargetType]  = useState('all');
  const [targetValue, setTargetValue] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [sending,     setSending]     = useState(false);
  const [err,         setErr]         = useState('');
  const [draftId,     setDraftId]     = useState<string | null>(null);

  async function saveDraft() {
    if (!title.trim() || !body.trim()) { setErr('Title and body are required.'); return; }
    setSaving(true); setErr('');
    const payload = { title: title.trim(), body: body.trim(), type, target_type: targetType, target_value: targetValue || null };
    if (draftId) {
      await supabase.from('broadcasts').update(payload).eq('id', draftId);
    } else {
      const { data, error } = await supabase.from('broadcasts').insert({ ...payload, status: 'draft' }).select('id').single();
      if (error) { setErr(error.message); setSaving(false); return; }
      setDraftId(data.id);
    }
    setSaving(false);
    onSent();
  }

  async function sendNow() {
    if (!title.trim() || !body.trim()) { setErr('Title and body are required.'); return; }
    setSending(true); setErr('');

    let id = draftId;
    if (!id) {
      const { data, error } = await supabase.from('broadcasts')
        .insert({ title: title.trim(), body: body.trim(), type, target_type: targetType, target_value: targetValue || null, status: 'draft' })
        .select('id').single();
      if (error) { setErr(error.message); setSending(false); return; }
      id = data.id;
      setDraftId(id);
    } else {
      await supabase.from('broadcasts').update({ title: title.trim(), body: body.trim(), type, target_type: targetType, target_value: targetValue || null }).eq('id', id);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${env.supabaseUrl}/functions/v1/admin-broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': env.supabaseAnonKey,
      },
      body: JSON.stringify({ broadcast_id: id }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? 'Send failed'); setSending(false); return; }

    setSending(false);
    onSent();
  }

  const needsValue = targetType === 'plan' || targetType === 'org' || targetType === 'user';
  const valuePlaceholder = targetType === 'plan' ? 'Plan slug (e.g. starter)' : targetType === 'org' ? 'Org UUID' : 'User UUID';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111827]">Compose Broadcast</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
              placeholder="Notification title"
              className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={1000}
              placeholder="Message body…"
              className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827] resize-none" />
            <p className="text-[10px] text-[#9CA3AF] text-right mt-1">{body.length}/1000</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Type</label>
              <Dropdown value={type} onChange={setType} options={[
                { value: 'info',    label: 'Info' },
                { value: 'success', label: 'Success' },
                { value: 'warning', label: 'Warning' },
                { value: 'error',   label: 'Error' },
              ]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Target</label>
              <Dropdown value={targetType} onChange={v => { setTargetType(v); setTargetValue(''); }} options={[
                { value: 'all',  label: 'All users' },
                { value: 'plan', label: 'By plan' },
                { value: 'org',  label: 'By org' },
                { value: 'user', label: 'Single user' },
              ]} />
            </div>
          </div>

          {needsValue && (
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">{targetType === 'plan' ? 'Plan Slug' : targetType === 'org' ? 'Org ID' : 'User ID'}</label>
              <input value={targetValue} onChange={e => setTargetValue(e.target.value)}
                placeholder={valuePlaceholder}
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
            </div>
          )}

          {/* Preview pill */}
          <div className="flex items-center gap-2 p-3 bg-[#FAFAF7] rounded-lg">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${TYPE_COLORS[type] ?? ''}`}>{type}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#111827] truncate">{title || 'Notification title'}</p>
              <p className="text-[10px] text-[#6B7280] truncate">{body || 'Message body…'}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {canManage(platformRole) && (
              <button onClick={saveDraft} disabled={saving || sending}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
            )}
            {canManage(platformRole) && (
              <button onClick={sendNow} disabled={saving || sending}
                className="px-4 py-2 text-sm font-medium text-white bg-[#111111] rounded-lg hover:bg-[#6C55E8] transition-colors disabled:opacity-50 flex items-center gap-2">
                {sending && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {sending ? 'Sending…' : 'Send Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function BroadcastPage() {
  const { platformRole } = useAdminAuthStore();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [resending, setResending]   = useState<string | null>(null);
  const [resendErr, setResendErr]   = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(100);
    setBroadcasts((data ?? []) as Broadcast[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resend(bc: Broadcast) {
    if (bc.status === 'sending') return;
    setResending(bc.id); setResendErr('');
    // Reset to draft first
    await supabase.from('broadcasts').update({ status: 'draft' }).eq('id', bc.id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${env.supabaseUrl}/functions/v1/admin-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': env.supabaseAnonKey },
      body: JSON.stringify({ broadcast_id: bc.id }),
    });
    const data = await res.json();
    if (!res.ok) setResendErr(data.error ?? 'Resend failed');
    setResending(null);
    load();
  }

  const drafts = broadcasts.filter(b => b.status === 'draft');
  const sent   = broadcasts.filter(b => b.status !== 'draft');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSent={() => { setShowCompose(false); load(); }} />}

      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Broadcasts</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Send in-app notifications to portal users</p>
          </div>
          {canManage(platformRole) && (
            <button onClick={() => setShowCompose(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#111111] rounded-lg hover:bg-[#6C55E8] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Broadcast
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Broadcasts', value: broadcasts.length },
            { label: 'Sent',             value: sent.filter(b => b.status === 'sent').length },
            { label: 'Drafts',           value: drafts.length },
            { label: 'Failed',           value: broadcasts.filter(b => b.status === 'failed').length },
          ].map(k => (
            <div key={k.label} className="bg-white shadow-sm rounded-xl px-4 py-3">
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-bold text-[#111827] mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tables */}
      <div className="flex-1 overflow-auto px-8 pb-8 space-y-6">
        {resendErr && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{resendErr}</p>}

        {/* Drafts */}
        {drafts.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Drafts</p>
            <div className="bg-white shadow-sm rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    {['Title', 'Type', 'Target', 'Created', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {drafts.map(bc => <BroadcastRow key={bc.id} bc={bc} onResend={resend} resending={resending} canManage={canManage(platformRole)} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">History</p>
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {['Title', 'Type', 'Target', 'Sent Count', 'Sent At', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td></tr>
                ) : sent.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No broadcasts sent yet.</td></tr>
                ) : sent.map(bc => <BroadcastRow key={bc.id} bc={bc} onResend={resend} resending={resending} canManage={canManage(platformRole)} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function BroadcastRow({ bc, onResend, resending, canManage }: {
  bc: Broadcast; onResend: (bc: Broadcast) => void; resending: string | null; canManage: boolean;
}) {
  const targetLabel = bc.target_type === 'all' ? 'All users'
    : bc.target_type === 'plan' ? `Plan: ${bc.target_value ?? ''}`
    : bc.target_type === 'org'  ? `Org: ${(bc.target_value ?? '').slice(0, 8)}…`
    : `User: ${(bc.target_value ?? '').slice(0, 8)}…`;

  return (
    <tr className="hover:bg-[#F9FAFB] transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-[#111827]">{bc.title}</p>
        <p className="text-[10px] text-[#9CA3AF] mt-0.5 line-clamp-1">{bc.body}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${TYPE_COLORS[bc.type] ?? ''}`}>{bc.type}</span>
      </td>
      <td className="px-5 py-3.5 text-xs text-[#374151]">{targetLabel}</td>
      {bc.status !== 'draft' && (
        <>
          <td className="px-5 py-3.5 text-sm text-[#374151] tabular-nums">{bc.sent_count.toLocaleString()}</td>
          <td className="px-5 py-3.5 text-xs text-[#374151]">{bc.sent_at ? formatDate(bc.sent_at) : '—'}</td>
        </>
      )}
      {bc.status === 'draft' && <td className="px-5 py-3.5 text-xs text-[#374151]">{formatDate(bc.created_at)}</td>}
      <td className="px-5 py-3.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${STATUS_COLORS[bc.status] ?? ''}`}>{bc.status}</span>
      </td>
      <td className="px-5 py-3.5">
        {canManage && (bc.status === 'draft' || bc.status === 'failed') && (
          <button onClick={() => onResend(bc)} disabled={resending === bc.id}
            className="text-xs font-medium text-[#6C55E8] hover:underline disabled:opacity-50 flex items-center gap-1">
            {resending === bc.id && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {bc.status === 'draft' ? 'Send' : 'Retry'}
          </button>
        )}
      </td>
    </tr>
  );
}

