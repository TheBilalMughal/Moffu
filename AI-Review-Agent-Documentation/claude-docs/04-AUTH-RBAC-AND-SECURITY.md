# Auth, RBAC and Security

## Auth
Supabase Auth supports signup, email verification/resend, login, forgot/reset password, change password, logout, refresh/expiry, invalid links, profile, session revocation where supported, invitations and suspended states.

## Customer roles
Owner/Admin/Manager/Viewer + Custom. Permissions are granular (`reviews.generate`, `reviews.approve`, `reviews.publish`, `reports.export`, `google.connect`, etc.) and may be location-scoped.

## Platform roles
Super Admin/Admin/Finance/Support/Operations/Viewer + Custom. Platform roles are strictly separate from organization roles.

## Resolution
Base role + custom role + user override + region scope + org/location scope -> final permission. Explicit DENY wins. UI visibility is convenience only; backend/RLS are authority.

## Security
No secrets in frontend/URLs/logs. Safe 403/404. CSRF/CORS/session protections appropriate to auth transport. Sensitive admin actions require confirmation/reason/audit; impersonation requires permission, persistent banner, actual/effective actor audit and restrictions on sensitive areas.
