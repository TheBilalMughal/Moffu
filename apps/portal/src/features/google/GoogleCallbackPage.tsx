import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleService } from './google.service';

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setErrorMsg(error === 'access_denied' ? 'You declined Google access.' : `Google error: ${error}`);
      setStatus('error');
      return;
    }

    if (!code || !state) {
      setErrorMsg('Invalid callback — missing code or state.');
      setStatus('error');
      return;
    }

    googleService.handleCallback(code, state).then(({ error: err }) => {
      if (err) {
        setErrorMsg(err);
        setStatus('error');
      } else {
        navigate('/settings?google=connected', { replace: true });
      }
    });
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAF9]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#6B7280]">Connecting Google Business Profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#F8FAF9]">
      <div className="bg-white rounded-xl border border-[#E5EAE8] p-8 max-w-sm w-full text-center">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-[#111827] mb-1">Connection failed</h2>
        <p className="text-xs text-[#6B7280] mb-5">{errorMsg}</p>
        <button
          onClick={() => navigate('/settings', { replace: true })}
          className="text-sm font-medium text-[#0D4C3C] hover:underline"
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}
