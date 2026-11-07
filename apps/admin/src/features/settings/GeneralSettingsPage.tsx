import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface Field {
  key: string;
  label: string;
  hint: string;
  type?: 'text' | 'email' | 'url';
}

const FIELDS: Field[] = [
  { key: 'platform_name',      label: 'Platform name',       hint: 'Internal display name shown in the admin panel',          type: 'text' },
  { key: 'support_email',      label: 'Support email',        hint: 'Default reply-to for platform emails',                   type: 'email' },
  { key: 'contact_sales_email',label: 'Contact sales email',  hint: 'Shown on "Custom pricing" plan CTA in the portal',       type: 'email' },
  { key: 'terms_url',          label: 'Terms of service URL', hint: 'Linked in the portal signup and billing flows',          type: 'url' },
  { key: 'privacy_url',        label: 'Privacy policy URL',   hint: 'Linked in the portal signup and privacy request flows',  type: 'url' },
  { key: 'docs_url',           label: 'Docs URL',             hint: 'Linked in help / support surfaces',                      type: 'url' },
];

export function GeneralSettingsPage() {
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, '']))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // which key is saving

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', FIELDS.map((f) => f.key));

    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
    setValues((prev) => ({ ...prev, ...map }));
    setLoading(false);
  }

  async function handleSave(key: string) {
    setSaving(key);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key, value: values[key] ?? '' }, { onConflict: 'key' });

    if (error) toastError(`Save failed: ${error.message}`);
    else toastSuccess('Setting saved.');
    setSaving(null);
  }

  return (
    <div className="px-8 py-6 max-w-2xl">
      <h2 className="text-base font-semibold text-[#111827] mb-1">General</h2>
      <p className="text-sm text-[#9CA3AF] mb-6">Platform-wide identity and link settings.</p>

      {loading ? (
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="animate-pulse">
              <div className="h-3 bg-[#E5E7EB] rounded w-32 mb-2" />
              <div className="h-9 bg-[#E5E7EB] rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-[#111827] mb-1">{f.label}</label>
              <p className="text-xs text-[#9CA3AF] mb-1.5">{f.hint}</p>
              <div className="flex gap-2">
                <input
                  type={f.type ?? 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(f.key)}
                  placeholder={f.type === 'url' ? 'https://' : ''}
                  className="flex-1 px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8] transition-colors"
                />
                <button
                  onClick={() => handleSave(f.key)}
                  disabled={saving === f.key}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                >
                  {saving === f.key && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  )}
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

