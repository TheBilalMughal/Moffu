import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

function SettingSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#E5E7EB] last:border-0 py-8">
      <div className="max-w-2xl">
        <h3 className="text-sm font-semibold text-[#111827] mb-0.5">{title}</h3>
        <p className="text-xs text-[#9CA3AF] mb-5">{description}</p>
        {children}
      </div>
    </div>
  );
}

export function WebsiteBrandingPage() {
  const { success: toastSuccess, error: toastError } = useToastStore();

  // ── Default logo ──
  const [defaultLogoUrl, setDefaultLogoUrl] = useState('');
  const [uploadingDefault, setUploadingDefault] = useState(false);
  const defaultLogoRef = useRef<HTMLInputElement>(null);

  async function handleDefaultLogoUpload(file: File) {
    setUploadingDefault(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `defaults/platform-default.${ext}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (error) {
      toastError('Upload failed: ' + error.message);
    } else {
      const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
      setDefaultLogoUrl(data.publicUrl + '?t=' + Date.now());
      toastSuccess('Default logo updated');
    }
    setUploadingDefault(false);
  }

  // ── Bulk logo import ──
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  async function handleBulkImport() {
    if (!csvFile) return;
    setImporting(true);
    // Parse CSV: org_ref_id, logo_url
    const text = await csvFile.text();
    const lines = text.trim().split('\n').slice(1); // skip header
    let updated = 0;
    let failed = 0;
    for (const line of lines) {
      const [refId, logoUrl] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      if (!refId || !logoUrl) continue;
      const { error } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('ref_id', refId);
      if (error) failed++; else updated++;
    }
    setImporting(false);
    setCsvFile(null);
    if (failed === 0) {
      toastSuccess(`Bulk import complete — ${updated} logos updated`);
    } else {
      toastError(`Import finished — ${updated} updated, ${failed} failed`);
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h2 className="text-base font-semibold text-[#111827]">Branding</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Default logo and visual identity settings for the platform.</p>
      </div>

      {/* Default logo */}
      <SettingSection
        title="Default client logo"
        description="Shown for any client who hasn't uploaded their own logo. Used in admin tables and future portal surfaces."
      >
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center overflow-hidden flex-shrink-0">
            {defaultLogoUrl ? (
              <img src={defaultLogoUrl} alt="Default logo" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div>
            <input
              ref={defaultLogoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDefaultLogoUpload(f); }}
            />
            <button
              onClick={() => defaultLogoRef.current?.click()}
              disabled={uploadingDefault}
              className="text-sm font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {uploadingDefault ? 'Uploading…' : 'Upload logo'}
            </button>
            {defaultLogoUrl && (
              <button onClick={() => setDefaultLogoUrl('')} className="ml-3 text-sm text-red-500 hover:underline">Remove</button>
            )}
            <p className="text-xs text-[#9CA3AF] mt-1.5">PNG, JPG, WebP or SVG · max 2 MB · recommended 128×128</p>
          </div>
        </div>
      </SettingSection>

      {/* Bulk logo import */}
      <SettingSection
        title="Bulk logo import"
        description="Upload a CSV to assign logos to multiple clients at once. Format: ref_id, logo_url (one row per client, header required)."
      >
        <div className="flex items-center gap-3">
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => csvRef.current?.click()}
            className="text-sm font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-4 py-2 rounded-lg transition-colors"
          >
            {csvFile ? csvFile.name : 'Choose CSV file'}
          </button>
          {csvFile && (
            <button
              onClick={handleBulkImport}
              disabled={importing}
              className="text-sm font-black text-white bg-[#111827] hover:bg-[#1f2937] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importing…' : 'Run import'}
            </button>
          )}
          {csvFile && (
            <button onClick={() => setCsvFile(null)} className="text-sm text-[#9CA3AF] hover:text-[#374151]">Cancel</button>
          )}
        </div>
        <div className="mt-4 bg-[#F8FAF9] rounded-xl border border-[#E5E7EB] px-4 py-3">
          <p className="text-xs font-mono text-[#6B7280]">ref_id,logo_url</p>
          <p className="text-xs font-mono text-[#6B7280]">ORG-00001,https://cdn.example.com/logos/org1.png</p>
          <p className="text-xs font-mono text-[#6B7280]">ORG-00002,https://cdn.example.com/logos/org2.png</p>
        </div>
      </SettingSection>
    </div>
  );
}
