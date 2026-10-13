import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@moffu/ui';
import { useAuthStore } from '../auth.store';

/**
 * Handles the email verification redirect from Supabase.
 * Supabase Auth with PKCE flow handles token exchange automatically via
 * detectSessionInUrl. This page just waits for auth state to settle.
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/onboarding', { replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut && status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h2 className="text-xl font-semibold text-neutral-900">Verification failed</h2>
          <p className="text-sm text-neutral-500">
            The link may have expired or already been used.
          </p>
          <Button variant="outline" onClick={() => navigate('/auth/login')}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-xl border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-neutral-500">Verifying your emailâ€¦</p>
      </div>
    </div>
  );
}

