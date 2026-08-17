import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminImportDropzone from "../components/Admin/AdminImportDropzone";
import { useCsvEventImport } from "../hooks/useCsvEventImport";
import {
  CSV_COLUMNS,
  CSV_MAX_ROWS,
  buildCsvFromRows,
  buildCsvTemplate,
  downloadCsv,
} from "../features/admin/model/csvImportTemplate";
import "./AdminImportEventsPage.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadTemplate() {
  downloadCsv("salsasegura-event-import-template.csv", buildCsvTemplate());
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

  const downloadErrorRows = () => {
    const invalidRows = rows.filter((r) => r.status === "invalid");
    const headers = [...CSV_COLUMNS.map((c) => c.key), "_errors"];
    const dataRows = invalidRows.map((row) => [
      ...CSV_COLUMNS.map((c) => row.raw[c.key] ?? ""),
      row.errors.map((e) => `${e.field}: ${e.message}`).join(" | "),
    ]);
    downloadCsv("salsasegura-import-errors.csv", buildCsvFromRows(headers, dataRows));
  };

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

      <div className="admin-card admin-import-page__instructions">
        <h2>How it works</h2>
        <ol>
          <li>Download the template below.</li>
          <li>Add your events, one per row.</li>
          <li>Upload the completed CSV.</li>
          <li>Fix any errors it finds.</li>
          <li>Review the events it detected.</li>
          <li>Import.</li>
        </ol>
        <button type="button" className="admin-btn admin-btn--primary" onClick={downloadTemplate}>
          Download CSV Template
        </button>
        <div className="admin-import-page__rules">
          <p><strong>Dates:</strong> YYYY-MM-DD (e.g. 2026-09-15). <strong>Times:</strong> 24-hour HH:MM (e.g. 20:00).</p>
          <p><strong>Multiple values</strong> (dance styles, event attributes, gallery images): separate with a semicolon, e.g. <code>Salsa; Bachata On1</code>.</p>
          <p><strong>Required columns:</strong> title, event_type, event_date, city. Everything else is optional and can be left blank.</p>
          <p><strong>Recurring events:</strong> set recurrence to <code>weekly</code>, or leave it blank for a one-time event.</p>
          <p><strong>Blank cells are fine</strong> for every optional column.</p>
          <p><strong>Maximum {CSV_MAX_ROWS} event rows</strong> per upload — split larger batches into multiple files.</p>
        </div>
      </div>

      {stage === "idle" && (
        <div className="admin-card">
          <AdminImportDropzone onFileSelected={handleFile} disabled={taxonomyLoading} />
          {fileErrors.length > 0 && (
            <div className="admin-banner admin-banner--error" role="alert">
              {fileName && <p><strong>{fileName}</strong></p>}
              <ul>{fileErrors.map((err) => <li key={err}>{err}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {stage === "processing" && (
        <div className="admin-card">
          <p role="status">Reading {fileName}…</p>
        </div>
      )}

      {(stage === "reviewing" || stage === "importing") && (
        <>
          <div className="admin-card admin-import-page__summary">
            <div>
              <p className="admin-import-page__filename">{fileName}</p>
              <p className="admin-import-page__filesize">{fileSize != null && formatBytes(fileSize)} · {counts.total} event row{counts.total === 1 ? "" : "s"} detected</p>
            </div>
            <div className="admin-import-page__counts">
              <span className="admin-status admin-status--approved"><CheckCircle2 size={14} /> {counts.valid} valid</span>
              <span className="admin-status admin-status--pending"><AlertTriangle size={14} /> {counts.warning} warning</span>
              <span className="admin-status admin-status--rejected"><XCircle size={14} /> {counts.invalid} invalid</span>
            </div>
            <div className="admin-import-page__actions">
              <button type="button" className="admin-btn admin-btn--secondary" onClick={reset} disabled={stage === "importing"}>
                Upload a different file
              </button>
              {counts.invalid > 0 && (
                <button type="button" className="admin-btn admin-btn--secondary" onClick={downloadErrorRows}>
                  Download error rows as CSV
                </button>
              )}
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={runImport}
                disabled={stage === "importing" || importableCount === 0}
              >
                {stage === "importing" ? "Importing…" : `Import Valid Events (${importableCount})`}
              </button>
            </div>
            {importError && (
              <div className="admin-banner admin-banner--error" role="alert">
                <p>{importError}</p>
              </div>
            )}
          </div>

          <div className="admin-card admin-import-page__table-card">
            <table className="admin-import-page__table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isDuplicate = row.duplicates.length > 0;
                  return (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.raw.title || <em>(no title)</em>}</td>
                      <td>{row.raw.event_date}</td>
                      <td>
                        <span className={`admin-status admin-status--${row.status === "valid" ? "approved" : row.status === "warning" ? "pending" : "rejected"}`}>
                          {row.status === "valid" ? "Valid" : row.status === "warning" ? "Warning" : "Invalid"}
                        </span>
                      </td>
                      <td>
                        {row.errors.length === 0 && row.warnings.length === 0 ? (
                          <span className="admin-import-page__ok">Looks good</span>
                        ) : (
                          <ul className="admin-import-page__issues">
                            {row.errors.map((e, i) => (
                              <li key={`e${i}`} className="admin-import-page__issue--error">{e.field}: {e.message}</li>
                            ))}
                            {row.warnings.map((w, i) => (
                              <li key={`w${i}`} className="admin-import-page__issue--warning">{w.field}: {w.message}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {isDuplicate && (
                          <label className="admin-import-page__include">
                            <input
                              type="checkbox"
                              checked={includedDuplicates.has(row.rowNumber)}
                              onChange={() => toggleIncludeDuplicate(row.rowNumber)}
                              disabled={stage === "importing"}
                            />
                            Import anyway
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stage === "done" && importResult && (
        <div className="admin-card admin-import-page__results">
          <h2>Import Complete</h2>
          <ul>
            <li>{importResult.totalRows} events processed</li>
            <li>{importResult.createdCount} created</li>
            <li>{importResult.failedCount} failed</li>
          </ul>
          {importResult.failedCount > 0 && (
            <div className="admin-banner admin-banner--error" role="alert">
              <p>The following rows failed to import:</p>
              <ul>
                {importResult.rows
                  .filter((r) => r.outcome === "failed")
                  .map((r) => (
                    <li key={r.rowNumber}>Row {r.rowNumber} — {r.title || "(no title)"}: {r.error}</li>
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
        </div>
      )}
    </>
  );
}
