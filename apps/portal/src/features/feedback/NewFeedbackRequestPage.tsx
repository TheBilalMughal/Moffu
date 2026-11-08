import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useLocationStore } from '@/features/location/location.store';

export function NewFeedbackRequestPage() {
  const user          = useAuthStore(s => s.user);
  const orgId         = useOrgStore(s => s.orgId);
  const selectedLocId = useLocationStore(s => s.selectedId);

  const [customerName, setCustomerName]   = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [googleUrl, setGoogleUrl]         = useState('');
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [created, setCreated]             = useState<{ id: string; token: string; link: string; email: string | null } | null>(null);
  const [copied, setCopied]               = useState(false);
  const [sendingEmail, setSendingEmail]   = useState(false);
  const [emailSent, setEmailSent]         = useState(false);
  const [emailError, setEmailError]       = useState('');

  const webBase = import.meta.env.VITE_WEB_URL ?? 'https://moffu.vercel.app';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !user) return;
    if (!googleUrl.trim()) { setError('Google review URL is required.'); return; }
    setError('');
    setSaving(true);

    const { data, error: dbErr } = await supabase
      .from('feedback_requests')
      .insert({
        org_id:            orgId,
        user_id:           user.id,
        location_id:       selectedLocId ?? null,
        customer_name:     customerName.trim() || null,
        customer_email:    customerEmail.trim() || null,
        google_review_url: googleUrl.trim(),
        channel:           'manual',
      })
      .select('id, token')
      .single();

    setSaving(false);
    if (dbErr || !data) { setError('Failed to create request. Please try again.'); return; }
    setCreated({
      id:    data.id,
      token: data.token,
      link:  `${webBase}/f/${data.token}`,
      email: customerEmail.trim() || null,
    });
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendEmail() {
    if (!created || !user) return;
    setSendingEmail(true);
    setEmailError('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feedback-send-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ request_id: created.id }),
    });
    setSendingEmail(false);
    if (res.ok) {
      setEmailSent(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setEmailError(body.error ?? 'Failed to send email.');
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="relative min-h-full px-6 py-6 flex items-start justify-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/6 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-[#111827]/4 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 px-4 md:px-8 py-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827] mb-2">Feedback link created</h2>
              <p className="text-sm text-[#6B7280] mb-6">Share this link with your customer. Happy → Google review. Unhappy → private form.</p>

              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl mb-3">
                <span className="flex-1 text-xs text-[#374151] truncate text-left font-mono">{created.link}</span>
                <button onClick={copyLink}
                  className={`flex-shrink-0 text-[11px] font-semibold transition-colors ${copied ? 'text-emerald-600' : 'text-[#6C55E8] hover:text-[#4F46E5]'}`}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Email send */}
              {created.email && (
                <div className="mb-5">
                  {emailSent ? (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 rounded-xl">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                      </svg>
                      <span className="text-xs font-semibold text-emerald-700">Email sent to {created.email}</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={sendEmail}
                        disabled={sendingEmail}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl text-sm font-semibold text-[#374151] hover:bg-white/80 transition-colors disabled:opacity-50"
                      >
                        {sendingEmail ? (
                          <><span className="w-3.5 h-3.5 border-2 border-[#9CA3AF]/30 border-t-[#9CA3AF] rounded-full animate-spin" />Sending…</>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                            </svg>
                            Send via email to {created.email}
                          </>
                        )}
                      </button>
                      {emailError && <p className="text-xs text-red-500 text-center">{emailError}</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setCreated(null); setCustomerName(''); setCustomerEmail(''); setGoogleUrl(''); setEmailSent(false); setEmailError(''); }}
                  className="flex-1 py-2.5 text-sm font-semibold text-[#374151] bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl hover:bg-white/80 transition-colors">
                  New request
                </button>
                <Link to="/feedback"
                  className="flex-1 py-2 text-sm font-semibold text-white bg-[#111827] hover:bg-[#1F2937] rounded-lg transition-colors text-center">
                  View inbox
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-full px-6 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/6 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-56 h-56 rounded-full bg-[#111827]/4 blur-3xl" />
      </div>

      <div className="relative mb-6">
        <Link to="/feedback" className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to inbox
        </Link>
        <h1 className="text-xl font-bold text-[#111827]">New feedback request</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Generate a shareable link. Happy customers go to Google — unhappy ones send private feedback to you.</p>
      </div>

      <form onSubmit={handleSubmit} className="relative max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 divide-y divide-white/60">

          {/* Customer details */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Customer details</p>
              <span className="text-[10px] text-[#D1D5DB] bg-white/60 backdrop-blur-sm border border-white/60 px-1.5 py-0.5 rounded-lg">optional</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Name</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3.5 py-2.5 text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]/40 transition placeholder-[#D1D5DB] text-[#111827]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]/40 transition placeholder-[#D1D5DB] text-[#111827]"
              />
            </div>
          </div>

          {/* Google URL */}
          <div className="px-6 py-5">
            <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1">
              Google Review URL <span className="text-red-400 font-normal normal-case">required</span>
            </label>
            <p className="text-[11px] text-[#9CA3AF] mb-3">Happy customers will be sent here to leave a Google review.</p>
            <input
              type="url"
              required
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              className="w-full px-3.5 py-2.5 text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]/40 transition placeholder-[#D1D5DB] text-[#111827]"
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#111827]/[0.03] flex items-center justify-between gap-4">
            {error
              ? <p className="text-xs text-red-500">{error}</p>
              : <p className="text-[11px] text-[#9CA3AF]">Link expires in 30 days · one use per link</p>
            }
            <button
              type="submit"
              disabled={saving || !googleUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                : 'Create link'
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
