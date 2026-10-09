# Backup, Retention and Disaster Recovery

Backups and retention are separate. Central versioned retention policies classify account/org, first-party Brand Brain, provider cache, workflow/AI metadata, legal/consent, privacy, support, billing, usage, analytics, security/audit/system logs, notifications, files/exports, temp tokens/jobs, notes/config, backups/deletion ledger/legal holds.

Exact retention periods, backup schedule, PITR window and RPO/RTO are TBD/provider/business/legal decisions; never invent. Google-derived content remains policy-aware and not retained indefinitely for convenience.

Backups cover DB, object storage, critical configuration and infrastructure/migrations; provider capabilities must be verified. Secrets use secure recovery, not plaintext ordinary backups. Backup access is least privilege/audited.

Restore runbook: incident -> verified restore point -> isolated restore -> schema/config compatibility -> reapply deletion ledger/privacy suppressions/legal holds -> reconcile Google/billing/email/analytics -> integrity/RLS checks -> smoke tests -> resume workers only after side-effect safety -> reopen traffic -> post-incident audit.

Backups are only trusted after restore testing. Retention cleanup is durable/idempotent with backlog/failure visibility. Privacy-deleted data must not be resurrected from backups.
