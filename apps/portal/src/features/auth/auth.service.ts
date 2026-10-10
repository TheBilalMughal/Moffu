/**
 * Auth service for the customer portal.
 * Wraps Supabase Auth — all auth state flows through here.
 * No direct Supabase calls in React components.
 */
import { supabase } from '@/lib/supabase';
import type {
  SignupPayload,
  LoginPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
} from '@moffu/types';
import { env } from '@/lib/env';

export type AuthServiceError = {
  code: string;
  message: string;
};

function toServiceError(err: unknown): AuthServiceError {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message: string; code?: string; status?: number };
    // Normalize Supabase auth error messages to avoid leaking internal details
    if (e.message?.includes('Invalid login credentials')) {
      return { code: 'invalid_credentials', message: 'Incorrect email or password.' };
    }
    if (e.message?.includes('Email not confirmed')) {
      return { code: 'email_not_confirmed', message: 'Please verify your email address.' };
    }
    if (e.message?.includes('User already registered')) {
      return { code: 'email_taken', message: 'An account with this email already exists.' };
    }
    if (e.message?.includes('over_email_send_rate_limit') || e.message?.includes('rate limit')) {
      return { code: 'rate_limited', message: 'Too many requests. Please wait a moment.' };
    }
    return { code: e.code ?? 'auth_error', message: e.message };
  }
  return { code: 'unknown_error', message: 'An unexpected error occurred.' };
}

export const authService = {
  async signup(payload: SignupPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: { display_name: payload.displayName },
        emailRedirectTo: `${env.appUrl}/auth/verify`,
      },
    });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async login(payload: LoginPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async logout(): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo: `${env.appUrl}/auth/reset-password`,
    });
    if (error) return { error: toServiceError(error) };
    // Always return success to avoid email enumeration
    return {};
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async resendVerification(email: string): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${env.appUrl}/auth/verify` },
    });
    if (error) return { error: toServiceError(error) };
    return {};
  },

  async loginWithGoogle(): Promise<{ error?: AuthServiceError }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${env.appUrl}/dashboard` },
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
