import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamService, InvitationDetails } from './team.service';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';

function Spinner() {
  return (
    <div className="w-6 h-6 border-2 border-[#6C55E8] border-t-transparent rounded-full animate-spin mx-auto" />
  );
}

function RoleCap(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();
  const authStatus = useAuthStore((s) => s.status);
  const user       = useAuthStore((s) => s.user);
  const setOrg     = useOrgStore((s) => s.setOrg);

  const [details,  setDetails]  = useState<InvitationDetails | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!token) return;
    teamService.getInvitationDetails(token).then(({ data, error: err }) => {
      if (err || !data) { setError('Invitation not found.'); }
      else setDetails(data);
      setLoading(false);
    });
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError('');
    const { orgId, error: err } = await teamService.acceptInvitation(token);
    if (err) {
      setAccepting(false);
      setError(err);
      return;
    }
    if (orgId) setOrg(orgId, 'active');
    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
  }

  function handleLogin() {
    navigate(`/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`, { replace: true });
  }

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading || authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <Spinner />
      </div>
    );
  }

  // â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="bg-white border border-[#E5E7EB] w-full max-w-md">
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#E5E7EB]">
          <span className="text-lg font-bold text-[#6C55E8]">Moffu</span>
        </div>

        <div className="px-8 py-8">
          {/* â”€â”€ Done state â”€â”€ */}
          {done && (
            <div className="text-center">
              <div className="w-12 h-12 bg-[#EDE9FE] rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-[#111827] mb-1">You are in!</h2>
              <p className="text-sm text-[#6B7280]">Redirecting to your dashboardâ€¦</p>
            </div>
          )}

          {/* â”€â”€ Error state â”€â”€ */}
          {!done && error && !details && (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-[#111827] mb-1">Invitation unavailable</h2>
              <p className="text-sm text-[#6B7280] mb-5">{error}</p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="text-sm font-medium text-[#6C55E8] hover:underline"
              >
                Go to homepage
              </button>
            </div>
          )}

          {/* â”€â”€ Invitation card â”€â”€ */}
          {!done && details && (
            <>
              {details.is_valid ? (
                <>
                  <p className="text-xs text-[#9CA3AF] mb-1">You have been invited by</p>
                  <p className="text-sm font-semibold text-[#111827] mb-4">{details.invited_by}</p>

                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] px-5 py-4 mb-6">
                    <p className="text-base font-bold text-[#111827] mb-0.5">{details.org_name}</p>
                    <p className="text-sm text-[#6B7280]">
                      Role: <span className="font-medium text-[#111827]">{RoleCap(details.role)}</span>
                    </p>
                  </div>

                  {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

                  {authStatus === 'authenticated' ? (
                    <>
                      {/* Check email match */}
                      {user?.email?.toLowerCase() !== details.email.toLowerCase() ? (
                        <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 mb-4">
                          This invitation was sent to <strong>{details.email}</strong>.
                          You are logged in as <strong>{user?.email}</strong>.
                          Please sign in with the correct account to accept.
                        </div>
                      ) : (
                        <button
                          onClick={handleAccept}
                          disabled={accepting}
                          className="w-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold py-3 transition-colors disabled:opacity-50"
                        >
                          {accepting ? 'Acceptingâ€¦' : `Accept invitation as ${RoleCap(details.role)}`}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-[#6B7280]">
                        Log in or create an account with <strong className="text-[#111827]">{details.email}</strong> to accept.
                      </p>
                      <button
                        onClick={handleLogin}
                        className="w-full bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-semibold py-3 transition-colors"
                      >
                        Log in to accept
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#111827] mb-1">Invitation expired or revoked</p>
                  <p className="text-sm text-[#6B7280]">Ask the team owner to send a new invitation.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

