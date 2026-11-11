'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

interface Props {
  enabled: boolean;
  label?: string;
  className?: string;
  source?: string;
  portalUrl?: string;
  arrow?: boolean;
}

export function WaitlistButton({
  enabled,
  label = 'Get Started',
  className = '',
  source = 'website',
  portalUrl = '',
  arrow = false,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  if (!enabled) {
    return (
      <a href={`${portalUrl}/auth/signup`} className={className}>
        {label}
        {arrow && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        )}
      </a>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase
      .from('waitlist_entries')
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), source });
    if (err) {
      setError('Something went wrong. Please try again.');
    } else {
      setDone(true);
      setName('');
      setEmail('');
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); setError(''); }}
        className={className}
      >
        {label}
        {arrow && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        )}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-7 pt-7 pb-5 border-b border-[#F3F4F6]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Join the waitlist</h2>
                  <p className="text-sm text-[#6B7280] mt-1">
                    Be the first to know when we're ready for you.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[#9CA3AF] hover:text-[#374151] transition-colors ml-4 flex-shrink-0 mt-0.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-7 py-6">
              {done ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-[#EDE9FF] flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-[#111827] mb-1">You're on the list!</h3>
                  <p className="text-sm text-[#6B7280]">
                    We'll email you as soon as a spot opens up.
                  </p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-5 w-full bg-[#111111] hover:bg-[#6C55E8] text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Sarah Mitchell"
                      className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827]/15 focus:border-[#111827] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Work email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="sarah@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827]/15 focus:border-[#111827] transition-colors"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-500">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#111111] hover:bg-[#6C55E8] disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                  >
                    {loading ? 'Joining…' : 'Join waitlist'}
                  </button>
                  <p className="text-center text-xs text-[#9CA3AF]">
                    No spam. We'll only email you when it's your turn.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
