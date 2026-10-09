# Internal Admin

## Navigation
Dashboard, Organizations, Businesses, Locations, Customers, Users, Roles & Permissions, Regions, Countries, Currencies, Exchange Rates, Subscriptions, Billing, Payments, Refunds, Reports, AI Management, Google Integrations, Support, System Logs, Audit Logs, Compliance, System Settings.

## Operations
Action Required surfaces disconnected Google, pending refunds, expiring subscriptions, failed payments, critical integration issues. Org 360: Overview, Users, Locations, Google, AI Activity, Subscription, Billing, Refunds, Activity, Audit, Support. Global search supports org/customer/email/location/reference ID without existence leakage.

## Safety
No password access. Restrictions require reason/audit. Internal notes never leak to customer/AI. Impersonation is permissioned/audited. Google troubleshooting is sanitized. System health shows real integration/job/cache state. DLQ retry is safe and permissioned.

## Financial/admin workflows
Refund lifecycle REQUESTED -> UNDER_REVIEW -> APPROVED/REJECTED -> PROCESSING -> REFUNDED/FAILED. Approval is not provider completion. Final Super Admin protections apply.
