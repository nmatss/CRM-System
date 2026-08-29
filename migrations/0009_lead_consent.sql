-- Migration 0009 — Recorded consent for public lead capture
--
-- LGPD: the lawful basis for holding a lead's personal data is the consent the
-- visitor gave. Storing when it was given, and against which policy version,
-- turns that basis into a record instead of an assumption.
--
-- Additive only. Existing rows keep NULL, which is the truthful value: consent
-- was not captured for them and the application must not claim otherwise.
--
-- Rollback/containment: dropping the columns would rewrite tables an older
-- binary still reads, so containment is simply to stop writing them.

PRAGMA foreign_keys = ON;

BEGIN;

ALTER TABLE contact_requests ADD COLUMN consent_accepted_at TEXT;
ALTER TABLE contact_requests ADD COLUMN consent_policy_version TEXT;

ALTER TABLE demo_requests ADD COLUMN consent_accepted_at TEXT;
ALTER TABLE demo_requests ADD COLUMN consent_policy_version TEXT;

INSERT OR IGNORE INTO schema_migrations (version, description)
VALUES ('0009', 'Recorded consent for public lead capture');

COMMIT;
