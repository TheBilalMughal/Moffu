import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useOrgStore } from '@/features/onboarding/org.store';
import { env } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  subject: string | null;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  total_contacts: number;
  sent_at: string | null;
  created_at: string;
}

interface Contact { name: string; email: string }

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-[#F3F4F6] text-[#374151]',
  scheduled: 'bg-[#EFF6FF] text-[#1D4ED8]',
  sending:   'bg-[#FFFBEB] text-[#B45309]',
  sent:      'bg-[#F0FDF4] text-[#15803D]',
  failed:    'bg-[#FEF2F2] text-[#DC2626]',
  paused:    'bg-[#F3F4F6] text-[#6B7280]',
};

const CHANNEL_COLORS: Record<string, string> = {
  email:    'bg-[#EFF6FF] text-[#1D4ED8]',
  sms:      'bg-[#F0FDF4] text-[#15803D]',
  whatsapp: 'bg-[#ECFDF5] text-[#059669]',
};

function pct(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Step components ────────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0 ${
      done   ? 'bg-[#111827] text-white' :
      active ? 'bg-[#111827] text-white ring-4 ring-[#EDE9FE]' :
               'bg-[#F3F4F6] text-[#9CA3AF]'
    }`}>
      {done ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> : n}
    </div>
  );
}

// ── Create Campaign Modal ──────────────────────────────────────────────────────

interface CreateModalProps { orgId: string; orgName: string; onClose: () => void; onCreated: () => void; }

function CreateCampaignModal({ orgId, orgName, onClose, onCreated }: CreateModalProps) {
  const [step, setStep] = useState(1);
  const [name,      setName]      = useState('');
  const [fromName,  setFromName]  = useState(orgName);
  const [replyTo,   setReplyTo]   = useState('');
  const [reviewLink, setReviewLink] = useState('');
  const [contacts,  setContacts]  = useState<Contact[]>([{ name: '', email: '' }]);
  const [csvErr,    setCsvErr]    = useState('');
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState(
    `Hi {{name}},\n\nThank you for choosing ${orgName}! We'd love to hear about your experience.\n\nCould you take a moment to leave us a review? Your feedback means the world to us.\n\n{{review_link}}\n\nThank you!`
  );
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt,  setScheduledAt]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [sending,  setSending]  = useState(false);
  const [err,      setErr]      = useState('');
  const [draftId,  setDraftId]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const STEPS = ['Setup', 'Contacts', 'Message', 'Schedule'];

  function insertToken(token: string) {
    const t = `{{${token}}}`;
    setBody(b => b + t);
  }

  function addContactRow() { setContacts(c => [...c, { name: '', email: '' }]); }
  function removeContact(i: number) { setContacts(c => c.filter((_, idx) => idx !== i)); }
  function updateContact(i: number, field: 'name' | 'email', val: string) {
    setContacts(c => c.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').filter(Boolean);
    const parsed: Contact[] = [];
    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 2 && cols[1]?.includes('@')) {
        parsed.push({ name: cols[0] ?? '', email: cols[1] ?? '' });
      } else if (cols.length >= 1 && cols[0]?.includes('@')) {
        parsed.push({ name: '', email: cols[0] ?? '' });
      }
    }
    return parsed;
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Enforce size limit (500 KB) and content-type before reading
    if (file.size > 500 * 1024) {
      setCsvErr('File too large. Maximum size is 500 KB.');
      return;
    }
    const allowed = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(csv|txt)$/i)) {
      setCsvErr('Invalid file type. Please upload a .csv or .txt file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) { setCsvErr('No valid rows found. Expected: name,email or email per row.'); return; }
      setCsvErr('');
      setContacts(prev => {
        const existing = prev.filter(c => c.email.trim());
        return [...existing, ...parsed];
      });
    };
    reader.readAsText(file);
  }

  const validContacts = contacts.filter(c => c.email.includes('@'));

  async function saveDraft(): Promise<string | null> {
    const payload = {
      org_id:       orgId,
      name:         name.trim(),
      channel:      'email',
      from_name:    fromName.trim(),
      reply_to:     replyTo.trim() || null,
      review_link:  reviewLink.trim() || null,
      subject:      subject.trim(),
      body:         body.trim(),
      status:       'draft',
      total_contacts: validContacts.length,
      scheduled_at: scheduleType === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    if (draftId) {
      await supabase.from('campaigns').update(payload).eq('id', draftId);
      // re-sync contacts
      await supabase.from('campaign_contacts').delete().eq('campaign_id', draftId).eq('status', 'pending');
      if (validContacts.length) {
        await supabase.from('campaign_contacts').insert(
          validContacts.map(c => ({ campaign_id: draftId, org_id: orgId, name: c.name, email: c.email }))
        );
      }
      return draftId;
    } else {
      const { data, error } = await supabase.from('campaigns').insert(payload).select('id').single();
      if (error || !data) { setErr(error?.message ?? 'Save failed'); return null; }
      if (validContacts.length) {
        await supabase.from('campaign_contacts').insert(
          validContacts.map(c => ({ campaign_id: data.id, org_id: orgId, name: c.name, email: c.email }))
        );
      }
      setDraftId(data.id);
      return data.id;
    }
  }

  async function handleSaveDraft() {
    if (!name.trim()) { setErr('Campaign name required.'); return; }
    setSaving(true); setErr('');
    await saveDraft();
    setSaving(false);
    onCreated();
  }

  async function handleSend() {
    if (!name.trim()) { setErr('Campaign name required.'); return; }
    if (!subject.trim()) { setErr('Email subject required.'); return; }
    if (!validContacts.length) { setErr('Add at least one valid contact.'); return; }
    setSending(true); setErr('');
    const id = await saveDraft();
    if (!id) { setSending(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${env.supabaseUrl}/functions/v1/send-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': env.supabaseAnonKey },
      body: JSON.stringify({ campaign_id: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 402) {
        setErr(`Plan limit reached: ${data.error} Go to Billing to upgrade your plan.`);
      } else {
        setErr(data.error ?? 'Send failed');
      }
      setSending(false);
      return;
    }
    setSending(false);
    onCreated();
  }

  function canNext() {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return validContacts.length > 0;
    if (step === 3) return subject.trim().length > 0 && body.trim().length > 0;
    return true;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-[#111827]">New Campaign</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex-shrink-0">
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-2">
                  <StepDot n={i + 1} active={step === i + 1} done={step > i + 1} />
                  <span className={`text-xs font-medium ${step === i + 1 ? 'text-[#6C55E8]' : step > i + 1 ? 'text-[#6B7280]' : 'text-[#D1D5DB]'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`mx-3 h-px w-8 ${step > i + 1 ? 'bg-[#111827]' : 'bg-[#E5E7EB]'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{err}</p>}

          {/* Step 1: Setup */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Campaign Name <span className="text-red-400">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Feedback Drive"
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Channel</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-2 border-[#6C55E8] rounded-lg bg-[#EDE9FE] flex-1">
                    <svg className="w-4 h-4 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    <span className="text-sm font-medium text-[#6C55E8]">Email</span>
                  </div>
                  {['SMS', 'WhatsApp'].map(ch => (
                    <div key={ch} className="flex items-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg flex-1 opacity-50 cursor-not-allowed">
                      <span className="text-sm text-[#9CA3AF]">{ch}</span>
                      <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded ml-auto">Soon</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">From Name</label>
                  <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder={orgName}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Reply-To Email <span className="text-[#9CA3AF]">(optional)</span></label>
                  <input value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="you@yourbusiness.com"
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Google Review Link <span className="text-[#9CA3AF]">(optional — auto-detected if blank)</span></label>
                <input value={reviewLink} onChange={e => setReviewLink(e.target.value)} placeholder="https://g.page/r/YOUR_PLACE_ID/review"
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
              </div>
            </div>
          )}

          {/* Step 2: Contacts */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">Add Contacts</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{validContacts.length} valid contact{validContacts.length !== 1 ? 's' : ''} added</p>
                </div>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#6C55E8] border border-[#6C55E8] px-3 py-1.5 rounded-lg hover:bg-[#EDE9FE] transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Upload CSV
                  </button>
                  <button onClick={addContactRow}
                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#111827] px-3 py-1.5 rounded-lg hover:bg-[#6C55E8] transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add Row
                  </button>
                </div>
              </div>

              {csvErr && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{csvErr}</p>}

              <div className="text-[10px] text-[#9CA3AF] bg-[#F9FAFB] rounded-lg px-3 py-2">
                CSV format: <span className="font-mono">name,email</span> per row, or just <span className="font-mono">email</span>. First row can be a header — it will be skipped if it contains "email".
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={c.name} onChange={e => updateContact(i, 'name', e.target.value)}
                      placeholder="Name (optional)"
                      className="flex-1 px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
                    <input value={c.email} onChange={e => updateContact(i, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827] ${
                        c.email && !c.email.includes('@') ? 'border-red-300' : 'border-[#E5E7EB]'
                      }`} />
                    <button onClick={() => removeContact(i)}
                      className="text-[#9CA3AF] hover:text-red-500 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Message */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Email Subject <span className="text-red-400">*</span></label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="We'd love your feedback!"
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#374151]">Message Body <span className="text-red-400">*</span></label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#9CA3AF]">Insert token:</span>
                    {['name', 'business_name', 'review_link'].map(t => (
                      <button key={t} onClick={() => insertToken(t)}
                        className="text-[10px] font-mono font-medium bg-[#EFF6FF] text-[#1D4ED8] px-1.5 py-0.5 rounded hover:bg-[#DBEAFE] transition-colors">
                        {`{{${t}}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={9}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827] resize-none font-mono" />
              </div>
              {/* Preview */}
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Preview</p>
                  <p className="text-xs font-medium text-[#374151] mt-0.5">Subject: {subject || '—'}</p>
                </div>
                <div className="px-3 py-3 text-xs text-[#374151] whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                  {body
                    .replace('{{name}}', 'John')
                    .replace('{{business_name}}', orgName)
                    .replace('{{review_link}}', '[Review Link]')
                  }
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'now',   label: 'Send Now',     sub: 'Emails go out immediately' },
                  { val: 'later', label: 'Schedule',     sub: 'Pick a date and time' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setScheduleType(opt.val as 'now' | 'later')}
                    className={`text-left p-4 rounded-xl border-2 transition-colors ${scheduleType === opt.val ? 'border-[#6C55E8] bg-[#EDE9FE]' : 'border-[#E5E7EB] hover:border-[#9CA3AF]'}`}>
                    <p className={`text-sm font-semibold ${scheduleType === opt.val ? 'text-[#6C55E8]' : 'text-[#111827]'}`}>{opt.label}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {scheduleType === 'later' && (
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Schedule Date & Time</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 text-[#111827]" />
                </div>
              )}

              {/* Summary */}
              <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Review Summary</p>
                {[
                  ['Campaign', name],
                  ['Channel', 'Email'],
                  ['From', `${fromName}`],
                  ['Contacts', `${validContacts.length} recipients`],
                  ['Subject', subject],
                  ['Schedule', scheduleType === 'now' ? 'Send immediately' : (scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Not set')],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-[10px] text-[#9CA3AF] w-20 flex-shrink-0 mt-0.5">{k}</span>
                    <span className="text-xs text-[#111827] font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between flex-shrink-0 gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
                Back
              </button>
            )}
            {step < 4 && (
              <button onClick={() => { setErr(''); setStep(s => s + 1); }} disabled={!canNext()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#111827] rounded-lg hover:bg-[#6C55E8] transition-colors disabled:opacity-40">
                Next
              </button>
            )}
            {step === 4 && (
              <>
                <button onClick={handleSaveDraft} disabled={saving || sending}
                  className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={handleSend} disabled={saving || sending}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#111827] rounded-lg hover:bg-[#6C55E8] transition-colors disabled:opacity-50 flex items-center gap-2">
                  {sending && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {sending ? 'Sending…' : scheduleType === 'later' ? 'Schedule' : 'Send Now'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface EmailQuota { used: number; limit: number | null; }

export function CampaignsPage() {
  const orgId = useOrgStore(s => s.orgId);
  const [orgName,   setOrgName]   = useState('Your Business');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [quota,     setQuota]     = useState<EmailQuota | null>(null);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ data: orgData }, { data }, { data: usedCount }] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', orgId).single(),
      supabase.from('campaigns')
        .select('id,name,channel,status,subject,sent_count,opened_count,clicked_count,total_contacts,sent_at,created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase.rpc('count_org_campaign_emails_this_month', { p_org_id: orgId, p_month_start: monthStart }),
    ]);
    if (orgData?.name) setOrgName(orgData.name);
    setCampaigns((data ?? []) as Campaign[]);
    // Fetch entitlement limit for current user's plan
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .single();
      if (sub) {
        const { data: ent } = await supabase
          .from('plan_entitlements')
          .select('value_type, limit_value')
          .eq('plan_id', sub.plan_id)
          .eq('key', 'campaign_emails')
          .single();
        if (ent) {
          setQuota({
            used: typeof usedCount === 'number' ? usedCount : 0,
            limit: ent.value_type === 'UNLIMITED' ? null : (ent.limit_value ?? 0),
          });
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [orgId]);

  const totalSent    = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + c.sent_count, 0);
  const totalOpened  = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + c.opened_count, 0);
  const totalClicked = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + c.clicked_count, 0);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#111827]/5 blur-3xl" aria-hidden="true"/>
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/4 blur-3xl" aria-hidden="true"/>

      {showCreate && orgId && (
        <CreateCampaignModal
          orgId={orgId} orgName={orgName}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 px-4 md:px-8 py-4 flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Review Request Campaigns</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Ask customers to leave a review via email</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#111827] rounded-lg hover:bg-[#6C55E8] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New Campaign
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">

      {/* Email quota bar */}
      {quota !== null && (
        <div className="relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 px-5 py-3.5 mb-4 flex items-center gap-4">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/3 via-transparent to-transparent pointer-events-none rounded-2xl" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#374151]">Email quota this month</span>
              <span className={`text-xs font-semibold tabular-nums ${
                quota.limit !== null && quota.used >= quota.limit ? 'text-red-600' :
                quota.limit !== null && quota.used / quota.limit >= 0.8 ? 'text-amber-600' :
                'text-[#6B7280]'
              }`}>
                {quota.limit === null ? `${quota.used} sent · Unlimited` : `${quota.used} / ${quota.limit}`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
              {quota.limit === null ? (
                <div className="h-full w-full bg-[#EDE9FE] rounded-full" />
              ) : (
                <div className={`h-full rounded-full transition-all ${
                  quota.used >= quota.limit ? 'bg-red-500' :
                  quota.used / quota.limit >= 0.8 ? 'bg-amber-400' :
                  'bg-[#111827]'
                }`} style={{ width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` }} />
              )}
            </div>
          </div>
          {quota.limit !== null && quota.used >= quota.limit && (
            <Link to="/plan" className="text-xs font-semibold text-white bg-[#111827] px-3 py-1.5 rounded-lg hover:bg-[#6C55E8] transition-colors flex-shrink-0">
              Upgrade
            </Link>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Campaigns',    value: campaigns.length,                  color: 'text-[#111827]' },
          { label: 'Emails Sent',  value: totalSent.toLocaleString(),         color: 'text-[#1D4ED8]' },
          { label: 'Opened',       value: pct(totalOpened, totalSent),        color: 'text-[#6C55E8]' },
          { label: 'Clicked',      value: pct(totalClicked, totalSent),       color: 'text-[#B45309]' },
        ].map(k => (
          <div key={k.label} className="relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/3 via-transparent to-transparent pointer-events-none rounded-2xl" />
            <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {['Campaign', 'Channel', 'Status', 'Contacts', 'Sent', 'Open Rate', 'Click Rate', 'Date', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F9FAFB]">
            {loading ? (
              <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-[#EDE9FE] rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <p className="text-sm font-medium text-[#374151]">No campaigns yet</p>
                    <p className="text-xs text-[#9CA3AF]">Send review requests to your customers and grow your rating</p>
                    <button onClick={() => setShowCreate(true)}
                      className="mt-1 px-4 py-2 text-sm font-medium text-white bg-[#111827] rounded-lg hover:bg-[#6C55E8] transition-colors">
                      Create your first campaign
                    </button>
                  </div>
                </td>
              </tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                <td className="px-5 py-3.5">
                  <Link to={`/campaigns/${c.id}`} className="font-medium text-[#111827] hover:text-[#6C55E8] hover:underline">
                    {c.name}
                  </Link>
                  {c.subject && <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate max-w-[160px]">{c.subject}</p>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${CHANNEL_COLORS[c.channel] ?? ''}`}>{c.channel}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                </td>
                <td className="px-5 py-3.5 text-[#374151]">{c.total_contacts}</td>
                <td className="px-5 py-3.5 font-medium text-[#111827]">{c.sent_count}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-1.5 bg-[#111827] rounded-full" style={{ width: c.sent_count ? `${Math.min((c.opened_count / c.sent_count) * 100, 100)}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-[#374151] tabular-nums">{pct(c.opened_count, c.sent_count)}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-1.5 bg-[#B45309] rounded-full" style={{ width: c.sent_count ? `${Math.min((c.clicked_count / c.sent_count) * 100, 100)}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-[#374151] tabular-nums">{pct(c.clicked_count, c.sent_count)}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-[#6B7280] whitespace-nowrap">{fmtDate(c.created_at)}</td>
                <td className="px-5 py-3.5">
                  <Link to={`/campaigns/${c.id}`} className="text-xs font-medium text-[#6C55E8] hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>{/* end scrollable */}
    </div>
  );
}
