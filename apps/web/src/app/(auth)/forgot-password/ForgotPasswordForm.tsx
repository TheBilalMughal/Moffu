'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#111827] mb-2">Check your email</h2>
        <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-6">
          We sent a password reset link to <strong className="text-[#111827]">{email}</strong>.
        </p>
        <Link href="/login" className="text-sm text-[#0D4C3C] font-semibold hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#374151] mb-1.5">Email</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-3 text-sm border border-[#D1D5DB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827]/15 focus:border-[#111827] transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-60 text-white py-3 rounded-lg text-sm font-semibold transition-colors duration-150">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-[#0D4C3C] font-medium hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
        Back to log in
      </Link>
    </div>
  );
}
