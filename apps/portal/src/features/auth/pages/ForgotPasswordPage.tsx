import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../auth.service';
import { AuthLayout } from '../components/AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await authService.forgotPassword({ email });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-[#EDE9FE] text-[#6C55E8] flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#111827] mb-2">Check your email</h2>
          <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-6">
            We sent a password reset link to <strong className="text-[#111827]">{email}</strong>.
          </p>
          <Link to="/auth/login" className="text-sm text-[#6C55E8] font-semibold hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-[2rem] font-bold text-[#111827] mb-2">Forgot your password?</h1>
        <p className="text-[#6B7280] text-[0.9375rem]">Enter your email and we'll send you a reset link.</p>
      </div>

      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#374151] mb-1.5">Email</label>
            <input
              id="email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 text-sm border border-[#D1D5DB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#111827] hover:bg-[#1F2937] disabled:opacity-60 text-white py-3 rounded-lg text-sm font-semibold transition-colors duration-150">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link to="/auth/login"
          className="flex items-center justify-center gap-1.5 text-sm text-[#6C55E8] font-medium hover:underline">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back to log in
        </Link>
      </div>
    </AuthLayout>
  );
}
