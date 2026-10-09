# Storage, Support and Privacy

## Storage
Supabase Storage behind StorageService. DB metadata + object storage. Purpose-specific private areas for org assets, exports, support attachments, imports, temp/internal files. Upload intent -> authorization/type/size/quota -> upload -> server verification -> validation -> AVAILABLE. Short-lived signed downloads. Opaque keys. Scanner-ready but no fake scanning claim.

## Support
Real ticket system plus Help Center. Tickets have SUP references, categories, status OPEN/IN_PROGRESS/WAITING_ON_CUSTOMER/WAITING_ON_SUPPORT/RESOLVED/CLOSED, priority and assignment. Messages support customer-visible vs internal notes. Internal notes never customer/email/AI/export. Portal replies only V1; reply-by-email future.

## Privacy/Data rights
Separate account deletion, leave org, close org, formal privacy request and Google disconnect. Jurisdiction-aware PrivacyPolicyEngine initially architecture-ready for Australia, Canada/provinces and US/states including California. Rights are exposed only where applicable; no false GDPR-style universal deletion promise.

Privacy requests have PRV references, identity/authority verification, scoped exports, category-aware deletion/de-identification, legal holds and provider reconciliation. Deletion ledger prevents resurrection after restore.
