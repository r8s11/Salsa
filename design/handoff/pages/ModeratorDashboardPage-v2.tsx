import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  FileText,
  Flag,
  Scale,
  Upload,
} from "lucide-react";
import DashboardShell, { RailSection } from "../components/Dashboard/DashboardShell";
import "./ModeratorDashboardPage-v2.css";

type LogRow = {
  id: string;
  cat: "report" | "appeal" | "auto" | "resolved";
  priority: "High" | "Medium" | "Low" | "Resolved";
  type: string;
  entity: string;
  time: string;
  status: string;
  action: string;
};

const LOG_ROWS: LogRow[] = [
  { id: "l1", cat: "report", priority: "High", type: "User Report · Spam", entity: "Event: Salsa Mega Party", time: "5 mins ago", status: "Pending Review", action: "Review" },
  { id: "l2", cat: "appeal", priority: "Medium", type: "Appeal · Event Rejected", entity: "Org: John Doe", time: "1 hour ago", status: "In Progress", action: "Review" },
  { id: "l3", cat: "auto", priority: "Low", type: "Auto-Flagged Content", entity: "Comment by @salsa_king", time: "3 hours ago", status: "Pending Review", action: "Review" },
  { id: "l4", cat: "resolved", priority: "Resolved", type: "User Ban Lifted", entity: "User: Maria G.", time: "Yesterday", status: "Completed", action: "Details" },
];

const LOG_FILTERS = ["All", "Reports", "Appeals", "Auto-Flagged"] as const;
const LOG_FILTER_CAT: Record<(typeof LOG_FILTERS)[number], LogRow["cat"] | null> = {
  All: null,
  Reports: "report",
  Appeals: "appeal",
  "Auto-Flagged": "auto",
};

type QueueItem = {
  id: string;
  severity: "High" | "Medium" | "Low";
  kind: "User report" | "Appeal" | "Auto-flag";
  target: string;
  reporter: string;
  reason: string;
  age: string;
  note: string;
};

const QUEUE: QueueItem[] = [
  { id: "r1", severity: "High", kind: "User report", target: "Event: Salsa Mega Party", reporter: "@luz.dances", reason: "Spam / duplicate listing", age: "5 min ago", note: "Same event posted four times this week with different titles and a ticket link that redirects off-platform." },
  { id: "r2", severity: "Medium", kind: "Appeal", target: "Organizer: John Doe", reporter: "the organizer", reason: "Event rejected — venue unverified", age: "1 hour ago", note: "Says the venue confirmed by phone and has attached a signed booking email as proof." },
  { id: "r3", severity: "Low", kind: "Auto-flag", target: "Comment by @salsa_king", reporter: "the filter", reason: "Language filter match", age: "3 hours ago", note: "Flagged on one word in an otherwise ordinary comment about floor conditions. Likely a false positive." },
];

const KPIS = [
  { label: "Flag rate", value: "2.4%", note: "▼ 0.5% this week", tone: "good" as const },
  { label: "Response time", value: "1.2h", note: "▼ 15m this week", tone: "good" as const },
  { label: "Active reports", value: "45", note: "Requires attention", tone: "danger" as const },
  { label: "Pending appeals", value: "12", note: "Needs review", tone: "warn" as const },
];

const priorityIcon = (p: LogRow["priority"]) => {
  if (p === "High") return <AlertTriangle size={14} />;
  if (p === "Medium") return <Scale size={14} />;
  if (p === "Low") return <Bot size={14} />;
  return <CheckCircle2 size={14} />;
};

const priorityClass = (p: LogRow["priority"]) =>
  p === "High"
    ? "moderator-v2__priority--high"
    : p === "Medium"
    ? "moderator-v2__priority--medium"
    : p === "Low"
    ? "moderator-v2__priority--low"
    : "moderator-v2__priority--resolved";

const statusBadgeClass = (status: string) =>
  status === "Completed"
    ? "ss-badge ss-badge--good"
    : status === "In Progress"
    ? "ss-badge ss-badge--warn"
    : "ss-badge moderator-v2__badge--danger";

export default function ModeratorDashboardPageV2() {
  const [logFilter, setLogFilter] = useState<(typeof LOG_FILTERS)[number]>("All");
  const [resolved, setResolved] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => {
    const cat = LOG_FILTER_CAT[logFilter];
    return cat ? LOG_ROWS.filter((r) => r.cat === cat) : LOG_ROWS;
  }, [logFilter]);

  const openQueue = QUEUE.filter((q) => !resolved[q.id]);
  const actionedCount = QUEUE.length - openQueue.length;
  const reportsCount = openQueue.filter((q) => q.kind !== "Appeal").length;
  const requestsCount = openQueue.filter((q) => q.kind === "Appeal").length;

  const resolve = (id: string) => setResolved((prev) => ({ ...prev, [id]: true }));

  const sections: RailSection[] = [
    { title: "Overview", items: [{ to: "/moderator", label: "Dashboard", icon: <BarChart3 size={16} /> }] },
    { title: "Management", items: [{ to: "/moderator/import", label: "Bulk upload", icon: <Upload size={16} /> }] },
    {
      title: "Review",
      items: [
        { to: "/moderator/reports", label: "Event reports", icon: <Flag size={16} />, count: reportsCount },
        { to: "/moderator/orgreq", label: "Organizer requests", icon: <FileText size={16} />, count: requestsCount },
      ],
    },
  ];

  return (
    <DashboardShell breadcrumb="Moderator · Dashboard" sections={sections}>
      <div className="ss-page">
        <div>
          <div className="ss-eyebrow">Moderator dashboard</div>
          <h1 className="ss-h1">Platform safety, content moderation, and active reports.</h1>
        </div>

        <div className="ss-grid">
          {KPIS.map((k) => (
            <div className="ss-kpi" key={k.label}>
              <div className="ss-kpi__top">
                <span className="ss-kpi__label">{k.label}</span>
              </div>
              <span className="ss-kpi__value">{k.value}</span>
              <div
                className={
                  k.tone === "warn"
                    ? "ss-kpi__note ss-kpi__note--warn"
                    : k.tone === "good"
                    ? "ss-kpi__note ss-kpi__note--good"
                    : "ss-kpi__note moderator-v2__note--danger"
                }
              >
                {k.note}
              </div>
            </div>
          ))}
        </div>

        <div className="ss-card ss-card--flush">
          <div className="ss-card__head">
            <h2 className="ss-h2">Action log</h2>
            <div className="ss-chips">
              {LOG_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="ss-chip"
                  aria-pressed={logFilter === f}
                  onClick={() => setLogFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-tablewrap">
            <table className="ss-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Priority">
                      <span className={`moderator-v2__type ${priorityClass(r.priority)}`}>{r.priority}</span>
                    </td>
                    <td data-label="Type">
                      <span className="moderator-v2__type">
                        {priorityIcon(r.priority)}
                        {r.type}
                      </span>
                    </td>
                    <td data-label="Entity">{r.entity}</td>
                    <td data-label="Time">{r.time}</td>
                    <td data-label="Status">
                      <span className={statusBadgeClass(r.status)}>{r.status}</span>
                    </td>
                    <td className="ss-table__actions" data-label="">
                      <button type="button" className="moderator-v2__action">
                        {r.action} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="ss-stack">
          <div className="ss-row ss-row--between">
            <h2 className="ss-h2">Review queue</h2>
            <span className="ss-muted">
              {openQueue.length} open · {actionedCount} actioned in this session
            </span>
          </div>

          <div className="ss-grid moderator-v2__queue-grid">
            {openQueue.map((q) => (
              <div className={`ss-card moderator-v2__queue ${priorityClass(q.severity)}`} key={q.id}>
                <div className="ss-row ss-row--between">
                  <span className={`moderator-v2__queue-kind ${priorityClass(q.severity)}`}>
                    {q.severity} · {q.kind}
                  </span>
                  <span className="ss-muted">{q.age}</span>
                </div>
                <div>
                  <div className="moderator-v2__queue-target">{q.target}</div>
                  <div className="ss-muted">
                    Reported by {q.reporter} · {q.reason}
                  </div>
                </div>
                <p className="moderator-v2__queue-note">{q.note}</p>
                <div className="ss-row moderator-v2__queue-actions">
                  <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm" onClick={() => resolve(q.id)}>
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="ss-btn ss-btn--sm moderator-v2__btn-escalate"
                    onClick={() => resolve(q.id)}
                  >
                    Escalate
                  </button>
                  <button
                    type="button"
                    className="ss-btn ss-btn--sm moderator-v2__btn-remove"
                    onClick={() => resolve(q.id)}
                  >
                    Take down
                  </button>
                </div>
              </div>
            ))}
            {openQueue.length === 0 && <div className="ss-empty">Queue is clear.</div>}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
