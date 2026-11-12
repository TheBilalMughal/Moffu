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
    let active = true; // set to false on cleanup; guards async callbacks from the unmounted run
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let subscribedUserId: string | null = null;

    function subscribeRoleChanges(userId: string) {
      if (!active) return;
      if (subscribedUserId === userId) return; // already watching this user
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
      subscribedUserId = userId;
      // Use a unique suffix so the channel name never collides with a channel
      // from a previous initialize() call that hasn't fully torn down yet
      // (triggered by React Strict Mode double-invoking effects in development).
      const name = `platform_member_role_${userId}_${Date.now()}`;
      realtimeChannel = supabase
        .channel(name)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'platform_members', filter: `user_id=eq.${userId}` },
          async () => {
            if (!active) return;
            const role = await fetchRole(userId);
            if (!active) return;
            set(() => ({
              platformRole: role,
              status: role ? 'authenticated' : 'unauthorized',
            }));
          },
        )
        .subscribe();
    }

    adminAuthService.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }
      const role = await fetchRole(data.session.user.id);
      if (!active) return;
      set({
        status: role ? 'authenticated' : 'unauthorized',
        session: data.session,
        user: data.session.user,
        platformRole: role,
      });
      subscribeRoleChanges(data.session.user.id);
    });

    const { data: listener } = adminAuthService.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (!session) {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        subscribedUserId = null;
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const role = await fetchRole(session.user.id);
        if (!active) return;
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
      active = false;
      listener.subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    };
  },
}));