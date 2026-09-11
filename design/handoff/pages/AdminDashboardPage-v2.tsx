import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Flag,
  MapPin,
  Settings,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import DashboardShell, { RailSection } from "../components/Dashboard/DashboardShell";
import "./AdminDashboardPage-v2.css";

type Submission = {
  id: string;
  title: string;
  submitter: string;
  city: string;
  date: string;
  type: string;
  status: "Pending" | "Approved" | "Rejected";
};

const SUBMISSIONS: Submission[] = [
  { id: "s1", title: "Bachata Sensual Pop-up", submitter: "Rafael & Lucia", city: "New York City", date: "Nov 05", type: "Class", status: "Pending" },
  { id: "s2", title: "Uptown Mambo Social", submitter: "DJ Barrio", city: "New York City", date: "Nov 06", type: "Social", status: "Pending" },
  { id: "s3", title: "On2 Shines Workshop", submitter: "Frankie M.", city: "New York City", date: "Nov 03", type: "Workshop", status: "Pending" },
  { id: "s4", title: "Rooftop Sunset Social", submitter: "Seaport Rooftop", city: "Greater Boston", date: "Nov 12", type: "Social", status: "Approved" },
  { id: "s5", title: "Salsa 101 · six weeks", submitter: "Green Street Studios", city: "Greater Boston", date: "Oct 28", type: "Class", status: "Rejected" },
];

const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;

export default function AdminDashboardPageV2() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Pending");
  const [decisions, setDecisions] = useState<Record<string, Submission["status"]>>({});

  const rows = useMemo(() => {
    const withDecisions = SUBMISSIONS.map((s) => ({ ...s, status: decisions[s.id] ?? s.status }));
    return filter === "All" ? withDecisions : withDecisions.filter((s) => s.status === filter);
  }, [decisions, filter]);

  const pendingCount = useMemo(
    () => SUBMISSIONS.filter((s) => (decisions[s.id] ?? s.status) === "Pending").length,
    [decisions]
  );

  const sections: RailSection[] = [
    {
      title: "Overview",
      items: [{ to: "/admin", label: "Dashboard", icon: <BarChart3 size={16} /> }],
    },
    {
      title: "Moderation",
      items: [
        { to: "/admin/submissions", label: "Submissions", icon: <ClipboardCheck size={16} />, count: pendingCount },
        { to: "/admin/reports", label: "Reports", icon: <Flag size={16} /> },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { to: "/admin/events", label: "Events", icon: <CalendarDays size={16} /> },
        { to: "/admin/venues", label: "Venues", icon: <MapPin size={16} /> },
        { to: "/admin/tags", label: "Tags", icon: <Tags size={16} /> },
        { to: "/admin/import", label: "Bulk upload", icon: <Upload size={16} /> },
      ],
    },
    {
      title: "People",
      items: [
        { to: "/admin/users", label: "Users", icon: <Users size={16} /> },
        { to: "/admin/settings", label: "Settings", icon: <Settings size={16} /> },
      ],
    },
  ];

  const kpis = [
    { label: "Awaiting review", value: String(pendingCount), sub: "submissions", note: "Oldest sent 2 days ago", tone: "warn" as const },
    { label: "Published this month", value: "48", sub: "events", note: "Across both cities", tone: "" as const },
    { label: "Active organizers", value: "23", sub: "", note: "3 new requests", tone: "good" as const },
    { label: "Registered dancers", value: "1,842", sub: "", note: "▲ 96 this month", tone: "good" as const },
  ];

  const decide = (id: string, status: Submission["status"]) =>
    setDecisions((prev) => ({ ...prev, [id]: status }));

  return (
    <DashboardShell breadcrumb="Admin · Dashboard" sections={sections}>
      <div className="ss-page">
        <div>
          <div className="ss-eyebrow">Admin dashboard</div>
          <h1 className="ss-h1">Everything across both cities.</h1>
          <p className="ss-lede">
            What needs a decision today, then the catalogue behind it.
          </p>
        </div>

        <div className="ss-grid">
          {kpis.map((k) => (
            <div className="ss-kpi" key={k.label}>
              <div className="ss-kpi__top">
                <span className="ss-kpi__label">{k.label}</span>
              </div>
              <div className="admin-v2__kpi-value">
                <span className="ss-kpi__value">{k.value}</span>
                {k.sub && <span className="ss-kpi__sub">{k.sub}</span>}
              </div>
              <div
                className={
                  k.tone === "warn"
                    ? "ss-kpi__note ss-kpi__note--warn"
                    : k.tone === "good"
                    ? "ss-kpi__note ss-kpi__note--good"
                    : "ss-kpi__note"
                }
              >
                {k.note}
              </div>
            </div>
          ))}
        </div>

        <div className="ss-card ss-card--flush">
          <div className="ss-card__head">
            <h2 className="ss-h2">Event submissions</h2>
            <div className="ss-chips">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="ss-chip"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
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
                  <th>Event</th>
                  <th>Submitted by</th>
                  <th>City</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="ss-table__strong" data-label="Event">
                      {s.title}
                    </td>
                    <td data-label="Submitted by">{s.submitter}</td>
                    <td data-label="City">{s.city}</td>
                    <td data-label="Date">{s.date}</td>
                    <td data-label="Type">{s.type}</td>
                    <td data-label="Status">
                      <span
                        className={
                          s.status === "Approved"
                            ? "ss-badge ss-badge--good"
                            : s.status === "Pending"
                            ? "ss-badge ss-badge--warn"
                            : "ss-badge"
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="ss-table__actions" data-label="">
                      {s.status === "Pending" ? (
                        <span className="admin-v2__actions">
                          <button
                            type="button"
                            className="ss-btn ss-btn--primary ss-btn--sm"
                            onClick={() => decide(s.id, "Approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="ss-btn ss-btn--ghost ss-btn--sm"
                            onClick={() => decide(s.id, "Rejected")}
                          >
                            Reject
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="ss-btn ss-btn--ghost ss-btn--sm"
                          onClick={() => decide(s.id, "Pending")}
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="ss-empty">Nothing in this list.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ss-row ss-row--between">
          <span className="ss-muted">
            {pendingCount === 0 ? "Queue is clear." : `${pendingCount} still waiting on a decision.`}
          </span>
          <Link to="/admin/submissions" className="ss-linkbtn">
            Open full queue →
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
