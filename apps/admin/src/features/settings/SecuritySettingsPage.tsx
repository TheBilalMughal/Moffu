import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

const BOOL_KEYS = [
  { key: 'require_email_verification', label: 'Require email verification', hint: 'New signups must verify their email before accessing the portal' },
  { key: 'allow_google_signup',        label: 'Allow Google OAuth signup',  hint: 'Customers can sign up / log in with their Google account' },
  { key: 'allow_password_signup',      label: 'Allow password signup',      hint: 'Customers can sign up with email + password' },
];

const TEXT_KEYS = [
  { key: 'allowed_signup_domains',     label: 'Allowed signup domains',    hint: 'Comma-separated list; leave blank to allow any domain  (e.g. moffu.pro, mycompany.com)', placeholder: 'moffu.pro' },
  { key: 'session_duration_hours',     label: 'Session duration (hours)',  hint: 'How long a customer session stays active without activity', placeholder: '168' },
  { key: 'admin_allowed_ips',          label: 'Admin IP allowlist',        hint: 'CIDR ranges allowed to access the admin portal; leave blank to allow all', placeholder: '0.0.0.0/0' },
];

export function SecuritySettingsPage() {
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [boolVals, setBoolVals] = useState<Record<string, boolean>>(
    Object.fromEntries(BOOL_KEYS.map((k) => [k.key, false]))
  );
  const [textVals, setTextVals] = useState<Record<string, string>>(
    Object.fromEntries(TEXT_KEYS.map((k) => [k.key, '']))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const allKeys = [...BOOL_KEYS.map((k) => k.key), ...TEXT_KEYS.map((k) => k.key)];
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', allKeys);

    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

    setBoolVals(Object.fromEntries(BOOL_KEYS.map((k) => [k.key, map[k.key] === 'true'])));
    setTextVals((prev) => {
      const next = { ...prev };
      TEXT_KEYS.forEach((k) => { if (map[k.key] !== undefined) next[k.key] = map[k.key] as string; });
      return next;
    });
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const rows = [
      ...BOOL_KEYS.map((k) => ({ key: k.key, value: String(boolVals[k.key]) })),
      ...TEXT_KEYS.map((k) => ({ key: k.key, value: textVals[k.key] ?? '' })),
    ];
    const { error } = await supabase
      .from('platform_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) toastError(`Save failed: ${error.message}`);
    else toastSuccess('Security settings saved.');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="px-8 py-6 max-w-2xl space-y-5">
        {[...BOOL_KEYS, ...TEXT_KEYS].map((k) => (
          <div key={k.key} className="animate-pulse">
            <div className="h-3 bg-[#E5EAE8] rounded w-40 mb-2" />
            <div className="h-9 bg-[#E5EAE8] rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-8 py-6 max-w-2xl">
      <h2 className="text-base font-semibold text-[#111827] mb-1">Security</h2>
      <p className="text-sm text-[#9CA3AF] mb-6">Authentication and access control settings for the portal.</p>

      {/* Boolean toggles */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl divide-y divide-[#F3F4F6] mb-6">
        {BOOL_KEYS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#111827]">{item.label}</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">{item.hint}</p>
            </div>
            <button
              onClick={() => setBoolVals((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                boolVals[item.key] ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  boolVals[item.key] ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Text fields */}
      <div className="space-y-5 mb-6">
        {TEXT_KEYS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-[#111827] mb-1">{f.label}</label>
            <p className="text-xs text-[#9CA3AF] mb-1.5">{f.hint}</p>
            <input
              type="text"
              value={textVals[f.key] ?? ''}
              onChange={(e) => setTextVals((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] transition-colors"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {saving && (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
        )}
        Save security settings
      </button>
    </div>
  );
}
