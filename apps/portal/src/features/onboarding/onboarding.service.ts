import { supabase } from '@/lib/supabase';

export interface Country {
  id: string;
  code: string;
  name: string;
  default_tz: string | null;
}

export const onboardingService = {
  async getCountries(): Promise<Country[]> {
    const { data } = await supabase
      .from('countries')
      .select('id, code, name, default_tz')
      .order('name');
    return (data ?? []) as Country[];
  },

  async createOrganization(
    name: string,
    slug: string,
    countryId?: string,
    timezone?: string,
  ): Promise<{ orgId: string | null; error?: string }> {
    const { data, error } = await supabase.rpc('create_organization', {
      p_name:       name,
      p_slug:       slug,
      p_country_id: countryId ?? null,
      p_timezone:   timezone  ?? null,
    });
    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('organizations_slug_key')) {
        return { orgId: null, error: 'This URL slug is already taken. Please choose a different one.' };
      }
      if (error.message.includes('already belongs')) {
        return { orgId: null, error: 'Your account is already linked to an organization.' };
      }
      return { orgId: null, error: error.message };
    }
    return { orgId: data as string };
  },

  async updateOrgLocation(
    orgId: string,
    countryId?: string,
    timezone?: string,
  ): Promise<{ error?: string }> {
    const { error } = await supabase.rpc('update_org_location', {
      p_org_id:     orgId,
      p_country_id: countryId ?? null,
      p_timezone:   timezone  ?? null,
    });
    if (error) return { error: error.message };
    return {};
  },

  async completeOnboarding(orgId: string): Promise<{ error?: string }> {
    const { error } = await supabase.rpc('complete_onboarding', {
      p_org_id: orgId,
    });
    if (error) return { error: error.message };
    return {};
  },
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
