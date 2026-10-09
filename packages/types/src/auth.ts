import type { UUID, HumanRefId, ISOTimestamp } from './common';

export type UserStatus = 'active' | 'suspended' | 'pending_verification';

export interface UserProfile {
  id: UUID;
  refId: HumanRefId; // e.g. USR-00001
  email: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface AuthSession {
  userId: UUID;
  accessToken: string;
  expiresAt: ISOTimestamp;
}

/** Payload for signup form */
export interface SignupPayload {
  email: string;
  password: string;
  displayName: string;
}

/** Payload for login form */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Payload for password reset request */
export interface ForgotPasswordPayload {
  email: string;
}

/** Payload for password update (after reset link) */
export interface ResetPasswordPayload {
  password: string;
}
