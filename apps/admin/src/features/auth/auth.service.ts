/**
 * Auth service for the admin portal.
 * Platform-level auth — only platform_members can access admin.
 * Checks platform role after login; unauthorized users are rejected.
 */
import { supabase } from '@/lib/supabase';
import type { LoginPayload, ResetPasswordPayload } from '@moffu/types';

export type AuthServiceError = {
  code: string;
  message: string;
};

function toServiceError(err: unknown): AuthServiceError {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message: string; code?: string };
    if (e.message?.includes('Invalid login credentials')) {
      return { code: 'invalid_credentials', message: 'Incorrect email or password.' };
    }
    return { code: e.code ?? 'auth_error', message: e.message };
  }
  return { code: 'unknown_error', message: 'An unexpected error occurred.' };
}

export const adminAuthService = {
  async login(payload: LoginPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async forgotPassword(email: string): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  getSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
