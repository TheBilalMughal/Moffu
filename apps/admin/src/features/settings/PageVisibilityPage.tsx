import { useEffect, useMemo, useState } from 'react';
import { PORTAL_PAGES } from '@moffu/types';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';
import { useAdminAuthStore } from '@/features/auth/auth.store';

interface VisibilityRow {
  page_key: string;
  is_visible: boolean;
}

export function PageVisibilityPage() {
  const toast = useToastStore();
  const user = useAdminAuthStore(state => state.user);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('portal_page_visibility')
      .select('page_key, is_visible')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(error.message);
        else {
          const values = Object.fromEntries((data ?? []).map(row => [row.page_key, row.is_visible])) as Record<string, boolean>;
          setVisibility(values);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof PORTAL_PAGES>();
    for (const page of PORTAL_PAGES) {
      const pages = grouped.get(page.section) ?? [];
      pages.push(page);
      grouped.set(page.section, pages);
    }
    return [...grouped.entries()];
  }, []);

  async function setPageVisibility(pageKey: string, nextVisible: boolean) {
    if (!user || savingKey) return;
    const visibleCount = PORTAL_PAGES.filter(page => visibility[page.key] !== false).length;
    if (!nextVisible && visibleCount <= 1) {
      toast.error('At least one client portal page must stay visible.');
      return;
    }

    const previous = visibility[pageKey] !== false;
    setSavingKey(pageKey);
    setVisibility(current => ({ ...current, [pageKey]: nextVisible }));

    const { error } = await supabase
      .from('portal_page_visibility')
      .upsert({ page_key: pageKey, is_visible: nextVisible, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'page_key' });

    if (error) {
      setVisibility(current => ({ ...current, [pageKey]: previous }));
      toast.error(error.message);
      setSavingKey(null);
      return;
    }

    const { error: auditError } = await supabase.from('audit_events').insert({
      actor_type: 'platform_admin',
      actor_user_id: user.id,
      action: 'portal_page_visibility_updated',
      resource_type: 'portal_page',
      resource_id: pageKey,
      metadata: { is_visible: nextVisible },
    });
    if (auditError) toast.error('Visibility saved, but the audit record could not be written.');
    else toast.success(`${PORTAL_PAGES.find(page => page.key === pageKey)?.label ?? 'Page'} is now ${nextVisible ? 'visible' : 'hidden'}.`);
    setSavingKey(null);
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6C55E8] border-t-transparent" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-7 md:px-9">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6C55E8]">Client Portal</p>
          <h1 className="text-xl font-semibold text-[#111827]">Page Visibility</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">Choose which pages are available to all client portal users. Hiding a page removes it from navigation and blocks its direct URL. Plan entitlements continue to apply.</p>
        </div>

        {loadError && (
          <div role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
            Could not load visibility settings: {loadError}
          </div>
        )}

        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
          {groups.map(([section, pages]) => (
            <section key={section} className="p-4 md:p-5" aria-label={section}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{section}</h2>
              <div className="divide-y divide-[#F3F4F6]">
                {pages.map(page => {
                  const isVisible = visibility[page.key] !== false;
                  const busy = savingKey === page.key;
                  return (
                    <div key={page.key} className="flex min-h-[68px] items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-medium text-[#111827]">{page.label}</h3>
                          <code className="text-[11px] text-[#9CA3AF]">{page.path}</code>
                        </div>
                        <p className="mt-0.5 text-xs text-[#6B7280]">{page.description}</p>
                      </div>
                      <span className={`hidden min-w-12 text-right text-xs font-medium sm:block ${isVisible ? 'text-[#16803C]' : 'text-[#6B7280]'}`}>
                        {isVisible ? 'Show' : 'Hide'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isVisible}
                        aria-label={`${isVisible ? 'Hide' : 'Show'} ${page.label}`}
                        disabled={!!savingKey || !!loadError || busy}
                        onClick={() => void setPageVisibility(page.key, !isVisible)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C55E8] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${isVisible ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#9CA3AF]">Visibility is shared globally across client portal accounts. Detailed views and create forms inherit their parent page setting.</p>
      </div>
    </div>
  );
}
