import { useState } from 'react';
import { authService } from '../auth.service';
import { env } from '@/lib/env';

export function LoginPage() {
  const [loading, setLoading]   = useState(false);
  const [agreed, setAgreed]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleGoogle() {
    if (!agreed) return;
    setError(null);
    setLoading(true);
    const { error: err } = await authService.loginWithGoogle();
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-5">
        <a href={env.webUrl} className="flex items-center">
          <img src="/images/logo.png" alt="Moffu" className="h-7 w-auto" />
        </a>
        <a
          href={env.webUrl}
          className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back to Moffu
        </a>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[2.5rem] font-black text-[#111827] leading-tight mb-2">
            Sign in
          </h1>
          <p className="text-[#6B7280] text-[0.9375rem] mb-8">
            Sign in or create your Moffu account.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* T&C checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-6 group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  agreed
                    ? 'bg-[#6C55E8] border-[#6C55E8]'
                    : 'bg-white border-[#D1D5DB] group-hover:border-[#6C55E8]'
                }`}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-[#6B7280] leading-relaxed">
              I agree to Moffu's{' '}
              <a href={`${env.webUrl}/terms`} target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] hover:underline font-medium">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href={`${env.webUrl}/privacy`} target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] hover:underline font-medium">
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || !agreed}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#D1D5DB] rounded-lg px-4 py-3.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#9CA3AF] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>
        </div>
      </main>
    </div>
  );
}
