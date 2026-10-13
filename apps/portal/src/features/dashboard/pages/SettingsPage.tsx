import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { googleService, type GoogleConnection, type GoogleLocation } from '@/features/google/google.service';
import { Toast, useToast } from '@/components/Toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIMEZONES = Intl.supportedValuesOf('timeZone');

interface Country {
  code: string;
  dial: string;
  name: string;
  flag: string;
  pattern: RegExp;
  placeholder: string;
}

const COUNTRIES: Country[] = [
  { code: 'US', dial: '+1',   name: 'United States',   flag: 'US', pattern: /^\d{10}$/,     placeholder: '(555) 000-0000' },
  { code: 'CA', dial: '+1',   name: 'Canada',           flag: 'CA', pattern: /^\d{10}$/,     placeholder: '(555) 000-0000' },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',   flag: 'GB', pattern: /^\d{10,11}$/,  placeholder: '07700 900000'   },
  { code: 'PK', dial: '+92',  name: 'Pakistan',         flag: 'PK', pattern: /^0?\d{10}$/,   placeholder: '0300 1234567'   },
  { code: 'IN', dial: '+91',  name: 'India',            flag: 'IN', pattern: /^\d{10}$/,     placeholder: '98765 43210'    },
  { code: 'AE', dial: '+971', name: 'UAE',              flag: 'AE', pattern: /^0?\d{9}$/,    placeholder: '050 123 4567'   },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',     flag: 'SA', pattern: /^0?\d{9}$/,    placeholder: '055 123 4567'   },
  { code: 'DE', dial: '+49',  name: 'Germany',          flag: 'DE', pattern: /^\d{6,12}$/,   placeholder: '0151 12345678'  },
  { code: 'FR', dial: '+33',  name: 'France',           flag: 'FR', pattern: /^\d{9,10}$/,   placeholder: '06 12 34 56 78' },
  { code: 'AU', dial: '+61',  name: 'Australia',        flag: 'AU', pattern: /^0?\d{9}$/,    placeholder: '0412 345 678'   },
  { code: 'JP', dial: '+81',  name: 'Japan',            flag: 'JP', pattern: /^0?\d{9,11}$/, placeholder: '090-1234-5678'  },
  { code: 'TR', dial: '+90',  name: 'Turkey',           flag: 'TR', pattern: /^0?\d{10}$/,   placeholder: '0532 123 4567'  },
  { code: 'NL', dial: '+31',  name: 'Netherlands',      flag: 'NL', pattern: /^0?\d{9}$/,    placeholder: '06 12345678'    },
  { code: 'SG', dial: '+65',  name: 'Singapore',        flag: 'SG', pattern: /^\d{8}$/,      placeholder: '8123 4567'      },
  { code: 'MY', dial: '+60',  name: 'Malaysia',         flag: 'MY', pattern: /^0?\d{9,10}$/, placeholder: '012-3456789'    },
  { code: 'ZA', dial: '+27',  name: 'South Africa',     flag: 'ZA', pattern: /^0?\d{9}$/,    placeholder: '082 000 0000'   },
  { code: 'IT', dial: '+39',  name: 'Italy',            flag: 'IT', pattern: /^\d{9,10}$/,   placeholder: '312 345 6789'   },
  { code: 'ES', dial: '+34',  name: 'Spain',            flag: 'ES', pattern: /^\d{9}$/,      placeholder: '612 345 678'    },
  { code: 'EG', dial: '+20',  name: 'Egypt',            flag: 'EG', pattern: /^0?\d{10}$/,   placeholder: '0100 123 4567'  },
  { code: 'NG', dial: '+234', name: 'Nigeria',          flag: 'NG', pattern: /^0?\d{10}$/,   placeholder: '0812 345 6789'  },
  { code: 'KW', dial: '+965', name: 'Kuwait',           flag: 'KW', pattern: /^\d{8}$/,      placeholder: '5000 0000'      },
  { code: 'QA', dial: '+974', name: 'Qatar',            flag: 'QA', pattern: /^\d{8}$/,      placeholder: '5000 0000'      },
  { code: 'BH', dial: '+973', name: 'Bahrain',          flag: 'BH', pattern: /^\d{8}$/,      placeholder: '3600 0000'      },
  { code: 'OM', dial: '+968', name: 'Oman',             flag: 'OM', pattern: /^\d{8}$/,      placeholder: '9000 0000'      },
  { code: 'CN', dial: '+86',  name: 'China',            flag: 'CN', pattern: /^1\d{10}$/,    placeholder: '138 0013 8000'  },
  { code: 'BR', dial: '+55',  name: 'Brazil',           flag: 'BR', pattern: /^\d{10,11}$/,  placeholder: '11 91234-5678'  },
];

function countryFlag(code: string) {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function parseStoredPhone(stored: string): { countryIso: string; national: string } {
  if (!stored) return { countryIso: 'PK', national: '' };
  // sort by longest dial code first to avoid +1 matching +1XX
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (stored.startsWith(c.dial + ' ')) {
      return { countryIso: c.code, national: stored.slice(c.dial.length + 1) };
    }
  }
  return { countryIso: 'PK', national: stored.replace(/^\+\d+\s*/, '') };
}

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
}

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
    CONNECTED:          { label: 'Connected',      cls: 'bg-emerald-50 text-emerald-700' },
    PENDING:            { label: 'Pending',         cls: 'bg-yellow-50 text-yellow-700' },
    REFRESH_FAILED:     { label: 'Token expired',   cls: 'bg-red-50 text-red-700' },
    ATTENTION_REQUIRED: { label: 'Action required', cls: 'bg-orange-50 text-orange-700' },
    REVOKED:            { label: 'Revoked',         cls: 'bg-red-50 text-red-700' },
    DISCONNECTED:       { label: 'Disconnected',    cls: 'bg-[#F3F4F6] text-[#9CA3AF]' },
    ERROR:              { label: 'Error',           cls: 'bg-red-50 text-red-700' },
  };
  const { label, cls } = map[state] ?? { label: state, cls: 'bg-[#F3F4F6] text-[#9CA3AF]' };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${cls}`}>{label}</span>;
}

// ── PhoneInput ────────────────────────────────────────────────────────────────

function PhoneInput({
  countryIso, national, onCountryChange, onNationalChange,
}: {
  countryIso: string;
  national: string;
  onCountryChange: (iso: string) => void;
  onNationalChange: (n: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const country = (COUNTRIES.find(c => c.code === countryIso) ?? COUNTRIES[0]) as Country;
  const filteredCountries = query
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.dial.includes(query))
    : COUNTRIES;

  const isValid = national === '' || country.pattern.test(national.replace(/[\s\-().]/g, ''));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex gap-2" ref={ref}>
      {/* Country picker */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setQuery(''); }}
          className="flex items-center gap-1.5 h-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white text-[#111827] whitespace-nowrap"
        >
          <span className="text-base leading-none">{countryFlag(country.flag)}</span>
          <span className="text-[#374151]">{country.dial}</span>
          <svg className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F3F4F6]">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country..."
                className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0D4C3C]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filteredCountries.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onCountryChange(c.code); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${c.code === countryIso ? 'bg-[#F0F7F5] text-[#0D4C3C] font-medium' : 'text-[#374151] hover:bg-[#F8FAF9]'}`}
                >
                  <span className="text-base leading-none">{countryFlag(c.flag)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[#9CA3AF] text-xs">{c.dial}</span>
                </button>
              ))}
              {filteredCountries.length === 0 && <p className="px-4 py-3 text-sm text-[#9CA3AF]">No match</p>}
            </div>
          </div>
        )}
      </div>
      {/* National number input */}
      <div className="flex-1 relative">
        <input
          type="tel"
          value={national}
          onChange={e => onNationalChange(e.target.value)}
          placeholder={country.placeholder}
          className={`w-full text-sm text-[#111827] border rounded-lg px-4 py-3 focus:outline-none transition-colors bg-white ${
            !isValid && national !== '' ? 'border-red-400 focus:border-red-500' : 'border-[#E5EAE8] focus:border-[#0D4C3C]'
          }`}
        />
        {!isValid && national !== '' && (
          <p className="absolute -bottom-4 left-0 text-[10px] text-red-500">Invalid format for {country.name}</p>
        )}
      </div>
    </div>
  );
}

// ── TimezoneSelect ────────────────────────────────────────────────────────────

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
    : TIMEZONES.slice(0, 60);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="w-full flex items-center justify-between text-sm border border-[#E5EAE8] rounded-xl px-4 py-2.5 text-left focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white text-[#111827]"
      >
        <span className={value ? 'text-[#111827]' : 'text-[#9CA3AF]'}>{value || 'Select timezone...'}</span>
        <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F3F4F6]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search timezone..."
              className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0D4C3C]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map(tz => (
              <button
                key={tz}
                type="button"
                onClick={() => { onChange(tz); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${tz === value ? 'bg-[#F0F7F5] text-[#0D4C3C] font-medium' : 'text-[#374151] hover:bg-[#F8FAF9]'}`}
              >
                {tz}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-[#9CA3AF]">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, show: showToast } = useToast();

  // Google
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Account
  const currentDisplayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [phoneCountry, setPhoneCountry] = useState('PK');
  const [phoneNational, setPhoneNational] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences
  const [timezone, setTimezone] = useState('');
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [origTimezone, setOrigTimezone] = useState('');

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sessions
  const [isOwner, setIsOwner] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [signingOutDevice, setSigningOutDevice] = useState(false);
  const sessionSince = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

  // Export
  const [exporting, setExporting] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    const name = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
    setDisplayName(name);
    supabase.from('profiles').select('phone, timezone').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const stored = (data as { phone?: string | null }).phone ?? '';
        if (stored) {
          const parsed = parseStoredPhone(stored);
          setPhoneCountry(parsed.countryIso);
          setPhoneNational(parsed.national);
        }
        const tz = (data as { timezone?: string | null }).timezone ?? '';
        setTimezone(tz);
        setOrigTimezone(tz);
      }
    });
    // check owner role
    supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()
      .then(({ data }) => setIsOwner(!!data));
  }, [user?.id]);

  async function handleSaveProfile() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSavingProfile(true);
    const dial = COUNTRIES.find(c => c.code === phoneCountry)?.dial ?? '';
    const combined = phoneNational.trim() ? `${dial} ${phoneNational.trim()}` : null;
    const [authRes, profileRes] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: trimmed } }),
      supabase.from('profiles').update({ display_name: trimmed, phone: combined }).eq('id', user!.id),
    ]);
    if (authRes.error) { showToast(authRes.error.message, 'error'); }
    else if (profileRes.error) { showToast(profileRes.error.message, 'error'); }
    else { showToast('Account details updated.', 'success'); }
    setSavingProfile(false);
  }

  async function handleSaveTimezone() {
    setSavingTimezone(true);
    const { error } = await supabase.from('profiles').update({ timezone: timezone || null }).eq('id', user!.id);
    if (error) { showToast(error.message, 'error'); }
    else { setOrigTimezone(timezone); showToast('Timezone saved.', 'success'); }
    setSavingTimezone(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { showToast(error.message, 'error'); }
    else { showToast('Password changed successfully.', 'success'); setNewPassword(''); setConfirmPassword(''); }
    setSavingPassword(false);
  }

  async function handleSignOutDevice() {
    setSigningOutDevice(true);
    await supabase.auth.signOut({ scope: 'local' });
    setSigningOutDevice(false);
    navigate('/auth/login');
  }

  async function handleSignOutAllDevices() {
    setSigningOutAll(true);
    await supabase.auth.signOut({ scope: 'global' });
    setSigningOutAll(false);
    navigate('/auth/login');
  }

  async function handleExport() {
    setExporting(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setExporting(false); return; }

    const [profileRes, reviewsRes, brainRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('brand_brain_profiles').select('*').order('created_at', { ascending: false }),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      profile: profileRes.data,
      reviews: reviewsRes.data ?? [],
      brand_brain: brainRes.data ?? [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moffu-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    showToast('Export downloaded.', 'success');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      showToast('Could not delete account. Please contact support.', 'error');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    navigate('/auth/login');
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
      showToast('Google Business Profile connected successfully.', 'success');
      setSearchParams({}, { replace: true });
    }
  }, []);

  async function handleConnect() {
    setConnectingGoogle(true);
    try {
      const { auth_url, error } = await googleService.startOAuth();
      if (error || !auth_url) { showToast(error ?? 'Could not start Google connection.', 'error'); setConnectingGoogle(false); return; }
      window.location.href = auth_url;
    } catch {
      showToast('Network error — could not reach server.', 'error');
      setConnectingGoogle(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Business Profile? Reviews will no longer sync.')) return;
    setDisconnecting(true);
    const { error } = await googleService.disconnect();
    if (error) { showToast(error, 'error'); } else { showToast('Google Business Profile disconnected.', 'success'); await loadConnection(); }
    setDisconnecting(false);
  }

  async function handleSync() {
    setSyncing(true);
    const { synced, error } = await googleService.syncReviews();
    if (error) { showToast(error, 'error'); } else { showToast(`Synced ${synced} reviews.`, 'success'); await loadConnection(); }
    setSyncing(false);
  }

  async function handleToggleLocation(id: string, current: boolean) {
    await googleService.toggleLocationSelected(id, !current);
    setLocations(prev => prev.map(l => l.id === id ? { ...l, is_selected: !current } : l));
  }

  const isConnected = connection?.state === 'CONNECTED';
  const inputCls = 'w-full text-sm text-[#111827] border border-[#E5EAE8] rounded-lg px-4 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white';

  return (
    <div className="px-8 py-8">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Row 1 — Account + Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Account */}
        <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Account</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Email</label>
              <p className="text-sm text-[#111827] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-4 py-3">{user?.email ?? '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Phone Number</label>
              <PhoneInput
                countryIso={phoneCountry}
                national={phoneNational}
                onCountryChange={setPhoneCountry}
                onNationalChange={setPhoneNational}
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || !displayName.trim()}
              className="mt-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
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
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowNewPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                  <EyeIcon open={showNewPassword} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {savingPassword ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2 — Preferences + Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Preferences */}
        <div className="bg-white rounded-xl border border-[#E5EAE8]">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Preferences</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Timezone</label>
              <TimezoneSelect value={timezone} onChange={setTimezone} />
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">Used for review timestamps and scheduled reports.</p>
            </div>
            <button
              onClick={handleSaveTimezone}
              disabled={savingTimezone || timezone === origTimezone}
              className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {savingTimezone ? 'Saving...' : 'Save timezone'}
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Active Sessions</h2>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#111827]">This device</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Member since {sessionSince}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Active</span>
                {isOwner && (
                  <button
                    onClick={handleSignOutDevice}
                    disabled={signingOutDevice}
                    className="text-xs font-medium text-[#6B7280] hover:text-red-600 border border-[#E5EAE8] px-2.5 py-0.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {signingOutDevice ? 'Logging out...' : 'Logout'}
                  </button>
                )}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={handleSignOutAllDevices}
                disabled={signingOutAll}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                {signingOutAll ? 'Signing out...' : 'Sign out all devices'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integrations */}
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
                    {isConnected && connection?.google_email
                      ? <p className="text-xs text-[#6B7280]">{connection.google_email}</p>
                      : <p className="text-xs text-[#9CA3AF]">Connect to sync reviews automatically</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connection && <StateChip state={connection.state} />}
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <button onClick={handleSync} disabled={syncing}
                        className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors disabled:opacity-50">
                        {syncing ? 'Syncing...' : 'Sync now'}
                      </button>
                      <button onClick={handleDisconnect} disabled={disconnecting}
                        className="text-xs font-medium text-red-600 border border-[#FCA5A5] rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleConnect} disabled={connectingGoogle}
                      className="text-xs font-semibold text-white bg-[#0D4C3C] rounded-lg px-4 py-1.5 hover:bg-[#0a3d30] transition-colors disabled:opacity-50">
                      {connectingGoogle ? 'Redirecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
              {isConnected && locations.length > 0 && (
                <div className="mt-5 border-t border-[#F3F4F6] pt-4">
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-3">Locations to sync</p>
                  <div className="space-y-2">
                    {locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F8FAF9] transition-colors">
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{loc.display_name ?? loc.google_location_name}</p>
                          {loc.address && <p className="text-xs text-[#9CA3AF]">{loc.address}</p>}
                        </div>
                        <button onClick={() => handleToggleLocation(loc.id, loc.is_selected)}
                          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${loc.is_selected ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}
                          role="switch" aria-checked={loc.is_selected}>
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
                <p className="mt-4 text-xs text-[#9CA3AF]">Last synced: {new Date(connection.last_synced_at).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing shortcut */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Billing</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Plan &amp; Usage</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">View your plan, usage and upgrade options.</p>
            </div>
            <Link to="/billing"
              className="text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-1.5 rounded-lg hover:bg-[#E6F2EE] transition-colors">
              Go to Billing &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Data &amp; Privacy</h2>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Export */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Export my data</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Download your profile, reviews and Brand Brain as JSON.</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-1.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {/* Delete account */}
          <div className="border-t border-[#F3F4F6] pt-5">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Delete account</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Permanently delete your account and all data. This cannot be undone.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs font-semibold text-red-600 border border-red-200 px-3.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Delete account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-red-600">Are you absolutely sure?</p>
                <p className="text-xs text-[#6B7280]">All your data — reviews, replies, Brand Brain profiles and team memberships — will be permanently deleted. This action <strong>cannot be undone</strong>.</p>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Type <strong>DELETE</strong> to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 bg-white text-[#111827]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== 'DELETE'}
                    className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Permanently delete my account'}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="text-xs font-medium text-[#6B7280] hover:text-[#374151] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => {}} />}
    </div>
  );
}
