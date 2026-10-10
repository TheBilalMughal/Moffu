import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { googleService, type GoogleLocation } from '@/features/google/google.service';

// Free plan location limit — paid plan limits are TBD
const FREE_PLAN_LOCATION_LIMIT = 1;

type OnboardingStage = 'connect' | 'select' | 'syncing' | 'done';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] px-6 py-5">
      <p className="text-sm text-[#6B7280] font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

function OnboardingModal({ initialStage, onComplete }: {
  initialStage: OnboardingStage;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<OnboardingStage>(initialStage);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const syncStarted = useRef(false);

  // Load locations when entering select stage
  useEffect(() => {
    if (stage !== 'select') return;
    setLocLoading(true);
    googleService.getLocations().then(({ data, error: err }) => {
      setLocLoading(false);
      if (err) { setError(err); return; }
      setLocations(data ?? []);
    });
  }, [stage]);

  // Run sync with animated progress bar
  useEffect(() => {
    if (stage !== 'syncing' || syncStarted.current) return;
    syncStarted.current = true;

    googleService.syncReviews();

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      if (progress >= 95) {
        setSyncProgress(95);
        clearInterval(interval);
        // Finish after a short delay
        setTimeout(() => {
          setSyncProgress(100);
          setTimeout(() => setStage('done'), 400);
        }, 800);
        return;
      }
      setSyncProgress(progress);
    }, 300);

    return () => clearInterval(interval);
  }, [stage]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    const { auth_url, error: err } = await googleService.startOAuth();
    setConnecting(false);
    if (err) { setError(err); return; }
    if (auth_url) window.location.href = auth_url;
  }

  async function handleConfirm() {
    if (!selectedId) return;
    setError(null);
    setConfirming(true);
    // Deselect all others, select the chosen one
    for (const loc of locations) {
      const { error: err } = await googleService.toggleLocationSelected(loc.id, loc.id === selectedId);
      if (err) { setError(err); setConfirming(false); return; }
    }
    setConfirming(false);
    syncStarted.current = false;
    setStage('syncing');
  }

  async function handleClose() {
    // Only mark onboarding complete on the final done stage
    if (stage === 'done') {
      await supabase.auth.updateUser({ data: { onboarding_completed: true } });
    }
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl border border-[#E5EAE8] shadow-xl w-full max-w-lg mx-4 relative overflow-hidden">

        {/* X button — not shown on connect (forced) or syncing stages */}
        {stage !== 'connect' && stage !== 'syncing' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#374151] transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Stage: Connect GBP */}
        {stage === 'connect' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F2EE] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111827] mb-2">Connect your Google Business Profile</h2>
            <p className="text-sm text-[#6B7280] mb-7 max-w-xs mx-auto">
              Give Moffu access to your locations so you can manage and respond to reviews.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
            )}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-3 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-60 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {connecting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
                </svg>
              )}
              {connecting ? 'Opening Google…' : 'Connect with Google'}
            </button>
          </div>
        )}

        {/* Stage: Select location */}
        {stage === 'select' && (
          <div className="p-6">
            <div className="mb-5 pr-8">
              <h2 className="text-lg font-bold text-[#111827] mb-1">Select your location</h2>
              <p className="text-sm text-[#6B7280]">
                Choose the location you want to manage. You can add more later by upgrading your plan.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
            )}

            {locLoading ? (
              <div className="py-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : locations.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#6B7280]">No locations found on your Google account.</div>
            ) : (
              <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
                {locations.map((loc) => {
                  const isSelected = selectedId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedId(loc.id)}
                      disabled={!isSelected && selectedId !== null && locations.indexOf(loc) >= FREE_PLAN_LOCATION_LIMIT}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                        isSelected
                          ? 'border-[#0D4C3C] bg-[#E6F2EE]'
                          : 'border-[#E5EAE8] bg-white hover:bg-[#F8FAF9]'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-[#0D4C3C] bg-[#0D4C3C]' : 'border-[#D1D5DB]'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {loc.display_name ?? loc.google_location_name}
                        </p>
                        {loc.address && (
                          <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{loc.address}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={!selectedId || confirming}
                className="bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {confirming && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {confirming ? 'Setting up…' : 'Confirm & Sync'}
              </button>
            </div>
          </div>
        )}

        {/* Stage: Syncing */}
        {stage === 'syncing' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F2EE] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#0D4C3C] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111827] mb-2">Syncing your reviews…</h2>
            <p className="text-sm text-[#6B7280] mb-6">This only takes a moment.</p>
            <div className="w-full bg-[#E5EAE8] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#0D4C3C] h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#9CA3AF] mt-2">{Math.round(syncProgress)}%</p>
          </div>
        )}

        {/* Stage: Done */}
        {stage === 'done' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F2EE] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111827] mb-2">You're all set!</h2>
            <p className="text-sm text-[#6B7280] mb-7 max-w-xs mx-auto">
              Your reviews are synced and ready. Start responding with AI-powered replies.
            </p>
            <button
              onClick={handleClose}
              className="bg-[#0D4C3C] hover:bg-[#083F32] text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Let's go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stepParam = searchParams.get('step');

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('connect');

  useEffect(() => {
    if (!user) return;
    const onboardingDone = user.user_metadata?.onboarding_completed;
    if (onboardingDone) return;

    // Clean URL param if present
    if (stepParam === 'select') {
      navigate('/dashboard', { replace: true });
    }

    // Determine correct stage based on GBP state in DB
    async function resolveStage() {
      const { data: conn } = await googleService.getConnection();

      if (!conn) {
        // No GBP connection at all — start from connect
        setOnboardingStage('connect');
        setShowOnboarding(true);
        return;
      }

      // GBP connected — check if any location is selected
      const { data: locs } = await googleService.getLocations();
      const hasSelected = locs?.some((l) => l.is_selected) ?? false;

      if (!hasSelected) {
        // Connected but no location selected — skip to select
        setOnboardingStage('select');
        setShowOnboarding(true);
      } else {
        // Connected + location selected — auto-complete onboarding
        await supabase.auth.updateUser({ data: { onboarding_completed: true } });
      }
    }

    resolveStage();
  }, [user, stepParam]);

  function handleOnboardingComplete() {
    setShowOnboarding(false);
  }

  return (
    <div className="px-8 py-8">
      {showOnboarding && (
        <OnboardingModal
          initialStage={onboardingStage}
          onComplete={handleOnboardingComplete}
        />
      )}

      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Overview</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Your review performance at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Reviews" value="—" sub="Connect Google to see data" />
        <StatCard label="Avg. Rating" value="—" sub="Connect Google to see data" />
        <StatCard label="Pending Reply" value="—" sub="Connect Google to see data" />
        <StatCard label="Replied" value="—" sub="Connect Google to see data" />
      </div>

      {/* Empty state CTA */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] px-8 py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#111827] mb-1">No reviews yet</h2>
        <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-5">
          Connect your Google Business Profile to start seeing and responding to reviews.
        </p>
        <Link
          to="/reviews"
          className="inline-flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Go to Reviews
        </Link>
      </div>
    </div>
  );
}
