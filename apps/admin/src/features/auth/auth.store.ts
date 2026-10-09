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

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  platformRole: null,

  initialize() {
    adminAuthService.getSession().then(async ({ data }) => {
      if (!data.session) {
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }

      // Verify platform membership via DB (RLS will return null if not a platform member)
      const { data: member } = await supabase
        .from('platform_members')
        .select('role')
        .eq('user_id', data.session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      set({
        status: member ? 'authenticated' : 'unauthorized',
        session: data.session,
        user: data.session.user,
        platformRole: member?.role ?? null,
      });
    });

    const { data: listener } = adminAuthService.onAuthStateChange(async (event, session) => {
      if (!session) {
        set({ status: 'unauthenticated', session: null, user: null, platformRole: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: member } = await supabase
          .from('platform_members')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        set({
          status: member ? 'authenticated' : 'unauthorized',
          session,
          user: session.user,
          platformRole: member?.role ?? null,
        });
      }
    });

    return () => listener.subscription.unsubscribe();
  },
}));
