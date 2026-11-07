import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface GoogleCreds {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

const REDIRECT_URI_DEFAULT = 'https://app.moffu.pro/auth/google/callback';

export function GoogleSettingsPage() {
  const toast = useToastStore();

  const [saved, setSaved] = useState<GoogleCreds>({ client_id: '', client_secret: '', redirect_uri: REDIRECT_URI_DEFAULT });
  const [form, setForm]   = useState<GoogleCreds>({ client_id: '', client_secret: '', redirect_uri: REDIRECT_URI_DEFAULT });
  const [editing, setEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['google_client_id', 'google_client_secret', 'google_redirect_uri']);

    if (error) { toast.error('Failed to load settings'); setLoading(false); return; }

    const map: Record<string, string> = {};
    (data ?? []).forEach((r) => { map[r.key] = r.value; });

    const creds: GoogleCreds = {
      client_id:    map['google_client_id']     ?? '',
      client_secret: map['google_client_secret'] ?? '',
      redirect_uri:  map['google_redirect_uri']  ?? REDIRECT_URI_DEFAULT,
    };
    setSaved(creds);
    setForm(creds);
    setLoading(false);
    // If no credentials configured yet, open edit mode immediately
    if (!creds.client_id) setEditing(true);
  }

  async function handleSave() {
    if (!form.client_id.trim())     { toast.error('Client ID is required'); return; }
    if (!form.client_secret.trim()) { toast.error('Client Secret is required'); return; }

    setSaving(true);
    const rows = [
      { key: 'google_client_id',     value: form.client_id.trim() },
      { key: 'google_client_secret', value: form.client_secret.trim() },
      { key: 'google_redirect_uri',  value: form.redirect_uri.trim() },
    ];

    const { error } = await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);

    if (error) { toast.error(error.message); return; }

    setSaved({ ...form });
    setEditing(false);
    setShowSecret(false);
    toast.success('Google credentials saved.');
  }

  function handleCancel() {
    setForm({ ...saved });
    setEditing(false);
    setShowSecret(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[#6C55E8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasCreds = !!saved.client_id;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <GoogleLogo />
              <h1 className="text-lg font-semibold text-[#111827]">Google API</h1>
              {hasCreds && !editing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-[#9CA3AF]">OAuth credentials for Google Business Profile integration.</p>
          </div>
          {hasCreds && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Setup steps */}
        <div className="shadow-sm rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2.5">Setup steps</p>
          <ol className="text-sm text-[#6B7280] space-y-1.5 list-decimal list-inside">
            <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#6C55E8] hover:underline">Google Cloud Console → Credentials</a></li>
            <li>Create an <strong className="text-[#374151]">OAuth 2.0 Client ID</strong> (Web application)</li>
            <li>Add the Redirect URI below to <strong className="text-[#374151]">Authorized redirect URIs</strong></li>
            <li>Enable <strong className="text-[#374151]">My Business Account Management API</strong> and <strong className="text-[#374151]">My Business Business Information API</strong></li>
          </ol>
        </div>

        {editing ? (
          /* ── Edit form ── */
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Client ID</label>
              <input
                type="text"
                value={form.client_id}
                onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                placeholder="123456789-abc.apps.googleusercontent.com"
                className="w-full px-3 py-2.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] font-mono placeholder:font-sans placeholder:text-[#C4CAC8] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.client_secret}
                  onChange={(e) => setForm((p) => ({ ...p, client_secret: e.target.value }))}
                  placeholder="GOCSPX-…"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] font-mono placeholder:font-sans placeholder:text-[#C4CAC8] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                >
                  {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Redirect URI</label>
                <span className="text-xs text-[#9CA3AF]">— paste this into Google Console</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.redirect_uri}
                  onChange={(e) => setForm((p) => ({ ...p, redirect_uri: e.target.value }))}
                  className="flex-1 px-3 py-2.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] font-mono text-[#374151] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(form.redirect_uri); toast.success('Copied to clipboard.'); }}
                  className="px-3 py-2.5 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                  title="Copy to clipboard"
                >
                  <CopyIcon />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#0a3d30] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save credentials'}
              </button>
              {hasCreds && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Read-only view ── */
          <div className="shadow-sm rounded-xl overflow-hidden divide-y divide-[#F3F4F6]">
            <ReadRow label="Client ID"    value={saved.client_id}     mono />
            <ReadRow label="Client Secret" value={saved.client_secret} mono secret />
            <ReadRow label="Redirect URI"  value={saved.redirect_uri}  mono copyable />
          </div>
        )}

        {/* Deploy note */}
        <div className="mt-6 px-4 py-3 shadow-sm rounded-xl text-sm text-[#6B7280]">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1.5">After saving</p>
          Redeploy the Google Edge Functions so they pick up the new values:
          <pre className="mt-1.5 text-xs bg-[#F3F4F6] rounded px-2 py-1 font-mono overflow-x-auto">
            npx supabase functions deploy google-oauth-start --project-ref kgttncfkzdrgswfkkdji{'\n'}
            npx supabase functions deploy google-oauth-callback --project-ref kgttncfkzdrgswfkkdji
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Read-only row ─────────────────────────────────────────────────────────────

function ReadRow({ label, value, mono, secret, copyable }: {
  label: string; value: string; mono?: boolean; secret?: boolean; copyable?: boolean;
}) {
  const toast = useToastStore();
  const [show, setShow] = useState(false);
  const display = secret && !show ? (value ? '••••••••••••••••••' : '—') : (value || '—');

  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide w-28 flex-shrink-0">{label}</span>
      <span className={`flex-1 text-sm text-[#374151] truncate ${mono ? 'font-mono' : ''}`}>{display}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {secret && value && (
          <button onClick={() => setShow((s) => !s)} className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors">
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        {copyable && value && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied to clipboard.'); }}
            className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors"
            title="Copy"
          >
            <CopyIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

