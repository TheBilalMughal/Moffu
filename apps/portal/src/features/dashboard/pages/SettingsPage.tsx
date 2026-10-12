import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { googleService, type GoogleConnection, type GoogleLocation } from '@/features/google/google.service';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function StateChip({ state }: { state: GoogleConnection['state'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    CONNECTED:         { label: 'Connected',        cls: 'bg-emerald-50 text-emerald-700' },
    PENDING:           { label: 'Pending',           cls: 'bg-yellow-50 text-yellow-700' },
    REFRESH_FAILED:    { label: 'Token expired',     cls: 'bg-red-50 text-red-700' },
    ATTENTION_REQUIRED:{ label: 'Action required',   cls: 'bg-orange-50 text-orange-700' },
    REVOKED:           { label: 'Revoked',           cls: 'bg-red-50 text-red-700' },
    DISCONNECTED:      { label: 'Disconnected',      cls: 'bg-[#F3F4F6] text-[#9CA3AF]' },
    ERROR:             { label: 'Error',             cls: 'bg-red-50 text-red-700' },
  };
  const { label, cls } = map[state] ?? { label: state, cls: 'bg-[#F3F4F6] text-[#9CA3AF]' };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${cls}`}>{label}</span>;
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Profile edit state
  const currentDisplayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sync displayName when user loads
  useEffect(() => {
    const name = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
    setDisplayName(name);
  }, [user?.id]);

  async function handleSaveProfile() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSavingProfile(true);
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (error) { setErrorMsg(error.message); }
    else { setSuccessMsg('Display name updated.'); }
    setSavingProfile(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setErrorMsg('Passwords do not match.'); return; }
    setSavingPassword(true);
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setErrorMsg(error.message); }
    else { setSuccessMsg('Password changed successfully.'); setNewPassword(''); setConfirmPassword(''); }
    setSavingPassword(false);
  }

  async function loadConnection() {
    setConnLoading(true);
    const [{ data: conn }, { data: locs }] = await Promise.all([
      googleService.getConnection(),
      googleService.getLocations(),
    ]);
    setConnection(conn ?? null);
    setLocations(locs ?? []);
    setConnLoading(false);
  }

  useEffect(() => {
    loadConnection();

    if (searchParams.get('google') === 'connected') {
      setSuccessMsg('Google Business Profile connected successfully.');
      setSearchParams({}, { replace: true });
    }
  }, []);

  async function handleConnect() {
    setConnectingGoogle(true);
    setErrorMsg('');
    try {
      const { auth_url, error } = await googleService.startOAuth();
      if (error || !auth_url) {
        setErrorMsg(error ?? 'Could not start Google connection.');
        setConnectingGoogle(false);
        return;
      }
      window.location.href = auth_url;
    } catch {
      setErrorMsg('Network error — could not reach server.');
      setConnectingGoogle(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Business Profile? Reviews will no longer sync.')) return;
    setDisconnecting(true);
    const { error } = await googleService.disconnect();
    if (error) {
      setErrorMsg(error);
    } else {
      setSuccessMsg('Google Business Profile disconnected.');
      await loadConnection();
    }
    setDisconnecting(false);
  }

  async function handleSync() {
    setSyncing(true);
    setErrorMsg('');
    const { synced, error } = await googleService.syncReviews();
    if (error) {
      setErrorMsg(error);
    } else {
      setSuccessMsg(`Synced ${synced} reviews.`);
      await loadConnection();
    }
    setSyncing(false);
  }

  async function handleToggleLocation(id: string, current: boolean) {
    await googleService.toggleLocationSelected(id, !current);
    setLocations((prev) => prev.map((l) => l.id === id ? { ...l, is_selected: !current } : l));
  }

  const isConnected = connection?.state === 'CONNECTED';

  return (
    <div className="px-8 py-8">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your account and preferences.</p>
      </div>

      {successMsg && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-4 text-emerald-600 hover:text-emerald-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {errorMsg}
          <button onClick={() => setErrorMsg('')} className="ml-4 text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Account */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Account</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Email</label>
            <p className="text-sm text-[#111827] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-4 py-3">{user?.email ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Display Name</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="flex-1 text-sm text-[#111827] border border-[#E5EAE8] rounded-lg px-4 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white"
              />
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !displayName.trim() || displayName.trim() === currentDisplayName}
                className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-4 py-3 rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Change Password</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full text-sm text-[#111827] border border-[#E5EAE8] rounded-lg px-4 py-3 pr-10 focus:outline-none focus:border-[#0D4C3C] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
              >
                {showNewPassword
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full text-sm text-[#111827] border border-[#E5EAE8] rounded-lg px-4 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
          >
            {savingPassword ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Google Business Profile */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Integrations</h2>
        </div>
        <div className="px-6 py-5">
          {connLoading ? (
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-[#F3F4F6] rounded w-40" />
                <div className="h-2.5 bg-[#F3F4F6] rounded w-56" />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-[#E5EAE8] flex items-center justify-center bg-white">
                    <GoogleIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Google Business Profile</p>
                    {isConnected && connection?.google_email ? (
                      <p className="text-xs text-[#6B7280]">{connection.google_email}</p>
                    ) : (
                      <p className="text-xs text-[#9CA3AF]">Connect to sync reviews automatically</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connection && <StateChip state={connection.state} />}
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors disabled:opacity-50"
                      >
                        {syncing ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="text-xs font-medium text-red-600 border border-[#FCA5A5] rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnect}
                      disabled={connectingGoogle}
                      className="text-xs font-semibold text-white bg-[#0D4C3C] rounded-lg px-4 py-1.5 hover:bg-[#0a3d30] transition-colors disabled:opacity-50"
                    >
                      {connectingGoogle ? 'Redirecting…' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {/* Locations */}
              {isConnected && locations.length > 0 && (
                <div className="mt-5 border-t border-[#F3F4F6] pt-4">
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">Locations to sync</p>
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F8FAF9] transition-colors">
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{loc.display_name ?? loc.google_location_name}</p>
                          {loc.address && <p className="text-xs text-[#9CA3AF]">{loc.address}</p>}
                        </div>
                        <button
                          onClick={() => handleToggleLocation(loc.id, loc.is_selected)}
                          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${loc.is_selected ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}
                          role="switch"
                          aria-checked={loc.is_selected}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${loc.is_selected ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isConnected && locations.length === 0 && (
                <div className="mt-4 border-t border-[#F3F4F6] pt-4">
                  <p className="text-xs text-[#9CA3AF]">No locations found on this Google account. Make sure your Business Profile is verified.</p>
                </div>
              )}

              {isConnected && connection?.last_synced_at && (
                <p className="mt-4 text-xs text-[#9CA3AF]">
                  Last synced: {new Date(connection.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Billing</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Plan &amp; Usage</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">View your plan, usage and upgrade options.</p>
            </div>
            <Link
              to="/billing"
              className="text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-1.5 rounded-lg hover:bg-[#E6F2EE] transition-colors"
            >
              Go to Billing →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
