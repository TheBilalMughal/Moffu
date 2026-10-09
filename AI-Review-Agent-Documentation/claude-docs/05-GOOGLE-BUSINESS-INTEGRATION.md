# Google Business Profile and Reviews

## OAuth/connect
Portal -> server auth/org/`google.connect` -> secure hashed state (+ PKCE where appropriate) -> Google consent (`business.manage`, recheck current docs) -> callback validation -> token exchange -> isolated secure credential storage -> accounts/locations -> explicit merchant selection -> mapping -> initial sync.

## Connection states
PENDING, CONNECTED, ATTENTION_REQUIRED, REFRESH_FAILED, REVOKED, DISCONNECTED, ERROR. Refresh is atomic. Reconnect preserves valid config and revalidates location access. Disconnect revokes/cleans credentials, stops jobs and audits.

## Review workflow
NEW -> DRAFTING -> DRAFT_READY -> AWAITING_APPROVAL -> NEEDS_ATTENTION / PUBLISHING -> PUBLISHED or PUBLISH_FAILED; source changes create STALE. Approval binds exact draft/version. Publish re-fetches current provider state, checks stale/risk/permission/scope, then calls provider. Direct Google edits win.

## Reliability
Publish attempts are idempotent. Ambiguous timeout -> query Google before retry. Categorize auth/access/quota/transient errors. Backoff/jitter/provider quotas. Google remains source of truth; provider content cache is temporary/policy-aware, not a permanent warehouse.

## Approval/compliance
V1 default is AI draft -> human edit/approve -> publish. Do not promise full auto-reply until current Google production approval/policy is verified. Future automation requires explicit merchant consent and high-risk manual handling.
