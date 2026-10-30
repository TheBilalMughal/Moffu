import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import type React from 'react';

// ── Context ───────────────────────────────────────────────────────────────────

export interface FeatureAccessCtx {
  access: Record<string, boolean>;
  loading: boolean;
}

export const FeatureAccessContext = createContext<FeatureAccessCtx>({
  access: {},
  loading: true,
});

export function useFeatureAccess() {
  return useContext(FeatureAccessContext);
}

// ── Metadata per feature ──────────────────────────────────────────────────────

const FEATURE_META: Record<string, { name: string; description: string }> = {
  feature_insights: {
    name: 'Insights',
    description: 'Analytics, trends, and performance data across all your review locations.',
  },
  feature_google_profile: {
    name: 'Google Profile',
    description: 'View profile views, search queries, calls, and customer actions from Google Business Profile.',
  },
  feature_brand_brain: {
    name: 'Brand Brain',
    description: 'Configure your brand voice, tone, and response guidelines powered by AI.',
  },
  feature_team: {
    name: 'Team Management',
    description: 'Invite team members and manage access to your account.',
  },
};

// ── Upgrade wall ──────────────────────────────────────────────────────────────

function UpgradeWall({ feature }: { feature: string }) {
  const navigate = useNavigate();
  const meta = FEATURE_META[feature] ?? {
    name: 'This feature',
    description: 'Upgrade your plan to access this feature.',
  };

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-16">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#111827] mb-2">
          {meta.name} is not included in your plan
        </h2>
        <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">{meta.description}</p>
        <button
          onClick={() => navigate('/billing')}
          className="bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          View Plans
        </button>
      </div>
    </div>
  );
}

// ── FeatureGatePage ───────────────────────────────────────────────────────────
// Wrap a route's page content. Shows upgrade wall if feature is locked.

export function FeatureGatePage({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const { access, loading } = useFeatureAccess();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <svg className="w-5 h-5 animate-spin text-[#0D4C3C]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    );
  }

  // No entitlement row for this feature → default accessible (don't break existing users)
  const isLocked = feature in access && access[feature] === false;
  if (!isLocked) return <>{children}</>;

  return <UpgradeWall feature={feature} />;
}
