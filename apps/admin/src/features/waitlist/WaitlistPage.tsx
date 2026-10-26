import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  source: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SOURCE_LABEL: Record<string, string> = {
  hero:          'Hero',
  cta_section:   'CTA Section',
  pricing:       'Pricing',
  feature_hero:  'Features Hero',
  feature_cta:   'Features CTA',
  website:       'Website',
};

export function WaitlistPage() {
  const [entries, setEntries]             = useState<WaitlistEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [waitlistOn, setWaitlistOn]       = useState(false);
  const [toggling, setToggling]           = useState(false);
  const [settingLoaded, setSettingLoaded] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('waitlist_entries')
      .select('id, name, email, source, created_at')
      .order('created_at', { ascending: false });
    setEntries((data as WaitlistEntry[]) ?? []);
    setLoading(false);
  }, []);

  const fetchSetting = useCallback(async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'waitlist_enabled')
      .single();
    setWaitlistOn(data?.value === 'true');
    setSettingLoaded(true);
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchSetting();
  }, [fetchEntries, fetchSetting]);

  async function handleToggle() {
    setToggling(true);
    const newValue = !waitlistOn;
    await supabase
      .from('platform_settings')
      .upsert({ key: 'waitlist_enabled', value: String(newValue) }, { onConflict: 'key' });
    setWaitlistOn(newValue);
    setToggling(false);
  }

  function exportCSV() {
    const rows = [['Name', 'Email', 'Source', 'Joined'], ...filtered.map(e => [e.name, e.email, SOURCE_LABEL[e.source] ?? e.source, new Date(e.created_at).toISOString()])];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Join Waitlist</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Manage waitlist signups from the marketing site.
            </p>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>
        </div>

        {/* Toggle card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Waitlist mode</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              When ON, all "Get Started" buttons on the website show a "Join Waitlist" modal instead of linking to the portal.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`text-xs font-semibold ${waitlistOn ? 'text-[#0D4C3C]' : 'text-[#9CA3AF]'}`}>
              {settingLoaded ? (waitlistOn ? 'ON' : 'OFF') : '…'}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggling || !settingLoaded}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                waitlistOn ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'
              }`}
              aria-label="Toggle waitlist"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                waitlistOn ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total signups', value: entries.length },
            { label: 'Last 7 days', value: entries.filter(e => Date.now() - new Date(e.created_at).getTime() < 7 * 86400000).length },
            { label: 'Today', value: entries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 text-center">
              <p className="text-2xl font-bold text-[#111827]">{s.value}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + table */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-xs px-3 py-2 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="flex-1 text-xs text-[#111827] placeholder-[#9CA3AF] bg-transparent focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#9CA3AF] hover:text-[#374151]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
              {search ? 'No results match your search.' : 'No waitlist signups yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    {['#', 'Name', 'Email', 'Source', 'Joined'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {filtered.map((entry, i) => (
                    <tr key={entry.id} className="hover:bg-[#FAFFFE] transition-colors">
                      <td className="px-5 py-3.5 text-xs text-[#9CA3AF] w-10">{i + 1}</td>
                      <td className="px-5 py-3.5 font-medium text-[#111827]">{entry.name}</td>
                      <td className="px-5 py-3.5 text-[#374151]">{entry.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                          {SOURCE_LABEL[entry.source] ?? entry.source}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#6B7280] whitespace-nowrap">
                        <span title={new Date(entry.created_at).toLocaleString()}>
                          {timeAgo(entry.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
