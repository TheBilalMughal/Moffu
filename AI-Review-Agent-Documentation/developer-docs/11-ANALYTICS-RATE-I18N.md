# Analytics, Rate Limits and i18n

Customer reporting uses internal provider-policy-aware metrics; PostHog is product analytics only. Metric/event keys are stable and untranslated. Rate limiting is separate from commercial entitlements and provider ceilings; distributed atomic enforcement protects auth, AI, Google, billing, email, exports and queues. i18n separates UI locale from review/reply language, country, currency, timezone and jurisdiction. Unicode end-to-end; RTL is readiness, not a support claim until QA.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
