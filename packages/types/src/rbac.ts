import type { UUID } from './common';

/**
 * Customer-facing permission keys.
 * These are checked server-side and in RLS; UI uses them for visibility only.
 */
export type CustomerPermission =
  | 'reviews.view'
  | 'reviews.generate'
  | 'reviews.edit'
  | 'reviews.approve'
  | 'reviews.publish'
  | 'reviews.reject'
  | 'brand_brain.view'
  | 'brand_brain.edit'
  | 'reports.view'
  | 'reports.export'
  | 'google.connect'
  | 'google.disconnect'
  | 'locations.view'
  | 'locations.manage'
  | 'team.view'
  | 'team.invite'
  | 'team.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'notifications.manage'
  | 'support.create'
  | 'privacy.request';

/**
 * Platform (internal admin) permission keys.
 * Strictly separate from customer permissions.
 */
export type PlatformPermission =
  | 'platform.orgs.view'
  | 'platform.orgs.manage'
  | 'platform.orgs.suspend'
  | 'platform.users.view'
  | 'platform.users.manage'
  | 'platform.users.suspend'
  | 'platform.impersonate'
  | 'platform.billing.view'
  | 'platform.billing.refund'
  | 'platform.support.view'
  | 'platform.support.manage'
  | 'platform.ai.view'
  | 'platform.google.debug'
  | 'platform.system.view'
  | 'platform.logs.view'
  | 'platform.config.manage'
  | 'platform.regions.manage';

export type PermissionEffect = 'allow' | 'deny';

export interface PermissionOverride {
  id: UUID;
  permission: CustomerPermission | PlatformPermission;
  effect: PermissionEffect;
  scopeOrgId?: UUID;
  scopeLocationId?: UUID;
}
