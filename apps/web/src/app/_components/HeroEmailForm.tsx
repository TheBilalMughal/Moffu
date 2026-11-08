'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function HeroEmailForm({ portalUrl }: { portalUrl: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const trimmed = email.trim().toLowerCase();
    const name = trimmed.split('@')[0] ?? trimmed;
    const { error: err } = await supabase
      .from('waitlist_entries')
      .insert({ name, email: trimmed, source: 'hero' });
    if (err) {
      setError('Something went wrong. Please try again.');
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-xl px-6 py-4 w-full max-w-lg">
        <svg className="w-5 h-5 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
        </svg>
        <p className="text-sm font-semibold text-[#111827]">You're on the list! We'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-center bg-white rounded-xl w-full overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 flex-1 px-5">
        <svg className="w-5 h-5 text-[#111827]/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 py-4 sm:py-5 text-base font-medium text-[#111827] placeholder:text-[#111827]/35 bg-transparent outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-500 px-5 pb-2 sm:px-3 sm:pb-0">{error}</p>}
      <div className="p-2 pt-0 sm:pt-2">
        <style>{`@keyframes btnBounce{0%,100%{transform:translateY(0) rotate(0deg)}30%{transform:translateY(-6px) rotate(-2deg)}60%{transform:translateY(-2px) rotate(1deg)}}.btn-bounce:hover{animation:btnBounce 0.45s ease}`}</style>
        <button
          type="submit"
          disabled={loading}
          className={`btn-bounce w-full sm:w-auto bg-[#111827] text-base font-black px-7 py-3.5 rounded-lg tracking-tight whitespace-nowrap disabled:opacity-60 inline-block transition-colors duration-200 ${email.includes('@') ? 'text-[#D8CCFF]' : 'text-white'}`}
        >
          {loading ? '…' : 'Join Waitlist →'}
        </button>
      </div>
    </form>
  );
}
