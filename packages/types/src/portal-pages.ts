export interface PortalPageDefinition {
  key: string;
  label: string;
  path: string;
  section: string;
  description: string;
}

/** Canonical list of customer-facing portal pages controlled by Admin visibility settings. */
export const PORTAL_PAGES: PortalPageDefinition[] = [
  { key: 'overview', label: 'Overview', path: '/dashboard', section: 'Dashboard', description: 'Main client dashboard' },
  { key: 'reviews', label: 'Reviews', path: '/reviews', section: 'Reviews', description: 'Customer review inbox and replies' },
  { key: 'complaints', label: 'Complaints', path: '/reviews/complaints', section: 'Reviews', description: 'Complaint tracking and follow-up' },
  { key: 'insights_trends', label: 'Trends', path: '/insights/trends', section: 'Insights', description: 'Review and reputation trends' },
  { key: 'insights_ratings', label: 'Ratings', path: '/insights/ratings', section: 'Insights', description: 'Rating breakdown and analysis' },
  { key: 'insights_agent_rules', label: 'Agent Rules', path: '/insights/agent-rules', section: 'Insights', description: 'Automated response rules' },
  { key: 'google_profile', label: 'Google Profile', path: '/google-profile', section: 'Google Growth', description: 'Google Business Profile performance' },
  { key: 'seo_leads', label: 'SEO & Leads', path: '/google-growth', section: 'Google Growth', description: 'Search Console and Analytics reporting' },
  { key: 'georank', label: 'GeoRank', path: '/georank', section: 'Google Growth', description: 'Local map visibility scans' },
  { key: 'competitors', label: 'Competitors', path: '/competitors', section: 'Google Growth', description: 'Local competitor insights' },
  { key: 'brand_brain', label: 'Brand Brain', path: '/brand-brain', section: 'Growth', description: 'Brand strategy and AI guidance' },
  { key: 'monthly_digest', label: 'Monthly Digest', path: '/digest', section: 'Growth', description: 'Monthly business performance report' },
  { key: 'campaigns', label: 'Campaigns', path: '/campaigns', section: 'Engage', description: 'Campaigns and campaign details' },
  { key: 'marketing', label: 'Marketing', path: '/marketing', section: 'Engage', description: 'Marketing content and new posts' },
  { key: 'feedback', label: 'Feedback', path: '/feedback', section: 'Engage', description: 'Feedback requests and submissions' },
  { key: 'team', label: 'Team', path: '/team', section: 'Manage', description: 'Client team members' },
  { key: 'plan', label: 'Plan', path: '/plan', section: 'Manage', description: 'Current plan and usage' },
  { key: 'billing', label: 'Billing', path: '/billing', section: 'Manage', description: 'Invoices and payment details' },
  { key: 'account', label: 'Account', path: '/settings/account', section: 'Settings', description: 'Personal account settings' },
  { key: 'preferences', label: 'Preferences', path: '/settings/preferences', section: 'Settings', description: 'Portal preferences' },
  { key: 'integrations', label: 'Integrations', path: '/settings/integrations', section: 'Settings', description: 'Connected services' },
];

export function getPortalPageForPath(pathname: string): PortalPageDefinition | undefined {
  return [...PORTAL_PAGES]
    .sort((a, b) => b.path.length - a.path.length)
    .find(page => pathname === page.path || pathname.startsWith(`${page.path}/`));
}

export function getFirstVisiblePortalPage(visibility: Record<string, boolean>): PortalPageDefinition {
  return PORTAL_PAGES.find(page => visibility[page.key] !== false) ?? PORTAL_PAGES[0]!;
}
