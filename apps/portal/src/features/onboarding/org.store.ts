import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

type OrgStatus = 'onboarding' | 'active' | 'suspended';

interface OrgState {
  orgId: string | null;
  orgStatus: OrgStatus | null;
  checked: boolean;
  check: () => Promise<void>;
  ensureOrg: (user: User) => Promise<void>;
  setOrg: (orgId: string, status: OrgStatus) => void;
  clear: () => void;
}

function autoSlug(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-business';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  orgId: null,
  orgStatus: null,
  checked: false,

  async check() {
    const { data } = await supabase
      .from('org_members')
      .select('org_id, organizations(status)')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (data) {
      const org = (data.organizations as unknown) as { status: string } | null;
      set({ orgId: data.org_id, orgStatus: (org?.status as OrgStatus) ?? null, checked: true });
    } else {
      set({ orgId: null, orgStatus: null, checked: true });
    }
  },

  async ensureOrg(user: User) {
    const state = get();
    // Already has an org — nothing to do
    if (state.checked && state.orgId) return;

    await get().check();

    // Still no org — silently create one
    if (!get().orgId) {
      const name =
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'My Business';

      const { data, error } = await supabase.rpc('create_organization', {
        p_name:       name,
        p_slug:       autoSlug(name),
        p_country_id: null,
        p_timezone:   null,
      });

      if (data) {
        set({ orgId: data as string, orgStatus: 'onboarding', checked: true });
      } else if (error) {
        // A concurrent call may have already created the org (race condition during
        // PKCE exchange re-renders). Re-check to pick it up instead of leaving state empty.
        await get().check();
      }
    }
  },

  setOrg(orgId, status) {
    set({ orgId, orgStatus: status, checked: true });
  },

  clear() {
    set({ orgId: null, orgStatus: null, checked: false });
  },
}));
