import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleService } from './google.service';

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code  = searchParams.get('code');
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

    googleService.handleCallback(code, state).then(async ({ error: err }) => {
      if (err) {
        setErrorMsg(err);
        setStatus('error');
        return;
      }
      // Check if this user already has selected locations (returning client)
      const { data: existingLocs } = await googleService.getLocations();
      const alreadySetUp = existingLocs?.some(l => l.is_selected) ?? false;

      if (alreadySetUp) {
        // Returning client — locations already configured, skip picker
        navigate('/settings?google=connected', { replace: true });
        return;
      }

      // New client — fetch locations then show picker
      const { error: fetchErr } = await googleService.fetchLocations();
      if (fetchErr) {
        navigate('/google/connect?fetch_error=1', { replace: true });
      } else {
        navigate('/google/connect', { replace: true });
      }
    });
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#6C55E8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#6B7280]">Connecting Google Business Profile and fetching locations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#F9FAFB]">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 max-w-sm w-full text-center">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-[#111827] mb-1">Connection failed</h2>
        <p className="text-xs text-[#6B7280] mb-5">{errorMsg}</p>
        <button
          onClick={() => navigate('/settings', { replace: true })}
          className="text-sm font-medium text-[#6C55E8] hover:underline"
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}

