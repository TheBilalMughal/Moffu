import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuthService } from '../auth.service';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await adminAuthService.login({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    const { error: err } = await adminAuthService.forgotPassword(forgotEmail.trim());
    setForgotLoading(false);
    if (err) { setForgotError(err.message); return; }
    setForgotSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAF9] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#0D4C3C] flex items-center justify-center">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-[#111827]">Moffu</p>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest mt-0.5">Admin</p>
          </div>
        </div>

        <div className="bg-white border border-[#E5EAE8] rounded-xl p-8">

          {!forgotMode ? (
            <>
              <h1 className="text-lg font-bold text-[#111827] mb-1">Internal access only</h1>
              <p className="text-sm text-[#9CA3AF] mb-6">Platform team sign in.</p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-3 py-2.5 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] disabled:opacity-50"
                    placeholder="admin@example.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                      className="text-xs text-[#0D4C3C] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#0D4C3C]"
                  />
                  <span className="text-sm text-[#374151]">Remember me</span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-2.5 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold transition-colors disabled:opacity-50 mt-1"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(null); }}
                className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to sign in
              </button>

              <h1 className="text-lg font-bold text-[#111827] mb-1">Reset password</h1>
              <p className="text-sm text-[#9CA3AF] mb-6">Enter your email and we'll send a reset link.</p>

              {forgotSent ? (
                <div className="px-4 py-4 bg-[#E6F2EE] border border-[#A7D7C5] text-sm text-[#0D4C3C]">
                  Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
                </div>
              ) : (
                <form onSubmit={handleForgot} noValidate className="space-y-4">
                  {forgotError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">
                      {forgotError}
                    </div>
                  )}
                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1.5">
                      Email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotLoading}
                      className="w-full px-3 py-2.5 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] disabled:opacity-50"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail}
                    className="w-full py-2.5 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
