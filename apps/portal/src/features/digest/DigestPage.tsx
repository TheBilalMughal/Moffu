import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';

interface TopicStat { topic: string; label: string; positive: number; negative: number; neutral: number; total: number }
interface ActionItem { title: string; description: string }
interface RatingDist { '1': number; '2': number; '3': number; '4': number; '5': number }

interface MonthlyDigest {
  id: string;
  org_id: string;
  month: string;
  review_count: number;
  avg_rating: number | null;
  avg_rating_prev: number | null;
  reply_rate: number | null;
  pending_count: number;
  rating_dist: RatingDist | null;
  top_topics: TopicStat[] | null;
  summary_text: string | null;
  insights_html: string | null;
  action_items: ActionItem[] | null;
  email_subject: string | null;
  sent_at: string | null;
  generated_at: string;
}

function monthLabel(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(): string {
  const now = new Date();
  if (now.getMonth() === 0) return `${now.getFullYear() - 1}-12`;
  return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-[#6B7280] w-5 text-right">{star}★</span>
      <div className="flex-1 bg-[#F3F4F6] rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-[#9CA3AF] w-5">{count}</span>
    </div>
  );
}

function DigestCard({ digest, expanded, onToggle }: {
  digest: MonthlyDigest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const delta = digest.avg_rating && digest.avg_rating_prev
    ? digest.avg_rating - digest.avg_rating_prev
    : null;
  const ratingColor = delta === null ? '#6C55E8' : delta >= 0 ? '#10B981' : '#EF4444';

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#111827]">{monthLabel(digest.month)}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {digest.review_count} review{digest.review_count !== 1 ? 's' : ''} &middot; {digest.sent_at ? 'Emailed' : 'Not sent'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* KPIs */}
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: ratingColor }}>
                {digest.avg_rating ?? '—'}
                {delta !== null && <span className="text-sm ml-0.5">{delta >= 0 ? '↑' : '↓'}</span>}
              </p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Avg</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#111827]">{digest.reply_rate ?? '—'}%</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Replied</p>
            </div>
          </div>
          {/* Expand icon */}
          <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#F3F4F6] px-6 py-5 space-y-6">

          {/* Summary */}
          {digest.summary_text && (
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Summary</p>
              <p className="text-sm text-[#374151] leading-relaxed">{digest.summary_text}</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Reviews', value: String(digest.review_count) },
              { label: 'Avg Rating', value: digest.avg_rating ? `${digest.avg_rating}★` : '—' },
              { label: 'Reply Rate', value: digest.reply_rate !== null ? `${digest.reply_rate}%` : '—' },
              { label: 'Pending', value: String(digest.pending_count) },
            ].map(s => (
              <div key={s.label} className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-[#111827]">{s.value}</p>
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Two-column: rating bars + topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Rating distribution */}
            {digest.rating_dist && (
              <div>
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Rating breakdown</p>
                {[5, 4, 3, 2, 1].map(s => (
                  <RatingBar key={s} star={s} count={digest.rating_dist![String(s) as keyof RatingDist] ?? 0} total={digest.review_count} />
                ))}
              </div>
            )}

            {/* Topics */}
            {digest.top_topics && digest.top_topics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Top topics</p>
                <div className="space-y-2">
                  {digest.top_topics.slice(0, 5).map(t => (
                    <div key={t.topic} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                      <span className="text-sm font-medium text-[#374151]">{t.label}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#10B981]">{t.positive} pos</span>
                        <span className="text-[#EF4444]">{t.negative} neg</span>
                        <span className="text-[#9CA3AF] w-12 text-right">{t.total} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI insights */}
          {digest.insights_html && (
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">AI insights</p>
              <ul className="space-y-2 pl-4 list-disc">
                {/* insights_html contains <li> elements; parse them */}
                {digest.insights_html
                  .split('</li>')
                  .map(s => s.replace(/<li[^>]*>/i, '').trim())
                  .filter(Boolean)
                  .map((insight, i) => (
                    <li key={i} className="text-sm text-[#374151] leading-relaxed">{insight}</li>
                  ))}
              </ul>
            </div>
          )}

          {/* Action items */}
          {digest.action_items && digest.action_items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Actions for next month</p>
              <div className="space-y-3">
                {digest.action_items.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-lg bg-[#6C55E8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{a.title}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sent info */}
          {digest.sent_at && (
            <p className="text-xs text-[#9CA3AF]">
              Emailed {new Date(digest.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function DigestPage() {
  const user    = useAuthStore(s => s.user);
  const orgId   = useOrgStore(s => s.orgId);
  const [digests, setDigests]       = useState<MonthlyDigest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMonth, setGenMonth]     = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [genError, setGenError]     = useState('');
  const [genSuccess, setGenSuccess] = useState('');

  async function loadDigests() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from('monthly_digests')
      .select('*')
      .eq('org_id', orgId)
      .order('month', { ascending: false })
      .limit(24);
    setDigests(data ?? []);
    setLoading(false);
    // Auto-expand latest
    if (data?.length && !expandedId) setExpandedId(data[0].id);
  }

  useEffect(() => { loadDigests(); }, [orgId]);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    setGenError('');
    setGenSuccess('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setGenerating(false); return; }

    const month = genMonth || prevMonth();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-digest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error ?? 'Failed to generate digest'); }
      else {
        setGenSuccess(`Digest for ${monthLabel(month)} generated and emailed.`);
        await loadDigests();
      }
    } catch { setGenError('Network error'); }
    setGenerating(false);
  }

  // Month options: last 12 months
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div className="h-full flex flex-col bg-[#F3F4F6]">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
          <div>
            <h1 className="text-[1.5rem] font-bold text-[#111827]">Monthly Digest</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">AI-generated monthly summary of your review performance, delivered by email.</p>
          </div>

          {/* Generate panel */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:flex-shrink-0">
            <select
              value={genMonth}
              onChange={e => setGenMonth(e.target.value)}
              className="text-sm border border-[#E5E7EB] rounded-xl px-3 py-2 bg-white text-[#374151] focus:outline-none focus:border-[#6C55E8]"
            >
              <option value="">Previous month</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm font-semibold text-white bg-[#6C55E8] rounded-lg px-4 py-2 hover:bg-[#5A42D1] transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {generating ? 'Generating...' : 'Generate & email digest'}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {genError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{genError}</div>
        )}
        {genSuccess && (
          <p className="mb-4 text-sm text-[#10B981]">{genSuccess}</p>
        )}

        {/* How it works strip */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-6 py-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Auto-scheduled</p>
                <p className="text-xs text-[#9CA3AF]">1st of every month, automatically</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">AI-powered</p>
                <p className="text-xs text-[#9CA3AF]">Gemini analyzes your review data</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Email delivery</p>
                <p className="text-xs text-[#9CA3AF]">Sent to all active team members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Digest list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] h-20 animate-pulse" />
            ))}
          </div>
        ) : digests.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-lg bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#111827] mb-1">No digests yet</p>
            <p className="text-xs text-[#9CA3AF] mb-4">Generate your first digest above, or wait for the auto-run on the 1st of next month.</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm font-semibold text-white bg-[#6C55E8] rounded-lg px-5 py-2.5 hover:bg-[#5A42D1] transition-colors disabled:opacity-60"
            >
              {generating ? 'Generating...' : 'Generate digest now'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {digests.map(digest => (
              <DigestCard
                key={digest.id}
                digest={digest}
                expanded={expandedId === digest.id}
                onToggle={() => setExpandedId(expandedId === digest.id ? null : digest.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
