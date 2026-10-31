import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useLocationStore } from '@/features/location/location.store';

export function NewFeedbackRequestPage() {
  const user      = useAuthStore(s => s.user);
  const orgId     = useOrgStore(s => s.orgId);
  const selectedLocId = useLocationStore(s => s.selectedId);

  const navigate = useNavigate();

  const [customerName, setCustomerName]   = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [googleUrl, setGoogleUrl]         = useState('');
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [created, setCreated]             = useState<{ token: string; link: string } | null>(null);
  const [copied, setCopied]               = useState(false);

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
        org_id:           orgId,
        user_id:          user.id,
        location_id:      selectedLocId ?? null,
        customer_name:    customerName.trim() || null,
        customer_email:   customerEmail.trim() || null,
        google_review_url: googleUrl.trim(),
        channel:          'manual',
      })
      .select('token')
      .single();

    setSaving(false);
    if (dbErr || !data) { setError('Failed to create request. Please try again.'); return; }
    setCreated({ token: data.token, link: `${webBase}/f/${data.token}` });
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="relative min-h-full px-6 py-6 flex items-start justify-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#0D4C3C]/6 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md mt-12">
          <div className="overflow-hidden rounded-2xl border border-[#E5EAE8] bg-white/80 backdrop-blur-md shadow-sm px-8 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111827] mb-2">Feedback link created</h2>
            <p className="text-sm text-[#6B7280] mb-6">Share this link with your customer. They'll see the happy/unhappy choice.</p>

            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F8FAF9] border border-[#E5EAE8] rounded-xl mb-4">
              <span className="flex-1 text-xs text-[#374151] truncate text-left font-mono">{created.link}</span>
              <button onClick={copyLink}
                className="flex-shrink-0 text-[11px] font-semibold text-[#0D4C3C] hover:underline transition-colors">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setCreated(null); setCustomerName(''); setCustomerEmail(''); setGoogleUrl(''); }}
                className="flex-1 py-2.5 text-sm font-semibold text-[#374151] border border-[#E5EAE8] rounded-xl hover:bg-[#F8FAF9] transition-colors">
                New request
              </button>
              <Link to="/feedback"
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0D4C3C] rounded-xl hover:bg-[#083F32] transition-colors text-center">
                View inbox
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-6 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#0D4C3C]/6 blur-3xl" />
      </div>

      <div className="relative mb-6">
        <Link to="/feedback" className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to inbox
        </Link>
        <h1 className="text-xl font-bold text-[#111827]">New feedback request</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Generate a link to send to a customer. Happy → Google review. Unhappy → private form.</p>
      </div>

      <form onSubmit={handleSubmit} className="relative max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-[#E5EAE8] bg-white/80 backdrop-blur-md shadow-sm divide-y divide-[#F3F4F6]">

          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Customer details <span className="text-[#D1D5DB] font-normal normal-case">(optional)</span></p>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Name</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3.5 py-2.5 text-sm border border-[#E5EAE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition placeholder-[#D1D5DB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-[#E5EAE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition placeholder-[#D1D5DB]"
              />
            </div>
          </div>

          <div className="px-6 py-5">
            <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1.5">
              Google Review URL <span className="text-red-400">*</span>
            </label>
            <p className="text-[11px] text-[#9CA3AF] mb-3">Paste your Google Business review page link. Happy customers go here.</p>
            <input
              type="url"
              required
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              className="w-full px-3.5 py-2.5 text-sm border border-[#E5EAE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition placeholder-[#D1D5DB]"
            />
          </div>

          <div className="px-6 py-4 bg-[#F8FAF9]/60 flex items-center justify-between gap-4">
            {error && <p className="text-xs text-red-500">{error}</p>}
            {!error && <p className="text-[11px] text-[#9CA3AF]">Link expires in 30 days</p>}
            <button
              type="submit"
              disabled={saving || !googleUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0D4C3C] text-white text-sm font-semibold rounded-xl hover:bg-[#083F32] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating…' : 'Create link'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
