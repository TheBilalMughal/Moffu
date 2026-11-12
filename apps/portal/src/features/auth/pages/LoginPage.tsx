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
    <div className="min-h-screen bg-[#D8CCFF] flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Nav — matches PortalLanding */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5 max-w-[1200px] mx-auto w-full" style={{ boxSizing: 'border-box' }}>
        <span className="text-[22px] font-black text-[#111827]" style={{ letterSpacing: '-0.03em' }}>Moffu</span>
        <a
          href={env.webUrl}
          className="text-sm font-semibold text-[rgba(17,24,39,0.5)] hover:text-[#111827] transition-colors"
        >
          ← moffu.pro
        </a>
      </nav>

      {/* Content — same centered layout as PortalLanding */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#111827] rounded-lg px-3.5 py-1.5 mb-8">
          <span className="bg-[#6C55E8] text-white font-black uppercase rounded flex-shrink-0" style={{ fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px' }}>New</span>
          <span className="text-xs font-semibold text-white">AI Google Review Management</span>
        </div>

        <h1 className="text-[clamp(2rem,6vw,3rem)] font-black text-[#111827] leading-[1.08] mb-4" style={{ letterSpacing: '-0.03em' }}>
          Sign in to Moffu
        </h1>
        <p className="text-base text-[rgba(17,24,39,0.6)] leading-relaxed mb-10" style={{ maxWidth: 400 }}>
          Continue with Google to access your account and manage your reviews.
        </p>

        {/* Form — inline on purple, no card */}
        <div className="w-full" style={{ maxWidth: 360, textAlign: 'left' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* T&C checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-5 group">
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
                    : 'bg-white border-[#C4B5F4] group-hover:border-[#6C55E8]'
                }`}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-[rgba(17,24,39,0.65)] leading-relaxed">
              I agree to Moffu's{' '}
              <a href="https://www.moffu.pro/terms" target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] hover:underline font-medium">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://www.moffu.pro/privacy" target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] hover:underline font-medium">
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || !agreed}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[rgba(17,24,39,0.12)] rounded-lg px-4 py-3.5 text-sm font-semibold text-[#111827] hover:bg-[#F5F3FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
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

      {/* Footer — same as PortalLanding */}
      <footer className="text-center py-6 text-xs" style={{ color: 'rgba(17,24,39,0.4)' }}>
        © {new Date().getFullYear()} Moffu ·{' '}
        <a href={env.webUrl} style={{ color: 'rgba(17,24,39,0.4)', textDecoration: 'none' }}>moffu.pro</a>
      </footer>
    </div>
  );
}
