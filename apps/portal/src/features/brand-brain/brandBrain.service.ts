import { supabase } from '@/lib/supabase';

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
}

// All fields optional — null means "inherit from global"
export interface LocationOverride {
  location_id: string;
  tone?: string | null;
  reply_length?: string | null;
  use_customer_name?: boolean | null;
  use_emoji?: boolean | null;
  primary_language?: string | null;
  reviewer_lang_behaviour?: string | null;
  negative_rule?: string | null;
  prohibited_phrases?: string[] | null;
  example_reply?: string | null;
}

export interface GoogleLocation {
  id: string;
  display_name: string | null;
  address: string | null;
}

export type ServiceError = { message: string };

export const brandBrainService = {
  async load(): Promise<{ data?: BrandBrainData; error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data, error } = await supabase
      .from('brand_brain')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return { error: { message: error.message } };
    if (!data) return {};

    return {
      data: {
        business_name: data.business_name ?? '',
        business_type: data.business_type ?? '',
        business_desc: data.business_desc ?? '',
        tone: data.tone,
        reply_length: data.reply_length,
        use_customer_name: data.use_customer_name,
        use_emoji: data.use_emoji,
        primary_language: data.primary_language,
        reviewer_lang_behaviour: data.reviewer_lang_behaviour,
        negative_rule: data.negative_rule,
        prohibited_phrases: data.prohibited_phrases ?? [],
        example_reply: data.example_reply ?? '',
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
      .from('google_locations')
      .select('id, display_name, address')
      .eq('user_id', user.id)
      .order('display_name');

    if (error) return { error: { message: error.message } };
    return { data: data ?? [] };
  },

  async loadOverride(locationId: string): Promise<{ data?: LocationOverride | null; error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { data, error } = await supabase
      .from('brand_brain_overrides')
      .select('*')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .maybeSingle();

    if (error) return { error: { message: error.message } };
    if (!data) return { data: null };

    return {
      data: {
        location_id: data.location_id,
        tone: data.tone,
        reply_length: data.reply_length,
        use_customer_name: data.use_customer_name,
        use_emoji: data.use_emoji,
        primary_language: data.primary_language,
        reviewer_lang_behaviour: data.reviewer_lang_behaviour,
        negative_rule: data.negative_rule,
        prohibited_phrases: data.prohibited_phrases,
        example_reply: data.example_reply,
      },
    };
  },

  async saveOverride(locationId: string, payload: Omit<LocationOverride, 'location_id'>): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain_overrides')
      .upsert(
        { user_id: user.id, location_id: locationId, ...payload },
        { onConflict: 'user_id,location_id' }
      );

    if (error) return { error: { message: error.message } };
    return {};
  },

  async deleteOverride(locationId: string): Promise<{ error?: ServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('location_id', locationId);

    if (error) return { error: { message: error.message } };
    return {};
  },
};
