import { Link } from 'react-router-dom';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] px-6 py-5">
      <p className="text-sm text-[#6B7280] font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Overview</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Your review performance at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Reviews" value="—" sub="Connect Google to see data" />
        <StatCard label="Avg. Rating" value="—" sub="Connect Google to see data" />
        <StatCard label="Pending Reply" value="—" sub="Connect Google to see data" />
        <StatCard label="Replied" value="—" sub="Connect Google to see data" />
      </div>

      {/* Empty state CTA */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] px-8 py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#111827] mb-1">No reviews yet</h2>
        <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-5">
          Connect your Google Business Profile to start seeing and responding to reviews.
        </p>
        <Link
          to="/reviews"
          className="inline-flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Go to Reviews
        </Link>
      </div>
    </div>
  );
}
