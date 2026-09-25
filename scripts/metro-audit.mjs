#!/usr/bin/env node
// Run only with the provisioned, verified salsa_dev_readonly role. Never use a
// production owner, service key, or a write-capable connection for this audit.
import { execFileSync } from "node:child_process";

const connection = process.env.SUPABASE_DEV_READONLY_DATABASE_URL;
if (!connection) {
  console.error("Set SUPABASE_DEV_READONLY_DATABASE_URL in this worktree's local environment.");
  process.exit(1);
}
let url;
try {
  url = new URL(connection);
} catch {
  console.error("Invalid read-only database URL.");
  process.exit(1);
}
if (!/^postgres(ql)?:$/.test(url.protocol) ||
    !/^salsa_dev_readonly(?:\.[a-z0-9_-]+)?$/.test(decodeURIComponent(url.username))) {
  console.error("Database URL must use the salsa_dev_readonly role.");
  process.exit(1);
}

const sql = `
BEGIN READ ONLY;
SELECT current_user AS connected_role, current_setting('transaction_read_only') AS read_only;
SELECT city, count(*) AS public_rows,
       count(*) FILTER (WHERE event_date >= now()) AS upcoming,
       min(event_date) FILTER (WHERE event_date >= now()) AS first_upcoming,
       max(event_date) FILTER (WHERE event_date >= now()) AS last_upcoming,
       count(*) FILTER (WHERE address IS NOT NULL AND btrim(address) <> '') AS with_address,
       count(*) FILTER (WHERE venue_id IS NOT NULL) AS with_venue
FROM public.public_events GROUP BY city ORDER BY city;
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'public_events'
 AND column_name IN ('timezone','latitude','longitude','state_region','address','venue_id')
 ORDER BY column_name;
ROLLBACK;
`;
try {
  execFileSync("psql", ["--no-psqlrc", "--set=ON_ERROR_STOP=1", "--command", sql], {
    stdio: "inherit",
    env: { ...process.env, PGDATABASE: connection, PGOPTIONS: "-c default_transaction_read_only=on" },
  });
} catch {
  console.error("Audit failed. Check read-only role privileges and psql availability.");
  process.exit(1);
}
