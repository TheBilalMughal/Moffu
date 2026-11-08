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
    // Uses server-side RPC so platform (internal) members are excluded from the count.
    const { data, error } = await supabase.rpc('get_seat_usage', { p_org_id: orgId });
    if (error || !data) return { used: 0, limit: null };
    const result = data as { used: number; limit: number | null };
    return { used: result.used ?? 0, limit: result.limit ?? null };
  },
};
