import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { googleService, type GoogleLocation } from './google.service';

export function GoogleConnectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fetchError = searchParams.get('fetch_error') === '1';

  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [locationLimit, setLocationLimit] = useState<number>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    // Load plan limit and locations in parallel
    const [limitResult, locResult] = await Promise.all([
      loadLocationLimit(),
      googleService.getLocations(),
    ]);

    if (locResult.error) {
      setError(locResult.error);
    } else {
      // Deduplicate by display_name (catches different path formats for same place)
      const seen = new Map<string, GoogleLocation>();
      for (const l of (locResult.data ?? [])) {
        const key = (l.display_name ?? l.google_location_name).toLowerCase().trim();
        const existing = seen.get(key);
        if (!existing || (!existing.is_selected && l.is_selected)) seen.set(key, l);
      }
      const locs = Array.from(seen.values());
      setLocations(locs);
      // Pre-select already-selected ones up to limit
      const alreadySelected = locs.filter(l => l.is_selected).map(l => l.id);
      setSelected(new Set(alreadySelected.slice(0, limitResult)));
    }

    setLoading(false);
  }

  async function loadLocationLimit(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 1;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!sub) { setLocationLimit(1); return 1; }
      const { data: ent } = await supabase
        .from('plan_entitlements')
        .select('value_type, limit_value')
        .eq('plan_id', sub.plan_id)
        .eq('key', 'locations')
        .maybeSingle();
      const limit = ent ? (ent.value_type === 'UNLIMITED' ? 999 : (ent.limit_value ?? 1)) : 1;
      setLocationLimit(limit);
      return limit;
    } catch {
      setLocationLimit(1);
      return 1;
    }
  }

  async function handleRetryFetch() {
    setRetrying(true);
    setError('');
    const { error: err } = await googleService.fetchLocations();
    if (err) {
      setError(`Could not fetch locations: ${err}`);
    } else {
      const { data, error: locErr } = await googleService.getLocations();
      if (locErr) setError(locErr);
      else {
        const locs = data ?? [];
        setLocations(locs);
        setSelected(new Set(locs.filter(l => l.is_selected).map(l => l.id).slice(0, locationLimit)));
      }
    }
    setRetrying(false);
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= locationLimit) return prev;
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setError('Please select at least one location.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const keepIds = Array.from(selected);
      // Deselect all, then select the chosen ones
      await supabase.from('google_locations').update({ is_selected: false }).neq('id', 'none');
      for (const id of keepIds) {
        const { error: err } = await supabase
          .from('google_locations')
          .update({ is_selected: true })
          .eq('id', id);
        if (err) throw new Error(err.message);
      }
      navigate('/settings?google=connected', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save selection');
      setSaving(false);
    }
  }

  const isUnlimited = locationLimit >= 999;
  const atLimit = !isUnlimited && selected.size >= locationLimit;

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5EAE8] shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5EAE8]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#0D4C3C]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#0D4C3C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111827]">Select your location{locationLimit !== 1 ? 's' : ''}</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {isUnlimited
                  ? 'Your plan supports unlimited locations'
                  : locationLimit === 1
                    ? 'Your current plan allows 1 active location'
                    : `Your plan allows up to ${locationLimit} active locations`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {fetchError && !locations.length && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              Could not fetch your locations automatically. You can retry below or skip to manage them in Settings later.
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-[#9CA3AF] mb-4">
                No Google Business Profile locations found on your account.
              </p>
              <button
                onClick={handleRetryFetch}
                disabled={retrying}
                className="text-xs font-medium text-[#0D4C3C] hover:underline disabled:opacity-50"
              >
                {retrying ? 'Fetching…' : 'Retry fetch'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#6B7280]">
                  {isUnlimited ? `${selected.size} selected` : `${selected.size} of ${locationLimit} selected`}
                </span>
                {atLimit && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                    Limit reached
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {locations.map(loc => {
                  const isChecked = selected.has(loc.id);
                  const disabled = !isChecked && atLimit;
                  return (
                    <label
                      key={loc.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#F0F7F4] border-[#0D4C3C]/30'
                          : disabled
                            ? 'bg-[#F9FAFB] border-[#E5EAE8] opacity-50 cursor-not-allowed'
                            : 'bg-white border-[#E5EAE8] hover:bg-[#F8FAF9]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => !disabled && toggle(loc.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-[#0D4C3C]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#111827] truncate">
                          {loc.display_name ?? loc.google_location_name}
                        </p>
                        {loc.address && (
                          <p className="text-[10px] text-[#9CA3AF] truncate mt-0.5">{loc.address}</p>
                        )}
                      </div>
                      {isChecked && (
                        <svg className="w-4 h-4 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 space-y-2">
          {locations.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={saving || loading || selected.size === 0}
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#0D4C3C] rounded-xl hover:bg-[#0a3d30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? 'Saving…'
                : `Continue with ${selected.size} location${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
          <button
            onClick={() => navigate('/settings?google=connected', { replace: true })}
            className="w-full py-2 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors"
          >
            Skip — manage locations in Settings
          </button>
        </div>
      </div>
    </div>
  );
}
