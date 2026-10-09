# Key End-to-End Flows

## Merchant onboarding
Sign up -> verify -> create org -> country/timezone -> Google OAuth -> location selection -> Brand Brain -> synthetic test -> server-derived READY -> dashboard.

## Review response
Sync/provider fetch -> workflow metadata -> user opens review -> generate -> language/risk/Brand Brain/rules -> structured AI draft -> validator/guards -> edit/regenerate -> approve exact version -> publish preflight/re-fetch -> Google update -> reconcile -> workflow/audit/usage/notification.

## Google reconnect
Health/token failure -> ATTENTION_REQUIRED -> stop affected jobs -> notify authorized users -> OAuth reconnect -> replace credentials atomically -> revalidate mappings -> resume -> audit.

## Billing purchase
Published plan/add-on refs -> backend resolves market/currency/eligibility/price -> hosted checkout -> verified webhook/provider reconcile -> subscription/add-ons -> EntitlementService -> portal state. Success redirect alone never activates access.

## Privacy deletion
Request/reauth/authority -> determine applicable rules -> deletion tasks by category/provider -> legal-hold/retention decisions -> provider reconciliation -> deletion ledger -> fulfillment only after reconciliation.

## Disaster restore
Incident -> isolated restore -> schema/config -> deletion ledger/legal holds -> provider reconciliation -> RLS/integrity/smoke -> worker side-effect safety -> traffic reopen -> audit.
