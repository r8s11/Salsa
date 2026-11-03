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

const itineraryMigration = () =>
  migrations.find(({ name }) => name === "20261103120000_weekly_itineraries.sql")?.sql ?? "";

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

  it("publishes only published itineraries, without curator identity", () => {
    const sql = itineraryMigration();
    const start = sql.search(/create\s+or\s+replace\s+view\s+public\.public_itineraries\b/i);
    const body = sql.slice(start, sql.indexOf(";", start));
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/where\s+status\s*=\s*'published'/i);
    expect(body).not.toMatch(/created_by|updated_by|cover_generated_at/);
  });

  it("exposes itinerary items only for public events of published itineraries", () => {
    const sql = itineraryMigration();
    const start = sql.search(/create\s+or\s+replace\s+view\s+public\.public_itinerary_items\b/i);
    const body = sql.slice(start, sql.indexOf(";", start));
    expect(body).toMatch(/join\s+public\.public_itineraries\s+itinerary/i);
    expect(body).toMatch(/join\s+public\.public_events\s+event/i);
    expect(body).not.toMatch(/\bpublic\.events\b/);
  });

  it("gates every itinerary RPC on the moderator role", () => {
    const sql = itineraryMigration();
    for (const fn of ["save_itinerary", "set_itinerary_status", "set_itinerary_cover"]) {
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`,
          "i"
        )
      );
    }
    expect(sql.match(/not public\.is_moderator\(\)/gi)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/to\s+anon[^;]*itineraries\s/i);
  });

  it("assigns after-midnight starts to the previous dance night", () => {
    expect(itineraryMigration()).toMatch(/at time zone p_tz\)\s*-\s*interval '5 hours'\)::date/i);
  });

  it("keeps a published itinerary's place and contents intact on save", () => {
    const sql = itineraryMigration();
    const start = sql.search(/create\s+or\s+replace\s+function\s+public\.save_itinerary\b/i);
    const save = sql.slice(start, sql.indexOf("end $$", start));
    expect(start).toBeGreaterThan(-1);
    for (const column of ["city", "week_start", "time_zone"]) {
      expect(save).toMatch(new RegExp(`is\\s+distinct\\s+from\\s+v_current\\.${column}\\b`, "i"));
    }
    expect(save).toMatch(/'Unpublish before changing the city or week'/);
    expect(save).toMatch(/'Published itineraries need at least one event'/);
  });

  it("leaves the raw itinerary tables read-only for active curators", () => {
    const sql = itineraryMigration();
    expect(sql).not.toMatch(
      /grant\s[^;]*\b(insert|update|delete|all)\b[^;]*\bon\s+table\s+public\.(itineraries|itinerary_items)\b/i
    );
    const policies =
      sql.match(
        /create\s+policy\s+"[^"]+"\s+on\s+public\.(itineraries|itinerary_items)\b[^;]*;/gi
      ) ?? [];
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy).toMatch(/for\s+select\b/i);
      expect(policy).not.toMatch(/for\s+(all|insert|update|delete)\b/i);
      expect(policy).toMatch(/public\.account_is_active\(auth\.uid\(\)\)/i);
    }
  });

  it("lets only active curators write itinerary covers", () => {
    const policies =
      itineraryMigration().match(/create\s+policy\s+"[^"]+"\s+on\s+storage\.objects\b[^;]*;/gi) ??
      [];
    expect(policies.length).toBeGreaterThanOrEqual(3);
    for (const policy of policies) {
      expect(policy).toMatch(/bucket_id\s*=\s*'itinerary-covers'/i);
      expect(policy).toMatch(/public\.is_moderator\(\)/i);
      expect(policy).toMatch(/public\.account_is_active\(auth\.uid\(\)\)/i);
    }
  });
});
