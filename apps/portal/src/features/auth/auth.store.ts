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
    // Rely solely on onAuthStateChange — it fires INITIAL_SESSION on startup
    // and correctly processes OAuth hash/PKCE code before resolving, so we
    // never flash 'unauthenticated' while the OAuth callback is in-flight.
    const { data: listener } = authService.onAuthStateChange((_event, session) => {
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
