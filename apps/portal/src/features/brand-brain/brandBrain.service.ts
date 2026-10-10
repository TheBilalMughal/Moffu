import { supabase } from '@/lib/supabase';

export interface StarRatingRule { tone?: string; reply_length?: string; }
export interface StarRatingRules {
  five_star?: StarRatingRule;
  mid_star?: StarRatingRule;
  low_star?: StarRatingRule;
}
export interface KeywordContext { id: string; keyword: string; context: string; }
export interface ApprovalRules { require_approval_below: number; }

export interface BrandBrainData {
  business_name: string;
  business_type: string;
  business_desc: string;
  tone: 'professional' | 'friendly' | 'formal' | 'casual';
  reply_length: 'short' | 'medium' | 'long';
  use_customer_name: boolean;
  use_emoji: boolean;
  primary_language: string;
  reviewer_lang_behaviour: 'primary' | 'match';
  negative_rule: 'manual' | 'cautious' | 'normal';
  prohibited_phrases: string[];
  example_reply: string;
  custom_tone_instructions: string;
  reply_signature: string;
  star_rating_rules: StarRatingRules;
  keyword_contexts: KeywordContext[];
  approval_rules: ApprovalRules;
}

export interface LocationOverride {
  location_id: string;
  business_name?: string | null;
  business_type?: string | null;
  business_desc?: string | null;
  tone?: string | null;
  reply_length?: string | null;
  use_customer_name?: boolean | null;
  use_emoji?: boolean | null;
  primary_language?: string | null;
  reviewer_lang_behaviour?: string | null;
  negative_rule?: string | null;
  prohibited_phrases?: string[] | null;
  example_reply?: string | null;
  custom_tone_instructions?: string | null;
  reply_signature?: string | null;
  star_rating_rules?: StarRatingRules | null;
  approval_rules?: ApprovalRules | null;
}

export interface GoogleLocation {
  id: string;
  display_name: string | null;
  address: string | null;
}

export type ServiceError = { message: string };

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

export const brandBrainService = {
  async load(): Promise<{ data?: BrandBrainData; error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data, error } = await supabase
      .from('brand_brain').select('*').eq('user_id', user.id).maybeSingle();

    if (error) return { error: { message: error.message } };
    if (!data) return {};

    return {
      data: {
        business_name: data.business_name ?? '',
        business_type: data.business_type ?? '',
        business_desc: data.business_desc ?? '',
        tone: data.tone ?? 'professional',
        reply_length: data.reply_length ?? 'medium',
        use_customer_name: data.use_customer_name ?? true,
        use_emoji: data.use_emoji ?? false,
        primary_language: data.primary_language ?? 'English',
        reviewer_lang_behaviour: data.reviewer_lang_behaviour ?? 'primary',
        negative_rule: data.negative_rule ?? 'cautious',
        prohibited_phrases: data.prohibited_phrases ?? [],
        example_reply: data.example_reply ?? '',
        custom_tone_instructions: data.custom_tone_instructions ?? '',
        reply_signature: data.reply_signature ?? '',
        star_rating_rules: data.star_rating_rules ?? {},
        keyword_contexts: data.keyword_contexts ?? [],
        approval_rules: data.approval_rules ?? { require_approval_below: 0 },
      },
    };
  },

  async save(payload: BrandBrainData): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain')
      .upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id' });

    if (error) return { error: { message: error.message } };
    return {};
  },

  async loadLocations(): Promise<{ data?: GoogleLocation[]; error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data, error } = await supabase
      .from('google_locations').select('id, display_name, address')
      .eq('user_id', user.id).order('display_name');

    if (error) return { error: { message: error.message } };
    return { data: data ?? [] };
  },

  async loadAllOverrides(): Promise<{ data?: LocationOverride[]; error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data, error } = await supabase
      .from('brand_brain_overrides').select('*').eq('user_id', user.id);

    if (error) return { error: { message: error.message } };
    return { data: data ?? [] };
  },

  async saveOverride(locationId: string, payload: Omit<LocationOverride, 'location_id'>): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain_overrides')
      .upsert({ user_id: user.id, location_id: locationId, ...payload }, { onConflict: 'user_id,location_id' });

    if (error) return { error: { message: error.message } };
    return {};
  },

  async deleteOverride(locationId: string): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain_overrides').delete()
      .eq('user_id', user.id).eq('location_id', locationId);

    if (error) return { error: { message: error.message } };
    return {};
  },

  async previewVoice(settings: Partial<BrandBrainData>, testReview?: { reviewer_name: string; rating: number; body: string }): Promise<{ draft?: string; test_review?: typeof testReview; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/ai-preview-voice`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, test_review: testReview }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Preview failed' };
    return data;
  },

  async addKeywordContext(keyword: string, context: string): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data: existing } = await supabase
      .from('brand_brain').select('keyword_contexts').eq('user_id', user.id).maybeSingle();

    const current: KeywordContext[] = existing?.keyword_contexts ?? [];
    if (current.some(k => k.keyword.toLowerCase() === keyword.toLowerCase())) return {};

    const updated = [...current, { id: crypto.randomUUID(), keyword, context }];
    const { error } = await supabase
      .from('brand_brain')
      .upsert({ user_id: user.id, keyword_contexts: updated }, { onConflict: 'user_id' });

    if (error) return { error: { message: error.message } };
    return {};
  },

  async analyzeVoice(replies: string[]): Promise<{ suggestions?: Partial<BrandBrainData>; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/ai-analyze-voice`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replies }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Analysis failed' };
    return data;
  },
};
