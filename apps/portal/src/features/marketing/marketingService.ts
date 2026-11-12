import { supabase } from '@/lib/supabase';

export interface MarketingSettings {
  business_category: string;
  post_styles: string[];
  target_platforms: string[];
  post_frequency: string;
  custom_instructions: string;
  auto_approve: boolean;
}

export interface Variant {
  caption: string;
  hashtags: string[];
  image_hint: string;
}

export interface MarketingPost {
  id: string;
  platform: string;
  post_type: string;
  user_context: string | null;
  caption: string | null;
  hashtags: string[];
  image_hint: string | null;
  variants: Array<Record<string, Variant>>;
  selected_variant: number;
  status: string;
  created_at: string;
  location_id: string | null;
}

export interface GeneratePostParams {
  platform: string;
  post_type: string;
  user_context?: string | undefined;
  location_id?: string | undefined;
  variant_count?: number | undefined;
  source_review?: string | undefined;
}

export interface GeneratePostResult {
  post_id: string;
  variants: Array<Record<string, Variant>>;
  platforms: string[];
  status: string;
  error?: string;
}

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  business_category: 'other',
  post_styles: ['casual'],
  target_platforms: ['instagram', 'facebook'],
  post_frequency: 'daily_1',
  custom_instructions: '',
  auto_approve: false,
};

export const BUSINESS_CATEGORIES = [
  { value: 'restaurant',  label: 'Restaurant / Cafe' },
  { value: 'cafe',        label: 'Cafe' },
  { value: 'hotel',       label: 'Hotel / Hospitality' },
  { value: 'retail',      label: 'Retail Store' },
  { value: 'travel',      label: 'Travel' },
  { value: 'beauty',      label: 'Beauty / Wellness' },
  { value: 'healthcare',  label: 'Healthcare / Medical' },
  { value: 'education',   label: 'Education' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'automotive',  label: 'Automotive' },
  { value: 'technology',  label: 'Technology / SaaS' },
  { value: 'other',       label: 'Other' },
];

export const POST_STYLES = [
  { value: 'casual',        label: 'Casual' },
  { value: 'professional',  label: 'Professional' },
  { value: 'gen_z',         label: 'Gen Z / Trendy' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'humorous',      label: 'Humorous' },
];

export const TARGET_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
];

export const POST_FREQUENCIES = [
  { value: 'daily_2',  label: 'Twice a day' },
  { value: 'daily_1',  label: 'Once a day' },
  { value: 'weekly_3', label: '3× per week' },
  { value: 'weekly_1', label: 'Once a week' },
  { value: 'custom',   label: 'Custom' },
];

export const POST_TYPES = [
  { value: 'promotional',      label: 'Promotional',        desc: 'Offers, deals, urgency' },
  { value: 'fun_gen_z',        label: 'Fun / Gen Z',        desc: 'Trendy, relatable, current slang' },
  { value: 'behind_scenes',    label: 'Behind the Scenes',  desc: 'Personal, authentic glimpse' },
  { value: 'review_highlight', label: 'Review Highlight',   desc: 'Turn customer reviews into social proof' },
  { value: 'seasonal',         label: 'Seasonal / Trending', desc: 'Tie to holidays or trends' },
  { value: 'custom',           label: 'Custom',             desc: 'Describe what you want' },
];

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  linkedin:  'LinkedIn',
  all:       'All Platforms',
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',      color: 'bg-[#F3F4F6] text-[#374151]' },
  pending_approval: { label: 'Pending',    color: 'bg-[#FFFBEB] text-[#B45309]' },
  approved:         { label: 'Approved',   color: 'bg-[#F0FDF4] text-[#15803D]' },
  rejected:         { label: 'Rejected',   color: 'bg-[#FEF2F2] text-[#DC2626]' },
  downloaded:       { label: 'Downloaded', color: 'bg-[#EFF6FF] text-[#1D4ED8]' },
};

export interface ReviewHighlight {
  id: string;
  highlight_text: string;
  keywords: string[];
  generated_at: string;
  location_id: string;
}

export const marketingService = {
  async getOrgId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: member } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).maybeSingle();
    return member?.org_id ?? null;
  },

  async loadSettings(): Promise<{ data: MarketingSettings | null; error: string | null }> {
    const orgId = await this.getOrgId();
    if (!orgId) return { data: null, error: 'No org found' };
    const { data, error } = await supabase.from('marketing_settings').select('*').eq('org_id', orgId).maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as MarketingSettings | null, error: null };
  },

  async saveSettings(settings: Partial<MarketingSettings>): Promise<{ error: string | null }> {
    const orgId = await this.getOrgId();
    if (!orgId) return { error: 'No org found' };
    const { error } = await supabase.from('marketing_settings').upsert({ org_id: orgId, ...settings }, { onConflict: 'org_id' });
    return { error: error?.message ?? null };
  },

  async loadPosts(filters: { platform?: string; post_type?: string; status?: string } = {}): Promise<{ data: MarketingPost[] }> {
    let q = supabase
      .from('marketing_posts')
      .select('id, platform, post_type, user_context, caption, hashtags, image_hint, variants, selected_variant, status, created_at, location_id')
      .order('created_at', { ascending: false })
      .limit(50);
    if (filters.platform && filters.platform !== 'all') q = q.eq('platform', filters.platform);
    if (filters.post_type) q = q.eq('post_type', filters.post_type);
    if (filters.status) q = q.eq('status', filters.status);
    const { data } = await q;
    return { data: (data ?? []) as MarketingPost[] };
  },

  async getPostStats(): Promise<{ total: number; thisMonth: number; byPlatform: Record<string, number> }> {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [totalRes, monthRes] = await Promise.all([
      supabase.from('marketing_posts').select('platform', { count: 'exact' }),
      supabase.from('marketing_posts').select('platform', { count: 'exact' }).gte('created_at', monthStart),
    ]);
    const allPosts = totalRes.data ?? [];
    const byPlatform: Record<string, number> = {};
    for (const p of allPosts) {
      byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    }
    return {
      total: totalRes.count ?? 0,
      thisMonth: monthRes.count ?? 0,
      byPlatform,
    };
  },

  async generatePost(params: GeneratePostParams): Promise<GeneratePostResult> {
    const res = await supabase.functions.invoke('ai-generate-post', { body: params });
    if (res.error) return { post_id: '', variants: [], platforms: [], status: '', error: res.error.message };
    const data = res.data as GeneratePostResult & { error?: string };
    if (data.error) return { ...data, post_id: '', variants: [], platforms: [], status: '' };
    return data;
  },

  async markDownloaded(id: string): Promise<void> {
    await supabase.from('marketing_posts').update({ status: 'downloaded' }).eq('id', id);
  },

  async deletePost(id: string): Promise<void> {
    await supabase.from('marketing_posts').delete().eq('id', id);
  },

  async loadHighlights(locationId: string): Promise<{ data: ReviewHighlight[]; error: string | null }> {
    const { data, error } = await supabase
      .from('review_highlights')
      .select('id, highlight_text, keywords, generated_at, location_id')
      .eq('location_id', locationId)
      .order('generated_at', { ascending: false })
      .limit(10);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as ReviewHighlight[], error: null };
  },

  async extractHighlights(locationId?: string): Promise<{ error: string | null; extracted?: number }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not authenticated' };
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-review-highlights`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationId ? { location_id: locationId } : {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? 'Extraction failed' };
    return { error: null, extracted: body.extracted ?? 0 };
  },
};
