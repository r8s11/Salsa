import { Link } from "react-router-dom";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminImportDropzone from "../components/Admin/AdminImportDropzone";
import { useCsvEventImport } from "../hooks/useCsvEventImport";
import type { CsvRowWithDuplicates } from "../hooks/useCsvEventImport";
import type { CsvRowStatus } from "../features/admin/model/csvImportValidation";
import {
  CSV_COLUMNS,
  CSV_MAX_ROWS,
  buildCsvFromRows,
  buildCsvTemplate,
  downloadCsv,
} from "../features/admin/model/csvImportTemplate";
import "./AdminImportEventsPage.css";

const STATUS_LABEL: Record<CsvRowStatus, string> = {
  valid: "Valid",
  warning: "Warning",
  invalid: "Invalid",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: CsvRowStatus }) {
  return (
    <span className={`admin-status admin-status--import-${status}`}>{STATUS_LABEL[status]}</span>
  );
}

function RowIssues({ row }: { row: CsvRowWithDuplicates }) {
  if (row.errors.length === 0 && row.warnings.length === 0) {
    return <span className="admin-import-page__ok">Looks good</span>;
  }
  return (
    <ul className="admin-import-page__issues">
      {row.errors.map((issue, index) => (
        <li key={`e${index}`} className="admin-import-page__issue--error">
          {issue.field}: {issue.message}
        </li>
      ))}
      {row.warnings.map((issue, index) => (
        <li key={`w${index}`} className="admin-import-page__issue--warning">
          {issue.field}: {issue.message}
        </li>
      ))}
    </ul>
  );
}

export default function AdminImportEventsPage() {
  const {
    stage,
    fileName,
    fileSize,
    fileErrors,
    rows,
    counts,
    includedDuplicates,
    toggleIncludeDuplicate,
    importableCount,
    importResult,
    importError,
    handleFile,
    runImport,
    reset,
    taxonomyLoading,
  } = useCsvEventImport();

  const isImporting = stage === "importing";

  const downloadErrorRows = () => {
    const invalidRows = rows.filter((row) => row.status === "invalid");
    const headers = [...CSV_COLUMNS.map((column) => column.key), "_errors"];
    const dataRows = invalidRows.map((row) => [
      ...CSV_COLUMNS.map((column) => row.raw[column.key] ?? ""),
      row.errors.map((issue) => `${issue.field}: ${issue.message}`).join(" | "),
    ]);
    downloadCsv("salsasegura-import-errors.csv", buildCsvFromRows(headers, dataRows));
  };

  const includeToggle = (row: CsvRowWithDuplicates) =>
    row.duplicates.length > 0 ? (
      <label className="admin-import-page__include">
        <input
          type="checkbox"
          checked={includedDuplicates.has(row.rowNumber)}
          onChange={() => toggleIncludeDuplicate(row.rowNumber)}
          disabled={isImporting}
        />
        Import anyway
      </label>
    ) : null;

  return (
    <>
      <AdminPageHeader
        title="Import Events"
        description="Bulk-add events from a spreadsheet. Every row is validated before anything is saved."
        actions={
          <Link to="/admin/events" className="admin-btn admin-btn--secondary">
            Back to Events
          </Link>
        }
      />

      <section className="admin-card admin-import-page__instructions">
        <h2>How it works</h2>
        <ol>
          <li>Download the template below.</li>
          <li>Add your events, one per row.</li>
          <li>Upload the completed CSV.</li>
          <li>Fix any errors it finds.</li>
          <li>Review the events it detected.</li>
          <li>Import.</li>
        </ol>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => downloadCsv("salsasegura-event-import-template.csv", buildCsvTemplate())}
        >
          Download CSV Template
        </button>
        <div className="admin-import-page__rules">
          <p>
            <strong>Dates:</strong> YYYY-MM-DD (e.g. 2026-09-15). <strong>Times:</strong> 24-hour
            HH:MM (e.g. 20:00).
          </p>
          <p>
            <strong>Multiple values</strong> (dance styles, event attributes, gallery images):
            separate with a semicolon, e.g. <code>Salsa; Bachata On1</code>.
          </p>
          <p>
            <strong>Required columns:</strong> title, event_type, event_date, city. Everything else
            is optional and can be left blank.
          </p>
          <p>
            <strong>Recurring events:</strong> set recurrence to <code>weekly</code>, or leave it
            blank for a one-time event.
          </p>
          <p>
            <strong>Blank cells are fine</strong> for every optional column.
          </p>
          <p>
            <strong>Maximum {CSV_MAX_ROWS} event rows</strong> per upload — split larger batches
            into multiple files.
          </p>
        </div>
      </section>

      {stage === "idle" && (
        <section className="admin-card admin-import-page__upload-card">
          <AdminImportDropzone onFileSelected={handleFile} disabled={taxonomyLoading} />
          {fileErrors.length > 0 && (
            <div className="admin-banner admin-banner--error" role="alert">
              {fileName && (
                <p>
                  <strong>{fileName}</strong>
                </p>
              )}
              <ul>
                {fileErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {stage === "processing" && (
        <section className="admin-card admin-import-page__status-card">
          <p role="status">Reading {fileName}…</p>
        </section>
      )}

      {(stage === "reviewing" || isImporting) && (
        <>
          <section className="admin-card admin-import-page__summary">
            <div>
              <p className="admin-import-page__filename">{fileName}</p>
              <p className="admin-import-page__filesize">
                {fileSize != null && formatBytes(fileSize)} · {counts.total} event row
                {counts.total === 1 ? "" : "s"} detected
              </p>
            </div>
            <div className="admin-import-page__counts">
              <span className="admin-status admin-status--import-valid">{counts.valid} valid</span>
              <span className="admin-status admin-status--import-warning">
                {counts.warning} warning
              </span>
              <span className="admin-status admin-status--import-invalid">
                {counts.invalid} invalid
              </span>
            </div>
            <div className="admin-import-page__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={reset}
                disabled={isImporting}
              >
                Upload a different file
              </button>
              {counts.invalid > 0 && (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={downloadErrorRows}
                >
                  Download error rows as CSV
                </button>
              )}
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={runImport}
                disabled={isImporting || importableCount === 0}
              >
                {isImporting ? "Importing…" : `Import Valid Events (${importableCount})`}
              </button>
            </div>
            {importError && (
              <div className="admin-banner admin-banner--error" role="alert">
                <p>{importError}</p>
              </div>
            )}
          </section>

          <section className="admin-card admin-import-page__table-card">
            <div className="admin-import-page__table-scroll">
              <table className="admin-import-page__table">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Event</th>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Details</th>
                    <th scope="col">
                      <span className="admin-visually-hidden">Include</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="admin-import-page__row-number">{row.rowNumber}</td>
                      <td className="admin-import-page__event-title">
                        {row.raw.title || <em>(no title)</em>}
                      </td>
                      <td className="admin-import-page__date">{row.raw.event_date}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>
                        <RowIssues row={row} />
                      </td>
                      <td>{includeToggle(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-import-cards">
              {rows.map((row) => (
                <article key={row.rowNumber} className="admin-import-cards__item">
                  <div className="admin-import-cards__head">
                    <span className="admin-import-page__event-title">
                      {row.raw.title || <em>(no title)</em>}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="admin-import-cards__row">
                    <span className="admin-import-cards__label">Row</span>
                    <span>{row.rowNumber}</span>
                  </div>
                  <div className="admin-import-cards__row">
                    <span className="admin-import-cards__label">Date</span>
                    <span>{row.raw.event_date}</span>
                  </div>
                  <RowIssues row={row} />
                  {includeToggle(row)}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {stage === "done" && importResult && (
        <section className="admin-card admin-import-page__results">
          <h2>Import Complete</h2>
          <ul className="admin-import-page__results-counts">
            <li>{importResult.totalRows} events processed</li>
            <li>{importResult.createdCount} created</li>
            <li>{importResult.failedCount} failed</li>
          </ul>
          {importResult.failedCount > 0 && (
            <div className="admin-banner admin-banner--error" role="alert">
              <p>The following rows failed to import:</p>
              <ul>
                {importResult.rows
                  .filter((row) => row.outcome === "failed")
                  .map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber} — {row.title || "(no title)"}: {row.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="admin-import-page__actions">
            <Link to="/admin/events" className="admin-btn admin-btn--primary">
              View Events
            </Link>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={reset}>
              Import another file
            </button>
          </div>
        </section>
      )}
    </>
  );
}
