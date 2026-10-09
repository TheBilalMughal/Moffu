# Jobs, Notifications and Email

## Durable jobs
GOOGLE_REVIEW_SYNC, LOCATION_SYNC, CONNECTION_HEALTH, NEW_REVIEW_PROCESSING, AI_GENERATION_ASYNC, NOTIFICATION_DISPATCH, EMAIL_DISPATCH, CACHE_CLEANUP, INVITATION_EXPIRY, OAUTH_STATE_CLEANUP, USAGE_AGGREGATION, INTEGRATION_RETRY, REPORT/PRIVACY_EXPORT, RETENTION_CLEANUP and future billing reconciliation.

States: PENDING/SCHEDULED/PROCESSING/RETRYING/COMPLETED/FAILED/DEAD_LETTER/CANCELLED. Use atomic leases, at-least-once/idempotent handling, bounded retry/backoff, dedupe, fair/provider-aware throttling and visible DLQ.

## Notifications
V1 channels IN_APP + EMAIL. Recipient resolution rechecks active membership, permission, location scope and preferences at dispatch. Critical security/integration events may be non-disableable. Deep links require auth.

## Email
V1 provider Resend behind EmailProvider. Versioned/localized templates; verified domain/SPF/DKIM/DMARC required before CONFIGURED. Track safe delivery metadata and verified idempotent webhooks. Transactional email is separate from marketing consent. Email failure never rolls back core action.
