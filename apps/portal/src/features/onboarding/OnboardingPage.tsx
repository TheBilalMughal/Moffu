import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { onboardingService, slugify, detectTimezone, type Country } from './onboarding.service';
import { useOrgStore } from './org.store';
import { googleService } from '@/features/google/google.service';

const TOTAL_STEPS = 4;

// â”€â”€ Step indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const done    = n < current;
        const active  = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-semibold transition-colors ${
                done   ? 'bg-[#111827] text-white' :
                active ? 'bg-[#111827] text-white' :
                         'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}
            >
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </div>
            {n < TOTAL_STEPS && (
              <div className={`h-px w-8 ${done ? 'bg-[#111827]' : 'bg-[#E5E7EB]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€ Shared â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#374151] mb-1">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6C55E8] focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] ${props.className ?? ''}`}
    />
  );
}

function PrimaryBtn({
  children, onClick, loading, disabled,
}: { children: React.ReactNode; onClick?: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full py-2.5 px-4 bg-[#111827] text-white text-sm font-medium rounded-xl hover:bg-[#6C55E8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
    >
      Skip for now
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

// â”€â”€ Step 1: Create Organization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Step1({
  onDone,
}: {
  onDone: (orgId: string) => void;
}) {
  const [name, setName]     = useState('');
  const [slug, setSlug]     = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setSlug(slugify(val) || val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Organization name is required.'); return; }
    if (slug.length < 2) { setError('Slug must be at least 2 characters.'); return; }
    setError('');
    setLoading(true);
    const { orgId, error: err } = await onboardingService.createOrganization(name.trim(), slug);
    setLoading(false);
    if (err) { setError(err); return; }
    onDone(orgId!);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-[#111827] mb-1">Create your organization</h1>
      <p className="text-sm text-[#6B7280] mb-6">This is your business workspace. You can invite team members later.</p>

      <div className="space-y-4">
        <div>
          <Label>Organization name</Label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Acme Hospitality"
            autoFocus
          />
        </div>

        <div>
          <Label>URL slug</Label>
          <div className="flex items-center border border-[#D1D5DB] rounded-xl focus-within:ring-1 focus-within:ring-[#6C55E8] focus-within:border-[#6C55E8] bg-white overflow-hidden">
            <span className="px-3 py-2 text-xs text-[#9CA3AF] bg-[#F9FAFB] border-r border-[#D1D5DB] select-none whitespace-nowrap">
              moffu.app/
            </span>
            <input
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="acme-hospitality"
              className="flex-1 px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none bg-white"
            />
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">Lowercase letters, numbers and hyphens only.</p>
        </div>

        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={handleSubmit} loading={loading} disabled={!name.trim() || slug.length < 2}>
          Continue
        </PrimaryBtn>
      </div>
    </div>
  );
}

// â”€â”€ Step 2: Country & Timezone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Step2({
  orgId,
  onDone,
}: {
  orgId: string;
  onDone: () => void;
}) {
  const [countries, setCountries]   = useState<Country[]>([]);
  const [countryId, setCountryId]   = useState('');
  const [timezone, setTimezone]     = useState(detectTimezone);
  const [allTz]                     = useState(() => {
    try { return Intl.supportedValuesOf('timeZone'); }
    catch { return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Australia/Sydney']; }
  });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onboardingService.getCountries().then(setCountries);
  }, []);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    const { error: err } = await onboardingService.updateOrgLocation(
      orgId,
      countryId || undefined,
      timezone || undefined,
    );
    setLoading(false);
    if (err) { setError(err); return; }
    onDone();
  }

  async function handleSkip() {
    onDone();
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-[#111827] mb-1">Your business location</h1>
      <p className="text-sm text-[#6B7280] mb-6">Used for scheduling, reports, and billing. You can change this later in Settings.</p>

      <div className="space-y-4">
        <div>
          <Label>Country</Label>
          <select
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              const c = countries.find((x) => x.id === e.target.value);
              if (c?.default_tz) setTimezone(c.default_tz);
            }}
            className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#6C55E8] focus:border-[#6C55E8]"
          >
            <option value="">Select a countryâ€¦</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Timezone</Label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#6C55E8] focus:border-[#6C55E8]"
          >
            {allTz.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <p className="text-xs text-[#9CA3AF] mt-1">Auto-detected from your browser.</p>
        </div>

        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={handleSubmit} loading={loading}>Save and continue</PrimaryBtn>
        <SkipBtn onClick={handleSkip} />
      </div>
    </div>
  );
}

// â”€â”€ Step 3: Connect Google â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Step3({
  onDone,
  connected,
}: {
  onDone: () => void;
  connected: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleConnect() {
    setError('');
    setLoading(true);
    sessionStorage.setItem('onboarding_in_progress', '1');
    const { auth_url, error: err } = await googleService.startOAuth();
    setLoading(false);
    if (err || !auth_url) {
      sessionStorage.removeItem('onboarding_in_progress');
      setError(err ?? 'Failed to start Google sign-in.');
      return;
    }
    window.location.href = auth_url;
  }

  if (connected) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-[#111827] mb-1">Google Business Profile connected</h1>
        <p className="text-sm text-[#6B7280] mb-6">Your account is connected. You can select which locations to track in the next step.</p>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] mb-6">
          <div className="w-8 h-8 rounded-xl bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-[#065F46] font-medium">Google Business Profile connected successfully</p>
        </div>

        <PrimaryBtn onClick={onDone}>Continue</PrimaryBtn>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-[#111827] mb-1">Connect Google Business Profile</h1>
      <p className="text-sm text-[#6B7280] mb-6">
        Connect to start syncing your reviews and publishing AI-generated replies directly from Moffu.
      </p>

      <div className="space-y-3 mb-6">
        {[
          'Sync reviews automatically from all your locations',
          'Publish approved replies directly to Google',
          'Track response rate and review trends',
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-xl bg-[#ECFDF5] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-2.5 h-2.5 text-[#059669]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-[#374151]">{item}</p>
          </div>
        ))}
      </div>

      {error && <ErrorMsg msg={error} />}

      <div className="space-y-2">
        <PrimaryBtn onClick={handleConnect} loading={loading}>
          Connect Google Business Profile
        </PrimaryBtn>
        <SkipBtn onClick={onDone} />
      </div>
    </div>
  );
}

// â”€â”€ Step 4: Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Step4({
  orgId,
  googleConnected,
}: {
  orgId: string;
  googleConnected: boolean;
}) {
  const navigate   = useNavigate();
  const { setOrg } = useOrgStore();
  const [loading, setLoading] = useState(false);

  async function handleDone() {
    setLoading(true);
    await onboardingService.completeOnboarding(orgId);
    setOrg(orgId, 'active');
    navigate('/dashboard', { replace: true });
  }

  const items = [
    { label: 'Organization created', done: true },
    { label: 'Location set', done: true },
    { label: 'Google Business Profile', done: googleConnected, note: googleConnected ? undefined : 'Connect anytime from Settings' },
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold text-[#111827] mb-1">You're all set</h1>
      <p className="text-sm text-[#6B7280] mb-6">Your workspace is ready. You can finish setting up at any time from your dashboard.</p>

      <div className="space-y-3 mb-8">
        {items.map(({ label, done, note }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#111827]' : 'bg-[#E5E7EB]'}`}>
              {done ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
              )}
            </div>
            <div>
              <span className="text-sm text-[#111827]">{label}</span>
              {note && <span className="text-xs text-[#9CA3AF] ml-2">{note}</span>}
            </div>
          </div>
        ))}
      </div>

      <PrimaryBtn onClick={handleDone} loading={loading}>
        Go to dashboard
      </PrimaryBtn>
    </div>
  );
}

// â”€â”€ OnboardingPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const googleConnected = searchParams.get('connected') === '1';

  const [step, setStep]                 = useState(1);
  const [orgId, setOrgId]               = useState<string | null>(null);
  const [googleDone, setGoogleDone]     = useState(googleConnected);
  const hasAdvancedToGoogle = useRef(false);

  // If returning from Google OAuth, jump to step 3
  useEffect(() => {
    if (googleConnected && !hasAdvancedToGoogle.current) {
      hasAdvancedToGoogle.current = true;
      const savedOrgId = sessionStorage.getItem('onboarding_org_id');
      if (savedOrgId) {
        setOrgId(savedOrgId);
        setStep(3);
      }
    }
  }, [googleConnected]);

  function handleStep1Done(id: string) {
    setOrgId(id);
    sessionStorage.setItem('onboarding_org_id', id);
    setStep(2);
  }

  function handleStep2Done() {
    setStep(3);
  }

  function handleStep3Done() {
    setGoogleDone(googleConnected);
    setStep(4);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-xl font-bold text-[#6C55E8] tracking-tight">moffu</span>
      </div>

      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xl p-8">
        <StepIndicator current={step} />

        {step === 1 && (
          <Step1 onDone={handleStep1Done} />
        )}

        {step === 2 && orgId && (
          <Step2 orgId={orgId} onDone={handleStep2Done} />
        )}

        {step === 3 && (
          <Step3 onDone={handleStep3Done} connected={googleConnected} />
        )}

        {step === 4 && orgId && (
          <Step4 orgId={orgId} googleConnected={googleDone} />
        )}
      </div>

      <p className="mt-6 text-xs text-[#9CA3AF]">
        Step {step} of {TOTAL_STEPS}
      </p>
    </div>
  );
}

