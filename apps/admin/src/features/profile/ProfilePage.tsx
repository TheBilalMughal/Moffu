import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { useToastStore } from '@/lib/toast';

// ── Phone country config ──────────────────────────────────────────────────────

const PHONE_COUNTRIES = [
  { code: 'PK', label: 'Pakistan',  dial: '+92', digits: 10, placeholder: '3001234567' },
  { code: 'US', label: 'USA',       dial: '+1',  digits: 10, placeholder: '2025551234' },
  { code: 'CA', label: 'Canada',    dial: '+1',  digits: 10, placeholder: '4165551234' },
  { code: 'AU', label: 'Australia', dial: '+61', digits: 9,  placeholder: '412345678'  },
] as const;

type CountryCode = typeof PHONE_COUNTRIES[number]['code'];

function getCountryForPhone(full: string | null): CountryCode {
  if (!full) return 'PK';
  if (full.startsWith('+92')) return 'PK';
  if (full.startsWith('+61')) return 'AU';
  if (full.startsWith('+1'))  return 'US';
  return 'PK';
}

function nationalFromFull(full: string | null, dial: string): string {
  if (!full) return '';
  return full.startsWith(dial) ? full.slice(dial.length) : full;
}

function validatePhone(national: string, digits: number): string | null {
  if (!national) return null;
  const stripped = national.replace(/\D/g, '');
  if (stripped.length !== digits) return `Must be exactly ${digits} digits`;
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  displayName: string;
  avatarUrl:   string | null;
  phone:       string | null;
  countryCode: CountryCode;
  national:    string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user } = useAdminAuthStore();
  const toast     = useToastStore();

  // ── Profile state ──
  const [editing,         setEditing]         = useState(false);
  const [saving,          setSaving]           = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState<ProfileData>({
    displayName: '', avatarUrl: null, phone: null, countryCode: 'PK', national: '',
  });
  const [draft, setDraft] = useState<ProfileData>({
    displayName: '', avatarUrl: null, phone: null, countryCode: 'PK', national: '',
  });

  // ── Password state ──
  const [pwEditing,  setPwEditing]  = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);

  // ── Load from DB ──
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name, avatar_url, phone').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const cc   = getCountryForPhone(data.phone);
        const ctry = PHONE_COUNTRIES.find(c => c.code === cc)!;
        const nat  = nationalFromFull(data.phone, ctry.dial);
        const p: ProfileData = {
          displayName: data.display_name ?? '',
          avatarUrl:   data.avatar_url   ?? null,
          phone:       data.phone        ?? null,
          countryCode: cc,
          national:    nat,
        };
        setSaved(p);
        setDraft(p);
      });
  }, [user?.id]);

  // ── Profile actions ──
  function startEdit()  { setDraft({ ...saved }); setEditing(true); }
  function cancelEdit() { setDraft({ ...saved }); setEditing(false); }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    setAvatarUploading(true);
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Upload failed'); setAvatarUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    setSaved(p => ({ ...p, avatarUrl: url }));
    setDraft(p => ({ ...p, avatarUrl: url }));
    toast.success('Photo updated');
    setAvatarUploading(false);
  }

  async function removeAvatar() {
    if (!user?.id) return;
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setSaved(p => ({ ...p, avatarUrl: null }));
    setDraft(p => ({ ...p, avatarUrl: null }));
    toast.success('Photo removed');
  }

  async function saveProfile() {
    if (!user?.id) return;
    if (!draft.displayName.trim()) { toast.error('Name cannot be empty'); return; }
    const country  = PHONE_COUNTRIES.find(c => c.code === draft.countryCode)!;
    const phoneErr = validatePhone(draft.national, country.digits);
    if (draft.national && phoneErr) { toast.error(phoneErr); return; }
    setSaving(true);
    const full = draft.national.trim()
      ? `${country.dial}${draft.national.replace(/\D/g, '')}`
      : null;
    const { error } = await supabase.from('profiles').update({
      display_name: draft.displayName.trim(),
      phone:        full,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Failed to save profile'); return; }
    setSaved({ ...draft, phone: full });
    setEditing(false);
    toast.success('Profile saved');
  }

  // ── Password actions ──
  function startPwEdit()  { setNewPw(''); setConfirmPw(''); setPwEditing(true); }
  function cancelPwEdit() { setNewPw(''); setConfirmPw(''); setPwEditing(false); }

  async function savePassword() {
    if (!newPw)              { toast.error('Enter a new password'); return; }
    if (newPw.length < 8)    { toast.error('Password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewPw(''); setConfirmPw('');
    setPwEditing(false);
    toast.success('Password updated');
  }

  // ── Derived ──
  const country     = PHONE_COUNTRIES.find(c => c.code === (editing ? draft : saved).countryCode)!;
  const phoneError  = validatePhone(draft.national, PHONE_COUNTRIES.find(c => c.code === draft.countryCode)!.digits);
  const initials    = saved.displayName
    ? saved.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email ?? '').slice(0, 2).toUpperCase();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#111111]">My Profile</h1>
          {editing ? (
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
                Cancel
              </button>
              <button onClick={saveProfile} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-[#111111] text-white rounded-lg hover:bg-[#6C55E8] disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <SpinIcon />}
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          ) : (
            <button onClick={startEdit}
              className="px-4 py-2 text-sm font-medium text-[#6C55E8] border border-[#D8CCFF] rounded-lg hover:bg-[#F3F0FF] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit Profile
            </button>
          )}
        </div>

        {/* ── Avatar + name hero card ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {saved.avatarUrl ? (
                <img src={saved.avatarUrl} alt="avatar"
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-[#D8CCFF]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#111111] text-white flex items-center justify-center text-2xl font-bold">
                  {initials}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <SpinIcon className="w-5 h-5 text-white" />
                </div>
              )}
              {editing && (
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#6C55E8] text-white flex items-center justify-center shadow-md hover:bg-[#5A42D1] transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={draft.displayName}
                  onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                  placeholder="Your name"
                  className="w-full text-lg font-semibold text-[#111111] border-b-2 border-[#6C55E8] bg-transparent focus:outline-none pb-0.5"
                />
              ) : (
                <p className="text-lg font-semibold text-[#111111] truncate">{saved.displayName || '—'}</p>
              )}
              <p className="text-sm text-[#6B7280] mt-1 truncate">{user?.email}</p>
              {editing && saved.avatarUrl && (
                <button onClick={removeAvatar} className="mt-2 text-xs text-[#DC2626] hover:underline">
                  Remove photo
                </button>
              )}
              {editing && (
                <p className="mt-1 text-xs text-[#9CA3AF]">JPG, PNG, WebP — max 2 MB</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Phone card ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Phone Number</p>
          {editing ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={draft.countryCode}
                    onChange={e => setDraft(d => ({ ...d, countryCode: e.target.value as CountryCode, national: '' }))}
                    className="appearance-none pl-3 pr-7 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-[#FAFAF7] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8] cursor-pointer">
                    {PHONE_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label} ({c.dial})</option>
                    ))}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </div>
                <input
                  value={draft.national}
                  onChange={e => setDraft(d => ({ ...d, national: e.target.value.replace(/\D/g, '') }))}
                  placeholder={PHONE_COUNTRIES.find(c => c.code === draft.countryCode)!.placeholder}
                  maxLength={PHONE_COUNTRIES.find(c => c.code === draft.countryCode)!.digits + 2}
                  className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 ${
                    draft.national && phoneError ? 'border-[#DC2626]' : 'border-[#E5E7EB] focus:border-[#6C55E8]'
                  }`}
                />
              </div>
              {draft.national && phoneError && <p className="text-xs text-[#DC2626]">{phoneError}</p>}
              {draft.national && !phoneError && (
                <p className="text-xs text-[#9CA3AF]">
                  Stored as {PHONE_COUNTRIES.find(c => c.code === draft.countryCode)!.dial}{draft.national}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#111827]">
              {saved.phone
                ? <><span className="text-[#9CA3AF]">{country.dial}</span> {saved.national}</>
                : <span className="text-[#D1D5DB]">Not set</span>
              }
            </p>
          )}
        </div>

        {/* ── Password card (fully separate) ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-[#111827]">Password</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                {pwEditing ? 'Set a new password for your account' : 'Last changed: unknown'}
              </p>
            </div>
            {!pwEditing && (
              <button onClick={startPwEdit}
                className="px-3 py-1.5 text-xs font-medium text-[#6C55E8] border border-[#D8CCFF] rounded-lg hover:bg-[#F3F0FF] transition-colors flex items-center gap-1.5 flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Change Password
              </button>
            )}
          </div>

          {pwEditing ? (
            <div className="mt-4 space-y-3">
              <PwField label="New password" value={newPw} show={showNew}
                onChange={v => setNewPw(v)} onToggle={() => setShowNew(s => !s)} />
              <PwField label="Confirm new password" value={confirmPw} show={showConf}
                onChange={v => setConfirmPw(v)} onToggle={() => setShowConf(s => !s)} />
              {newPw && newPw.length < 8 && (
                <p className="text-xs text-[#DC2626]">Must be at least 8 characters</p>
              )}
              {newPw && confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-[#DC2626]">Passwords do not match</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={savePassword} disabled={pwSaving || !newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
                  className="px-4 py-2 text-sm font-medium bg-[#111111] text-white rounded-lg hover:bg-[#6C55E8] disabled:opacity-50 transition-colors flex items-center gap-2">
                  {pwSaving && <SpinIcon />}
                  {pwSaving ? 'Updating…' : 'Save Password'}
                </button>
                <button onClick={cancelPwEdit}
                  className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#D1D5DB] tracking-widest">••••••••</p>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SpinIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
  );
}

function PwField({ label, value, show, onChange, onToggle }: {
  label: string; value: string; show: boolean;
  onChange: (v: string) => void; onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#374151] mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-10 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8]"
        />
        <button type="button" onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors">
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
