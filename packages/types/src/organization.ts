import type { UUID, HumanRefId, ISOTimestamp, CountryCode, Timezone, CurrencyCode } from './common';

export type OrgStatus = 'active' | 'suspended' | 'onboarding';

export interface Organization {
  id: UUID;
  refId: HumanRefId; // e.g. ORG-00001
  name: string;
  slug: string;
  status: OrgStatus;
  countryCode?: CountryCode;
  timezone?: Timezone;
  currencyCode?: CurrencyCode;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export type MemberRole = 'owner' | 'admin' | 'manager' | 'viewer';

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface OrgMember {
  id: UUID;
  orgId: UUID;
  userId: UUID;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: ISOTimestamp;
  invitedAt?: ISOTimestamp;
}

export interface Invitation {
  id: UUID;
  refId: HumanRefId;
  orgId: UUID;
  email: string;
  role: MemberRole;
  token: string;
  expiresAt: ISOTimestamp;
  acceptedAt?: ISOTimestamp;
  createdAt: ISOTimestamp;
}
