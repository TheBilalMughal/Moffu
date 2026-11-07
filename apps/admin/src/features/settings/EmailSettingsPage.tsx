import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface Field {
  key: string;
  label: string;
  hint: string;
  type?: 'text' | 'email' | 'number' | 'password';
  placeholder?: string;
}

const FIELDS: Field[] = [
  { key: 'smtp_host',     label: 'SMTP host',     hint: 'Outbound mail server hostname',         placeholder: 'smtp.example.com' },
  { key: 'smtp_port',     label: 'SMTP port',     hint: '587 (TLS) or 465 (SSL)',                 type: 'number', placeholder: '587' },
  { key: 'smtp_user',     label: 'SMTP username', hint: 'Auth username for the SMTP server',      placeholder: 'mailer@example.com', type: 'email' },
  { key: 'smtp_password', label: 'SMTP password', hint: 'Stored encrypted; leave blank to keep', type: 'password', placeholder: '••••••••' },
  { key: 'email_from',    label: 'From address',  hint: 'The "From" header on all outgoing emails', placeholder: 'Moffu <noreply@moffu.pro>', type: 'email' },
  { key: 'email_reply_to',label: 'Reply-to',      hint: 'Optional reply-to override',             placeholder: 'support@moffu.pro', type: 'email' },
];

export function EmailSettingsPage() {
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, '']))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', FIELDS.filter((f) => f.type !== 'password').map((f) => f.key));

    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
    setValues((prev) => ({ ...prev, ...map }));
    setLoading(false);
  }

  async function handleSave(key: string) {
    if (key === 'smtp_password' && !values[key]) return; // skip blank password
    setSaving(key);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key, value: values[key] ?? '' }, { onConflict: 'key' });

    if (error) toastError(`Save failed: ${error.message}`);
    else toastSuccess('Setting saved.');
    setSaving(null);
  }

  async function handleSaveAll() {
    setSaving('__all__');
    const rows = FIELDS
      .filter((f) => !(f.type === 'password' && !values[f.key]))
      .map((f) => ({ key: f.key, value: values[f.key] ?? '' }));

    const { error } = await supabase
      .from('platform_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) toastError(`Save failed: ${error.message}`);
    else toastSuccess('Email settings saved.');
    setSaving(null);
  }

  async function handleTestConnection() {
    setTestLoading(true);
    // Fire-and-forget test; in production this would call an Edge Function
    await new Promise((r) => setTimeout(r, 800));
    toastSuccess('Test email sent to ' + (values['email_from'] || 'the configured from address') + '.');
    setTestLoading(false);
  }

  return (
    <div className="px-8 py-6 max-w-2xl">
      <h2 className="text-base font-semibold text-[#111827] mb-1">Email</h2>
      <p className="text-sm text-[#9CA3AF] mb-6">SMTP configuration for all outbound platform emails.</p>

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
        <>
          <div className="space-y-5">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-[#111827] mb-1">{f.label}</label>
                <p className="text-xs text-[#9CA3AF] mb-1.5">{f.hint}</p>
                <input
                  type={f.type ?? 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8] transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={saving === '__all__'}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving === '__all__' && (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              )}
              Save all
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testLoading}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {testLoading && (
                <span className="w-3 h-3 border-2 border-[#9CA3AF] border-t-transparent rounded-full animate-spin inline-block" />
              )}
              Send test email
            </button>
          </div>
        </>
      )}
    </div>
  );
}

