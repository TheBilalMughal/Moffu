import { supabase } from '@/lib/supabase';

export type MemberRole = 'owner' | 'admin' | 'manager' | 'viewer';

export interface TeamMember {
  member_id:    string;
  user_id:      string;
  display_name: string | null;
  email:        string;
  role:         MemberRole;
  status:       'active' | 'invited' | 'suspended';
  joined_at:    string | null;
}

export interface TeamInvitation {
  id:          string;
  email:       string;
  role:        MemberRole;
  invited_at:  string;
  expires_at:  string;
  accepted_at: string | null;
  revoked_at:  string | null;
}

export interface InvitationDetails {
  id:         string;
  email:      string;
  role:       string;
  expires_at: string;
  is_valid:   boolean;
  org_name:   string;
  invited_by: string;
}

export const teamService = {
  async getMembers(orgId: string): Promise<{ data: TeamMember[]; error: string | null }> {
    const { data, error } = await supabase.rpc('get_team_members', { p_org_id: orgId });
    if (error) return { data: [], error: error.message };
    return { data: (data as TeamMember[]) ?? [], error: null };
  },

  async getPendingInvitations(orgId: string): Promise<{ data: TeamInvitation[]; error: string | null }> {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, email, role, invited_at, expires_at, accepted_at, revoked_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('invited_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as TeamInvitation[]) ?? [], error: null };
  },

  async inviteMember(orgId: string, email: string, role: MemberRole): Promise<{ error: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not authenticated' };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const res = await fetch(`${supabaseUrl}/functions/v1/team-invite`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ org_id: orgId, email, role }),
    });

    const body = await res.json();
    if (!res.ok) return { error: body.error ?? 'Failed to send invitation' };
    return { error: null };
  },

  async updateRole(orgId: string, memberId: string, newRole: MemberRole): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('update_member_role', {
      p_org_id:    orgId,
      p_member_id: memberId,
      p_new_role:  newRole,
    });
    return { error: error?.message ?? null };
  },

  async removeMember(orgId: string, memberId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('remove_member', {
      p_org_id:    orgId,
      p_member_id: memberId,
    });
    return { error: error?.message ?? null };
  },

  async revokeInvitation(invitationId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('revoke_invitation', {
      p_invitation_id: invitationId,
    });
    return { error: error?.message ?? null };
  },

  async getInvitationDetails(token: string): Promise<{ data: InvitationDetails | null; error: string | null }> {
    const { data, error } = await supabase.rpc('get_invitation_details', { p_token: token });
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: 'Invitation not found' };
    return { data: data as InvitationDetails, error: null };
  },

  async acceptInvitation(token: string): Promise<{ orgId: string | null; error: string | null }> {
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
    if (error) return { orgId: null, error: error.message };
    return { orgId: data as string, error: null };
  },

  async getSeatUsage(orgId: string): Promise<{ used: number; limit: number | null }> {
    const [membersRes, invRes, subRes] = await Promise.all([
      supabase.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
      supabase.from('invitations').select('id', { count: 'exact', head: true })
        .eq('org_id', orgId).is('accepted_at', null).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString()),
      supabase.from('subscriptions').select('plan_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').eq('status', 'active').limit(1).maybeSingle(),
    ]);

    const used = (membersRes.count ?? 0) + (invRes.count ?? 0);

    if (!subRes.data?.plan_id) return { used, limit: null };

    const { data: ent } = await supabase
      .from('plan_entitlements')
      .select('limit_value')
      .eq('plan_id', subRes.data.plan_id)
      .eq('key', 'team_members')
      .maybeSingle();

    return { used, limit: ent?.limit_value ?? null };
  },
};
