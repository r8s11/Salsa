import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The anonymous read path does not touch the raw tables. Since
 * 20260915000000_lock_down_raw_public_tables.sql, `anon` has no SELECT on
 * public.events or public.profiles at all, so every public page reads a
 * projection view instead (src/features/events/api/eventsRepo.ts).
 *
 * A projection the migrations never create is invisible in every database
 * built from this repo: `alter view` aborts the migration, and a client
 * SELECT against the missing relation fails, so an approved event never
 * becomes a public event page. These tests keep the projections part of the
 * tracked schema rather than hand-applied SQL-editor state.
 */

const MIGRATIONS_DIR = "supabase/migrations";

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8") }));

const schema = migrations.map((migration) => migration.sql).join("\n");

/** Relations the migrations consume but never define are the failure mode. */
function referencedProjections(): string[] {
  const names = new Set<string>();
  for (const { sql } of migrations) {
    for (const match of sql.matchAll(/alter\s+view\s+public\.(\w+)/gi)) names.add(match[1]);
    for (const match of sql.matchAll(/grant\s+select\s+on\s+table\s+public\.(public_\w+)/gi)) {
      names.add(match[1]);
    }
  }
  return [...names];
}

function creationIndex(view: string): number {
  // Some migrations create their view unqualified, relying on search_path.
  return migrations.findIndex(({ sql }) =>
    new RegExp(`create\\s+(or\\s+replace\\s+)?view\\s+(public\\.)?${view}\\b`, "i").test(sql)
  );
}

function firstUseIndex(view: string): number {
  return migrations.findIndex(({ sql }) =>
    new RegExp(`(alter\\s+view|grant\\s+select\\s+on\\s+table)\\s+public\\.${view}\\b`, "i").test(
      sql
    )
  );
}

describe("public projection views", () => {
  it("creates every projection the migrations alter or grant", () => {
    const missing = referencedProjections().filter((view) => creationIndex(view) === -1);
    expect(missing).toEqual([]);
  });

  it("creates each projection no later than the migration that alters it", () => {
    const outOfOrder = referencedProjections().filter((view) => {
      const created = creationIndex(view);
      return created === -1 || created > firstUseIndex(view);
    });
    expect(outOfOrder).toEqual([]);
  });

  it("exposes public_events taxonomy in the shape the client projects", () => {
    // projectEventTaxonomy() reads `event_taxonomy_terms` with a nested
    // `taxonomy_terms` object; without it the public detail page renders no
    // dance-style or attribute chips.
    expect(schema).toMatch(/as\s+event_taxonomy_terms/i);
    expect(schema).toMatch(/'taxonomy_term_id'/);
  });

  it("keeps submitter contact details out of the public event projection", () => {
    const start = schema.search(/create\s+(or\s+replace\s+)?view\s+public\.public_events\b/i);
    expect(start).toBeGreaterThan(-1);
    const body = schema.slice(start, schema.indexOf(";", start));
    expect(body).not.toMatch(/submitter_email/);
    expect(body).not.toMatch(/submitter_name/);
  });
});
