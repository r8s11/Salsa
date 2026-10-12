import { useEffect, useRef, useState } from "react";
import { fetchAnalyticsReport } from "../../api/analyticsRepo";
import { dateRangeFor, type EngagementSort, type EntityPerformanceOptions, type TimeRange } from "../../model/analyticsQuery";
import { REPORTS, reportCsv, reportFilename, type ReportKind } from "../../model/operationalAnalytics";
import "./OperationalInsights.css";

export default function AnalyticsReporting({ period, engagementSort, entityOptions }: { period: TimeRange; engagementSort: EngagementSort; entityOptions: EntityPerformanceOptions }) {
  const [kind, setKind] = useState<ReportKind>("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const exportReport = async () => {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const sort = kind === "events" ? engagementSort : kind === "venues" ? entityOptions.venueSort : entityOptions.organizerSort;
      const report = await fetchAnalyticsReport(kind, dateRangeFor(period), sort);
      if (!active.current) return;
      const url = URL.createObjectURL(new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = reportFilename(kind, period, report);
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(report.rows.length < report.total
        ? `Partial export: ${report.rows.length.toLocaleString()} of ${report.total.toLocaleString()} rows. Applied limit: ${report.limit.toLocaleString()}. The filename and CSV identify this limit.`
        : `Exported ${report.rows.length.toLocaleString()} of ${report.total.toLocaleString()} rows. ${report.scope}.`);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Unable to export report. Please try again.");
    } finally { if (active.current) setBusy(false); }
  };
  return <section className="analytics-reporting" aria-label="Analytics reporting" aria-busy={busy}>
    <label htmlFor="analytics-report-kind">CSV report<select className="admin-input" id="analytics-report-kind" value={kind} disabled={busy} onChange={(event) => { setKind(event.target.value as ReportKind); setMessage(null); setError(null); }}>{Object.entries(REPORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <button className="admin-btn admin-btn--secondary" type="button" disabled={busy} onClick={() => void exportReport()}>{busy ? "Exporting report…" : error ? "Retry export" : "Export Report"}</button>
    <details className="analytics-reporting__help"><summary>Report scope and export limits</summary><p className="operational-insights__note">Exports use the selected reporting period and ranking order, not the visible page. Current-state reports stay independent of period. Up to 10,000 authorized rows; larger exports are explicitly marked partial. Dates use Eastern time; no submitter or private account information.</p></details>
    {message && <p role="status" className="operational-insights__note">{message}</p>}
    {error && <div className="admin-banner admin-banner--error" role="alert">{error}</div>}
  </section>;
}
