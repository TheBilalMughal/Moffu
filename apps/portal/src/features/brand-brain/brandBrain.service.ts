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

export type BrandBrainServiceError = { message: string };

export const brandBrainService = {
  async load(): Promise<{ data?: BrandBrainData; error?: BrandBrainServiceError }> {
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

  async save(payload: BrandBrainData): Promise<{ error?: BrandBrainServiceError }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not authenticated.' } };

    const { error } = await supabase
      .from('brand_brain')
      .upsert(
        { user_id: user.id, ...payload },
        { onConflict: 'user_id' }
      );

    if (error) return { error: { message: error.message } };
    return {};
  },
};
