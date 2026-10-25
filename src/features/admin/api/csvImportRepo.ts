import { supabase } from "../../../lib/supabase";
import type { AdminEventPayload } from "../../events/api/eventsRepo";
import { replaceEventTaxonomyTerms } from "./taxonomyRepo";
import { searchVenues } from "./venuesRepo";

/** Reuses the same fuzzy venue search the event form's combobox uses, but
 * only links a venue_id on an exact, unambiguous case-insensitive name
 * match — never auto-links to a "close enough" venue, since a wrong link
 * is worse than no link (the free-text location/address columns still
 * work fine with venue_id left null). */
export async function resolveVenueIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const rows = await searchVenues(trimmed, 5).catch(() => []);
  const exact = rows.find((venue) => venue.name.trim().toLowerCase() === trimmed.toLowerCase());
  return exact?.id ?? null;
}

export interface ImportRowOutcome {
  rowNumber: number;
  title: string;
  outcome: "created" | "failed";
  error?: string;
}

export interface ImportBatchSummary {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  rows: ImportRowOutcome[];
}

/**
 * Inserts each row individually (not one multi-row INSERT) so a single bad
 * row can't roll back an entire batch — Postgres treats one multi-row
 * INSERT as a single statement/transaction, and this feature's whole point
 * is accurate per-row partial-success reporting. Matches the existing
 * createEventAsAdmin insert shape exactly (status "approved", same
 * taxonomy-linking follow-up call) with source_type "imported" instead of
 * "admin" — the enum value the schema already reserves for exactly this.
 */
export async function importCsvRows(
  rows: { rowNumber: number; payload: AdminEventPayload }[],
  importer: { id: string; email: string | null },
  filename: string,
  totalRowsInFile: number,
  duplicateSkippedCount: number
): Promise<ImportBatchSummary> {
  const outcomes: ImportRowOutcome[] = [];

  for (const { rowNumber, payload } of rows) {
    const { taxonomy_term_ids, ...eventPayload } = payload;
    const { data, error } = await supabase
      .from("events")
      .insert({
        ...eventPayload,
        status: "approved",
        source_type: "imported",
        submitter_id: importer.id,
        submitter_email: importer.email,
        submitter_name: "Salsa Segura",
      })
      .select("id")
      .single();

    if (error) {
      outcomes.push({ rowNumber, title: payload.title, outcome: "failed", error: error.message });
      continue;
    }

    if (taxonomy_term_ids.length > 0) {
      try {
        await replaceEventTaxonomyTerms(data.id, taxonomy_term_ids);
      } catch {
        // Event exists but taxonomy linking failed — matches the same
        // non-atomic risk createEventAsAdmin already has today (a second,
        // separate call after the insert). Reported as created, not
        // failed, since the event itself is real; not swallowed silently.
      }
    }

    outcomes.push({ rowNumber, title: payload.title, outcome: "created" });
  }

  const createdCount = outcomes.filter((o) => o.outcome === "created").length;
  const failedCount = outcomes.filter((o) => o.outcome === "failed").length;

  // Best-effort audit row — never blocks the import result the moderator
  // already sees if this particular insert has a problem.
  try {
    await supabase.from("event_import_batches").insert({
      imported_by: importer.id,
      filename,
      total_rows: totalRowsInFile,
      created_count: createdCount,
      duplicate_skipped_count: duplicateSkippedCount,
      failed_count: failedCount,
    });
  } catch {
    // no-op — see comment above
  }

  return { totalRows: totalRowsInFile, createdCount, failedCount, rows: outcomes };
}
