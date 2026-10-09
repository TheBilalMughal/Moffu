/**
 * Auth state store (Zustand).
 * Single source of truth for session state across the portal.
 */
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { authService } from './auth.service';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  _initialized: boolean;
  initialize: () => () => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  _initialized: false,

  initialize() {
    // Load current session, then subscribe to changes
    authService.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        status: data.session ? 'authenticated' : 'unauthenticated',
        _initialized: true,
      });
    });

    const { data: listener } = authService.onAuthStateChange(async (_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'authenticated' : 'unauthenticated',
        _initialized: true,
      });
    });

    return () => listener.subscription.unsubscribe();
  },

  setSession(session) {
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    });
  },
}));
