-- OPTIONAL AND DESTRUCTIVE — Phase 10 post-deploy cleanup.
-- Run manually only after the deployed application reads/writes event_taxonomy_terms
-- and the verification query in 004 shows matching relationship counts.
-- Do not combine this file with schema creation or the data migration.

alter table public.events drop column if exists dance_styles;
