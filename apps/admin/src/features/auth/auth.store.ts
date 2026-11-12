import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { adminAuthService } from './auth.service';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized';

interface AdminAuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  platformRole: string | null;
  initialize: () => () => void;
}

async function fetchRole(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('platform_members')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.role ?? null;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  platformRole: null,

  initialize() {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    let subscribedUserId: string | null = null;

    function subscribeRoleChanges(userId: string) {
      if (subscribedUserId === userId) return; // already watching this user
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
      subscribedUserId = userId;
      realtimeChannel = supabase
        .channel(`platform_member_role_${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'platform_members', filter: `user_id=eq.${userId}` },
          async () => {
            const role = await fetchRole(userId);
            set(() => ({
              platformRole: role,
              status: role ? 'authenticated' : 'unauthorized',
            }));
          },
        )
        .subscribe();
    }

    adminAuthService.getSession().then(async ({ data }) => {
      if (!data.session) {
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }
      const role = await fetchRole(data.session.user.id);
      set({
        status: role ? 'authenticated' : 'unauthorized',
        session: data.session,
        user: data.session.user,
        platformRole: role,
      });
      subscribeRoleChanges(data.session.user.id);
    });

    const { data: listener } = adminAuthService.onAuthStateChange(async (event, session) => {
      if (!session) {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        subscribedUserId = null;
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const role = await fetchRole(session.user.id);
        set({
          status: role ? 'authenticated' : 'unauthorized',
          session,
          user: session.user,
          platformRole: role,
        });
        subscribeRoleChanges(session.user.id);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  },
}));