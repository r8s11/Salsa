import { useCallback, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { useActiveTaxonomyTerms } from "../features/admin/hooks/useAdminTaxonomy";
import { parseCsvFile } from "../features/admin/model/csvImportParse";
import { validateCsvRow, type CsvRowResult } from "../features/admin/model/csvImportValidation";
import {
  findCsvRowDuplicates,
  type CsvDuplicateMatch,
} from "../features/admin/model/csvImportDuplicates";
import { searchVenues } from "../features/admin/api/venuesRepo";
import {
  createOrganizerEvent,
  fetchOrganizerEvents,
} from "../features/host/api/organizerAccessRepo";
import type { OrganizerEventCreatePayload } from "../features/host/api/organizerAccessRepo";

/* ── Types ── */

export type HostImportStage = "idle" | "processing" | "reviewing" | "importing" | "done";

export interface HostCsvRowWithDuplicates extends CsvRowResult {
  duplicates: CsvDuplicateMatch[];
}

export interface HostCsvRowStatusCounts {
  total: number;
  valid: number;
  warning: number;
  invalid: number;
}

export interface HostImportRowOutcome {
  rowNumber: number;
  title: string;
  outcome: "created" | "failed";
  error?: string;
}

export interface HostImportBatchSummary {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  rows: HostImportRowOutcome[];
}

export interface HostCsvEventImportState {
  stage: HostImportStage;
  fileName: string | null;
  fileSize: number | null;
  fileErrors: string[];
  rows: HostCsvRowWithDuplicates[];
  counts: HostCsvRowStatusCounts;
  includedDuplicates: Set<number>;
  toggleIncludeDuplicate: (rowNumber: number) => void;
  importableCount: number;
  excludedDuplicateCount: number;
  importResult: HostImportBatchSummary | null;
  importError: string | null;
  handleFile: (file: File, organizerId: string) => Promise<void>;
  runImport: (organizerId: string) => Promise<void>;
  reset: () => void;
  taxonomyLoading: boolean;
}

/* ── Helpers ── */

async function resolveVenueIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const rows = await searchVenues(trimmed, 5).catch(() => []);
  const exact = rows.find((venue) => venue.name.trim().toLowerCase() === trimmed.toLowerCase());
  return exact?.id ?? null;
}

function toHostPayload(row: CsvRowResult): OrganizerEventCreatePayload {
  const p = row.payload!;
  return {
    title: p.title,
    description: p.description || null,
    event_type: p.event_type,
    city: p.city,
    event_date: p.event_date,
    event_time: p.event_time || null,
    location: p.location || null,
    address: p.address || null,
    price_type: p.price_type || null,
    price_amount: p.price_amount ? Number(p.price_amount) : null,
    rsvp_link: p.rsvp_link || null,
    host: p.host || null,
    image_url: p.image_url || null,
    recurrence: p.recurrence || null,
    contact_email: p.contact_email || null,
    contact_instagram: p.contact_instagram || null,
    contact_website: p.contact_website || null,
    dance_styles: row.danceStyleNames,
    venue_id: null,
  };
}

/* ── Hook ── */

export function useHostEventImport(): HostCsvEventImportState {
  const { user } = useAuth();
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const eventAttributes = useActiveTaxonomyTerms("event_attribute");

  const [stage, setStage] = useState<HostImportStage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<HostCsvRowWithDuplicates[]>([]);
  const [includedDuplicates, setIncludedDuplicates] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<HostImportBatchSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setFileName(null);
    setFileSize(null);
    setFileErrors([]);
    setRows([]);
    setIncludedDuplicates(new Set());
    setImportResult(null);
    setImportError(null);
  }, []);

  const handleFile = useCallback(
    async (file: File, organizerId: string) => {
      reset();
      setFileName(file.name);
      setFileSize(file.size);
      setStage("processing");

      const parsed = await parseCsvFile(file);
      if (!parsed.ok) {
        setFileErrors(parsed.fileErrors);
        setStage("idle");
        return;
      }

      const validated = parsed.rows.map((raw, index) =>
        validateCsvRow(raw, index, danceStyles.terms, eventAttributes.terms)
      );

      const withVenues = await Promise.all(
        validated.map(async (row) => {
          if (!row.payload || !row.venueName.trim()) return row;
          const venueId = await resolveVenueIdByName(row.venueName);
          if (venueId) {
            return { ...row, payload: { ...row.payload, venue_id: venueId } };
          }
          return {
            ...row,
            warnings: [
              ...row.warnings,
              {
                field: "venue_name",
                message: `No existing venue matched "${row.venueName}" — imported using location/address text only.`,
              },
            ],
            status: row.status === "valid" ? ("warning" as const) : row.status,
          };
        })
      );

      const existingEvents = await fetchOrganizerEvents(organizerId).catch(() => []);

      const withDuplicates: HostCsvRowWithDuplicates[] = withVenues.map((row) => {
        const duplicates = findCsvRowDuplicates(row, existingEvents);
        if (duplicates.length === 0) return { ...row, duplicates };
        return {
          ...row,
          duplicates,
          warnings: [
            ...row.warnings,
            {
              field: "duplicate",
              message: `Possible duplicate — matches an existing event: "${duplicates[0].event.title}".`,
            },
          ],
          status: row.status === "valid" ? ("warning" as const) : row.status,
        };
      });

      setRows(withDuplicates);
      setStage("reviewing");
    },
    [danceStyles.terms, eventAttributes.terms, reset]
  );

  const toggleIncludeDuplicate = useCallback((rowNumber: number) => {
    setIncludedDuplicates((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  const counts = {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    warning: rows.filter((r) => r.status === "warning").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
  };

  const importableRows = rows.filter(
    (row) => row.payload && (row.duplicates.length === 0 || includedDuplicates.has(row.rowNumber))
  );
  const excludedDuplicateCount = rows.filter(
    (row) => row.duplicates.length > 0 && !includedDuplicates.has(row.rowNumber)
  ).length;

  const runImport = useCallback(
    async (organizerId: string) => {
      if (!user || stage === "importing" || stage === "done" || importableRows.length === 0) return;
      setStage("importing");
      setImportError(null);
      try {
        const outcomes: HostImportRowOutcome[] = [];
        for (const row of importableRows) {
          try {
            const payload = toHostPayload(row);
            await createOrganizerEvent(organizerId, payload, false);
            outcomes.push({ rowNumber: row.rowNumber, title: row.payload!.title, outcome: "created" });
          } catch (err) {
            outcomes.push({
              rowNumber: row.rowNumber,
              title: row.payload!.title,
              outcome: "failed",
              error: err instanceof Error ? err.message : "Import failed",
            });
          }
        }

        const createdCount = outcomes.filter((o) => o.outcome === "created").length;
        const failedCount = outcomes.filter((o) => o.outcome === "failed").length;

        setImportResult({
          totalRows: rows.length,
          createdCount,
          failedCount,
          rows: outcomes,
        });
        setStage("done");
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import failed.");
        setStage("reviewing");
      }
    },
    [importableRows, rows.length, stage, user]
  );

  return {
    stage,
    fileName,
    fileSize,
    fileErrors,
    rows,
    counts,
    includedDuplicates,
    toggleIncludeDuplicate,
    importableCount: importableRows.length,
    excludedDuplicateCount,
    importResult,
    importError,
    handleFile,
    runImport,
    reset,
    taxonomyLoading: danceStyles.isLoading || eventAttributes.isLoading,
  };
}
