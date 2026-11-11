'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SUBJECTS = [
  'Getting Started / Setup Help',
  'Brand Brain Configuration',
  'Review Management',
  'Google Integration Issue',
  'Billing and Subscription',
  'Refund Request',
  'Team and Account Access',
  'Bug Report',
  'Feature Request',
  'Sales / Enterprise Inquiry',
  'Other',
];

export function ContactForm() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject) { setError('Please select a subject.'); return; }
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase
      .from('contact_messages')
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), subject, message: message.trim() });
    if (err) {
      setError('Something went wrong. Please try again or email us directly.');
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-xl font-black text-[#111827] mb-2">Message sent!</h2>
        <p className="text-[#6B7280] text-sm mb-6">
          We will get back to you at <strong>{email}</strong> within one business day.
        </p>
        <button
          onClick={() => { setDone(false); setName(''); setEmail(''); setSubject(''); setMessage(''); }}
          className="text-sm font-semibold text-[#6C55E8] hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="cf-name">
            Full name
          </label>
          <input
            id="cf-name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Sarah Mitchell"
            className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="cf-email">
            Email address
          </label>
          <input
            id="cf-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="sarah@example.com"
            className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="cf-subject">
          Subject
        </label>
        <div className="relative">
          <select
            id="cf-subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full appearance-none px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] transition-colors pr-10"
          >
            <option value="">Select a subject...</option>
            {SUBJECTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="cf-message">
          Message
        </label>
        <textarea
          id="cf-message"
          required
          rows={6}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us how we can help..."
          className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#6C55E8] hover:bg-[#5A42D1] disabled:opacity-60 text-white font-bold text-sm py-3.5 rounded-xl transition-colors active:scale-[0.98]"
      >
        {loading ? 'Sending...' : 'Send Message'}
      </button>

      <p className="text-center text-xs text-[#9CA3AF]">
        We reply within one business day.
      </p>
    </form>
  );
}
