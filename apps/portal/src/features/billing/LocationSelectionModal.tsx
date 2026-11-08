import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LocationRow {
  id: string;
  display_name: string | null;
  address: string | null;
  is_selected: boolean;
}

interface Props {
  newPlanName: string;
  locationLimit: number;
  onConfirm: (keepIds: string[]) => Promise<void>;
  onCancel?: () => void;
}

export function LocationSelectionModal({ newPlanName, locationLimit, onConfirm, onCancel }: Props) {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('google_locations')
      .select('id, display_name, address, is_selected')
      .order('display_name', { ascending: true });
    if (err) { setError(err.message); setLoading(false); return; }
    const rows = data ?? [];
    setLocations(rows);
    // Pre-select currently active ones (up to the limit)
    const active = rows.filter(l => l.is_selected).slice(0, locationLimit);
    setSelected(new Set(active.map(l => l.id)));
    setLoading(false);
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= locationLimit) return prev; // at limit
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0 && locationLimit > 0) {
      setError('Please select at least one location to keep active.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Deselect all locations not in the kept set
      const keepIds = Array.from(selected);
      const { error: err } = await supabase
        .from('google_locations')
        .update({ is_selected: false })
        .not('id', 'in', `(${keepIds.map(id => `'${id}'`).join(',')})`);
      if (err) throw new Error(err.message);
      await onConfirm(keepIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  }

  const atLimit = selected.size >= locationLimit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Choose locations to keep</h3>
            <p className="text-xs text-[#6B7280] mt-1">
              The <span className="font-semibold text-[#111827]">{newPlanName}</span> plan includes{' '}
              {locationLimit === 1 ? '1 location' : `${locationLimit} locations`}. Select which to keep active.
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#374151] transition-colors mt-0.5"
              aria-label="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">
              {selected.size} of {locationLimit} selected
            </span>
            {atLimit && (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                Limit reached
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#6C55E8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {locations.map(loc => {
                const isChecked = selected.has(loc.id);
                const disabled = !isChecked && atLimit;
                return (
                  <label
                    key={loc.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-[#F0F7F4] border-[#6C55E8]/30'
                        : disabled
                          ? 'bg-[#F9FAFB] border-[#E5E7EB] opacity-50 cursor-not-allowed'
                          : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => !disabled && toggle(loc.id)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#6C55E8]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111827] truncate">
                        {loc.display_name ?? 'Unnamed location'}
                      </p>
                      {loc.address && (
                        <p className="text-[10px] text-[#9CA3AF] truncate mt-0.5">{loc.address}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <p className="text-[11px] text-[#9CA3AF] mb-3 text-center">
            Unselected locations will be deactivated but not deleted.
          </p>
          <button
            onClick={handleConfirm}
            disabled={saving || loading || selected.size === 0}
            className="w-full py-2.5 text-xs font-semibold text-white bg-[#111827] rounded-xl hover:bg-[#1f2937] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : `Confirm — keep ${selected.size} location${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
