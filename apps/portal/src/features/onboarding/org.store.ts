import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

type OrgStatus = 'onboarding' | 'active' | 'suspended';

interface OrgState {
  orgId: string | null;
  orgStatus: OrgStatus | null;
  checked: boolean;
  check: () => Promise<void>;
  setOrg: (orgId: string, status: OrgStatus) => void;
  clear: () => void;
}

export const useOrgStore = create<OrgState>((set) => ({
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
      set({
        orgId: data.org_id,
        orgStatus: (org?.status as OrgStatus) ?? null,
        checked: true,
      });
    } else {
      set({ orgId: null, orgStatus: null, checked: true });
    }
  },

  setOrg(orgId, status) {
    set({ orgId, orgStatus: status, checked: true });
  },

  clear() {
    set({ orgId: null, orgStatus: null, checked: false });
  },
}));
