import Papa from "papaparse";
import {
  CSV_ALL_KEYS,
  CSV_MAX_FILE_BYTES,
  CSV_MAX_ROWS,
  CSV_REQUIRED_KEYS,
} from "./csvImportTemplate";

export interface CsvParseResult {
  ok: boolean;
  /** Raw string cells, keyed by the CSV header. Only present when ok. */
  rows: Record<string, string>[];
  /** File-level problems (wrong type, missing/unexpected columns, too many rows). Any entry blocks validation entirely. */
  fileErrors: string[];
  /** Column headers present in the file but not part of the known schema — informational, not blocking. */
  unexpectedColumns: string[];
}

const ALLOWED_KEYS: Record<string, true> = Object.fromEntries(
  CSV_ALL_KEYS.map((key) => [key, true])
);

function fileErrorResult(fileErrors: string[]): CsvParseResult {
  return { ok: false, rows: [], fileErrors, unexpectedColumns: [] };
}

/**
 * Validates the file itself (type, size) and parses it with Papa Parse,
 * which handles quoted commas, escaped quotes, and UTF-8 correctly out of
 * the box (papaparse — the standard, well-maintained browser CSV parser;
 * this app had no CSV parser before this feature).
 */
export function parseCsvFile(file: File): Promise<CsvParseResult> {
  const nameIsCsv = file.name.toLowerCase().endsWith(".csv");
  const typeIsCsv =
    file.type === "" || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
  if (!nameIsCsv || !typeIsCsv) {
    return Promise.resolve(fileErrorResult(["File must be a .csv file."]));
  }
  if (file.size === 0) {
    return Promise.resolve(fileErrorResult(["File is empty."]));
  }
  if (file.size > CSV_MAX_FILE_BYTES) {
    const maxMb = (CSV_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    return Promise.resolve(fileErrorResult([`File is too large. Maximum size is ${maxMb} MB.`]));
  }

  return new Promise<CsvParseResult>((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      encoding: "utf-8",
      complete: (results) => {
        const headerRow = results.meta.fields ?? [];
        const missingRequired = CSV_REQUIRED_KEYS.filter((key) => !headerRow.includes(key));
        const unexpectedColumns = headerRow.filter((key) => !ALLOWED_KEYS[key]);

        const fileErrors: string[] = [];
        if (missingRequired.length > 0) {
          fileErrors.push(
            `Missing required column${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`
          );
        }
        if (results.data.length === 0) {
          fileErrors.push("No event rows found below the header row.");
        }
        if (results.data.length > CSV_MAX_ROWS) {
          fileErrors.push(
            `File has ${results.data.length} rows. Maximum supported is ${CSV_MAX_ROWS} per upload — split into multiple files.`
          );
        }
        // Malformed CSV structure Papa Parse itself couldn't recover from
        // (as opposed to per-field content problems, which are validated
        // separately in csvImportValidation.ts).
        const structuralErrors = results.errors.filter((e) => e.type !== "FieldMismatch");
        for (const err of structuralErrors) {
          fileErrors.push(
            `Could not read the file (${err.message}). Please re-export it as CSV and try again.`
          );
        }

        if (fileErrors.length > 0) {
          resolve({ ok: false, rows: [], fileErrors, unexpectedColumns });
          return;
        }

        resolve({ ok: true, rows: results.data, fileErrors: [], unexpectedColumns });
      },
      error: (err) => {
        resolve(fileErrorResult([`Could not read the file (${err.message}).`]));
      },
    });
  });
}
