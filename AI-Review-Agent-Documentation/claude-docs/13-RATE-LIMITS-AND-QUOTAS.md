# Rate Limits, Quotas and Abuse Protection

Separate business entitlements, technical rate limits, provider hard ceilings, concurrency, abuse/security controls and job throttles.

Central server-side RateLimitService/QuotaPolicyService supports hierarchical policy scopes and atomic distributed counters. Most-specific valid override applies, but explicit deny/security/provider ceilings win. Temporary overrides expire automatically and are audited.

Protect auth, AI generation, Google sync/publish, billing/refunds/webhooks, email, exports, storage/support/public forms and queues. Distinguish `USAGE_LIMIT_REACHED`, `ENTITLEMENT_REQUIRED`, `RATE_LIMITED`, provider quota and service degradation. IP is context, not sole identity.

Usage accounting is separate from rate counters. Costly billable operations reserve -> commit/release atomically; failed/duplicate/blocked operations are not accidentally billed. Commercial quotas never block legally required privacy workflows.

Exact numeric thresholds are configuration/TBD and current provider docs; never invent them.
