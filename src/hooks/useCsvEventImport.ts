import { useCallback, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { useActiveTaxonomyTerms } from "../features/admin/hooks/useAdminTaxonomy";
import { parseCsvFile } from "../features/admin/model/csvImportParse";
import { validateCsvRow, type CsvRowResult } from "../features/admin/model/csvImportValidation";
import {
  findCsvRowDuplicates,
  type CsvDuplicateMatch,
} from "../features/admin/model/csvImportDuplicates";
import {
  importCsvRows,
  resolveVenueIdByName,
  type ImportBatchSummary,
} from "../features/admin/api/csvImportRepo";
import { fetchAllEvents } from "../features/events/api/eventsRepo";

export interface CsvRowWithDuplicates extends CsvRowResult {
  duplicates: CsvDuplicateMatch[];
}

export type ImportStage = "idle" | "processing" | "reviewing" | "importing" | "done";

export interface CsvRowStatusCounts {
  total: number;
  valid: number;
  warning: number;
  invalid: number;
}

/** The contract this hook exposes to AdminImportEventsPage. */
export interface CsvEventImportState {
  stage: ImportStage;
  fileName: string | null;
  fileSize: number | null;
  /** File-level rejection reasons (wrong type, missing columns, too many rows). */
  fileErrors: string[];
  rows: CsvRowWithDuplicates[];
  counts: CsvRowStatusCounts;
  /** Row numbers of duplicate-flagged rows the moderator explicitly opted to import. */
  includedDuplicates: Set<number>;
  toggleIncludeDuplicate: (rowNumber: number) => void;
  /** How many rows "Import Valid Events" would actually insert right now. */
  importableCount: number;
  excludedDuplicateCount: number;
  importResult: ImportBatchSummary | null;
  importError: string | null;
  handleFile: (file: File) => Promise<void>;
  runImport: () => Promise<void>;
  reset: () => void;
  taxonomyLoading: boolean;
}

export function useCsvEventImport(): CsvEventImportState {
  const { user } = useAuth();
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const eventAttributes = useActiveTaxonomyTerms("event_attribute");

  const [stage, setStage] = useState<ImportStage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRowWithDuplicates[]>([]);
  const [includedDuplicates, setIncludedDuplicates] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<ImportBatchSummary | null>(null);
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
    async (file: File) => {
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

      // Resolve venue_id for rows that named a venue and are otherwise clean.
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

      const existingEvents = await fetchAllEvents().catch(() => []);
      const withDuplicates: CsvRowWithDuplicates[] = withVenues.map((row) => {
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

  // A row is importable when it validated cleanly enough to produce a payload
  // AND it isn't a duplicate the moderator has left unchecked. Non-duplicate
  // warnings (an unmatched venue name, a skipped unknown taxonomy term) are
  // informational — they don't need a decision, so they import by default.
  const importableRows = rows.filter(
    (row) => row.payload && (row.duplicates.length === 0 || includedDuplicates.has(row.rowNumber))
  );
  const excludedDuplicateCount = rows.filter(
    (row) => row.duplicates.length > 0 && !includedDuplicates.has(row.rowNumber)
  ).length;

  const runImport = useCallback(async () => {
    if (!user || stage === "importing" || stage === "done" || importableRows.length === 0) return;
    setStage("importing");
    setImportError(null);
    try {
      const summary = await importCsvRows(
        importableRows.map((row) => ({ rowNumber: row.rowNumber, payload: row.payload! })),
        { id: user.id, email: user.email ?? null },
        fileName ?? "import.csv",
        rows.length,
        excludedDuplicateCount
      );
      setImportResult(summary);
      setStage("done");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
      setStage("reviewing");
    }
  }, [excludedDuplicateCount, fileName, importableRows, rows.length, stage, user]);

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
