import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, Disc3, Mail, Settings, User } from "lucide-react";
import DashboardShell, { RailSection } from "../components/Dashboard/DashboardShell";
import "./DjDashboardPage-v2.css";

type Request = {
  id: string;
  date: string;
  event: string;
  host: string;
  venue: string;
  set: string;
  note: string;
};

const REQUESTS: Request[] = [
  { id: "dr1", date: "Fri · Nov 14", event: "Late Night Bachata Room", host: "Querencia", venue: "Havana Club, Cambridge", set: "60 min · 12–1 AM", note: "Sensual-heavy set, no reggaeton." },
  { id: "dr2", date: "Sat · Nov 22", event: "Salsa Segura Anniversary", host: "Salsa Segura", venue: "The Grand Ballroom", set: "90 min · opening", note: "On2 crowd, warm the floor up slow." },
  { id: "dr3", date: "Sun · Nov 30", event: "Sunday Social & Class", host: "Lili Dance", venue: "Lili Studio, Allston", set: "120 min", note: "Class first, social after — beginner friendly." },
  { id: "dr4", date: "Fri · Dec 05", event: "Winter Salsa Gala", host: "Carlos Mendez", venue: "TBD", set: "TBD", note: "Holding the date while the room is confirmed." },
];

const GIGS = [
  { month: "October", weekday: "Fri", day: "24", title: "Havana Nights Social", venue: "The Grand Ballroom, Boston", host: "Carlos Mendez", set: "11 PM – 1 AM", room: "Main room" },
  { month: "October", weekday: "Fri", day: "31", title: "Bachata Night Halloween", venue: "Sala Roja, Somerville", host: "Ritmo Collective", set: "10:30 PM – 12:30 AM", room: "Bachata room" },
  { month: "November", weekday: "Fri", day: "07", title: "Mambo Masterclass Social", venue: "Studio 4B, Arts District", host: "Masacote", set: "9 PM – 11 PM", room: "Main room" },
  { month: "November", weekday: "Sat", day: "15", title: "On2 Night", venue: "Havana Club, Cambridge", host: "Salsa y Control", set: "11 PM – 2 AM", room: "Main room" },
];

const CHECKLIST = [
  { label: "Cover photo and press shot", done: true },
  { label: "Styles and cities listed", done: true },
  { label: "Residencies and past nights", done: true },
  { label: "Sample mix or set recording", done: false },
  { label: "Tech rider (decks, mixer, monitors)", done: true },
  { label: "Instagram and booking email", done: true },
];

const FACTS = [
  { label: "Styles", value: "Salsa On1 · On2 · Bachata Sensual" },
  { label: "Cities", value: "Boston · New York City" },
  { label: "Residency", value: "Havana Nights — first Friday" },
  { label: "Booking", value: "sofia@example.com · @SalsaSegura" },
];

type Status = "Pending" | "Accepted" | "Declined";
const FILTERS = ["All", "Pending", "Accepted", "Declined"] as const;

export default function DjDashboardPageV2() {
  const [answers, setAnswers] = useState<Record<string, Status>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(
    () => REQUESTS.map((r) => ({ ...r, status: answers[r.id] ?? ("Pending" as Status) })),
    [answers]
  );

  const pending = rows.filter((r) => r.status === "Pending");
  const filtered = filter === "All" ? rows : rows.filter((r) => r.status === filter);

  const months = useMemo(() => {
    const out: { label: string; gigs: typeof GIGS }[] = [];
    GIGS.forEach((g) => {
      const bucket = out.find((m) => m.label === g.month);
      if (bucket) bucket.gigs.push(g);
      else out.push({ label: g.month, gigs: [g] });
    });
    return out;
  }, []);

  const complete = Math.round((CHECKLIST.filter((c) => c.done).length / CHECKLIST.length) * 100);

  const sections: RailSection[] = [
    { title: "Overview", items: [{ to: "/dj", label: "Dashboard", icon: <BarChart3 size={16} /> }] },
    {
      title: "Bookings",
      items: [
        { to: "/dj/requests", label: "Requests", icon: <Mail size={16} />, count: pending.length },
        { to: "/dj/schedule", label: "Schedule", icon: <CalendarDays size={16} /> },
      ],
    },
    {
      title: "Account",
      items: [
        { to: "/dj/page", label: "My DJ page", icon: <Disc3 size={16} /> },
        { to: "/account", label: "My Account", icon: <User size={16} /> },
        { to: "/profile/edit", label: "Profile Settings", icon: <Settings size={16} /> },
      ],
    },
  ];

  const kpis = [
    { label: "Requests waiting", value: String(pending.length), sub: "to answer", note: pending.length ? "Oldest sent 3 days ago" : "All caught up", tone: pending.length ? ("warn" as const) : ("" as const) },
    { label: "Confirmed nights", value: String(GIGS.length), sub: "next 60 days", note: "2 rooms, 4 hosts", tone: "" as const },
    { label: "Followers", value: "412", sub: "", note: "▲ 18 this month", tone: "good" as const },
    { label: "Page views", value: "1,940", sub: "30 days", note: "Most from the DJ directory", tone: "" as const },
  ];

  const next = GIGS[0];

  return (
    <DashboardShell breadcrumb="DJ · Dashboard" sections={sections}>
      <div className="ss-page">
        <div>
          <div className="ss-eyebrow">DJ dashboard</div>
          <h1 className="ss-h1">Next up, Sofia.</h1>
          <p className="ss-lede">
            Your booked nights, the requests waiting on an answer, and how your public page looks to
            hosts.
          </p>
        </div>

        <div className="ss-card dj-v2__next">
          <div className="dj-v2__datechip">
            <span className="dj-v2__datechip-kicker">{next.weekday}</span>
            <span className="dj-v2__datechip-day">{next.day}</span>
            <span className="dj-v2__datechip-month">OCT</span>
          </div>
          <div className="dj-v2__next-body">
            <span className="ss-badge ss-badge--live">Confirmed</span>
            <h2 className="dj-v2__next-title">{next.title}</h2>
            <div className="ss-muted">{next.venue}</div>
            <div className="dj-v2__next-facts">
              <span>🕐 {next.set}</span>
              <span>🎧 {next.room}</span>
              <span>👤 {next.host}</span>
            </div>
            <div className="ss-row">
              <Link to="/dj/schedule" className="ss-btn ss-btn--primary">
                Full schedule
              </Link>
              <Link to="/directory/djs/sofia" className="ss-btn ss-btn--ghost">
                View public page
              </Link>
            </div>
          </div>
        </div>

        <div className="ss-grid">
          {kpis.map((k) => (
            <div className="ss-kpi" key={k.label}>
              <div className="ss-kpi__top">
                <span className="ss-kpi__label">{k.label}</span>
              </div>
              <div className="dj-v2__kpi-value">
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

        {/* ---------- requests ---------- */}
        <section>
          <div className="ss-row ss-row--between dj-v2__section-title">
            <h2 className="ss-h2">Booking requests</h2>
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

          <div className="ss-card ss-card--flush">
            <div className="ss-tablewrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Host</th>
                    <th>Venue</th>
                    <th>Set</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Date">{r.date}</td>
                      <td className="ss-table__strong" data-label="Event">
                        {r.event}
                      </td>
                      <td data-label="Host">{r.host}</td>
                      <td data-label="Venue">{r.venue}</td>
                      <td data-label="Set">{r.set}</td>
                      <td data-label="Status">
                        <span
                          className={
                            r.status === "Accepted"
                              ? "ss-badge ss-badge--live"
                              : r.status === "Pending"
                              ? "ss-badge ss-badge--warn"
                              : "ss-badge"
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="ss-table__actions" data-label="">
                        {r.status === "Pending" ? (
                          <span className="dj-v2__actions">
                            <button
                              type="button"
                              className="ss-btn ss-btn--primary ss-btn--sm"
                              onClick={() => setAnswers((p) => ({ ...p, [r.id]: "Accepted" }))}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="ss-btn ss-btn--ghost ss-btn--sm"
                              onClick={() => setAnswers((p) => ({ ...p, [r.id]: "Declined" }))}
                            >
                              Decline
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="ss-btn ss-btn--ghost ss-btn--sm"
                            onClick={() => setAnswers((p) => ({ ...p, [r.id]: "Pending" }))}
                          >
                            Undo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------- schedule ---------- */}
        <section>
          <h2 className="ss-h2 dj-v2__section-title">Schedule</h2>
          <div className="ss-stack">
            {months.map((m) => (
              <div key={m.label}>
                <div className="dj-v2__month">
                  <h3 className="ss-section-label">{m.label}</h3>
                  <span className="ss-muted">
                    {m.gigs.length === 1 ? "1 night" : `${m.gigs.length} nights`}
                  </span>
                </div>
                <div className="ss-stack dj-v2__gigs">
                  {m.gigs.map((g) => (
                    <div className="ss-card dj-v2__gig" key={g.title}>
                      <div className="dj-v2__gig-date">
                        <span className="dj-v2__gig-weekday">{g.weekday}</span>
                        <span className="dj-v2__gig-day">{g.day}</span>
                      </div>
                      <div className="dj-v2__gig-body">
                        <div className="dj-v2__gig-title">{g.title}</div>
                        <div className="ss-muted">
                          {g.venue} · {g.host}
                        </div>
                      </div>
                      <div className="dj-v2__gig-set">
                        <span className="dj-v2__gig-time">{g.set}</span>
                        <span className="ss-muted">{g.room}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- my page ---------- */}
        <section className="ss-split">
          <div className="ss-card ss-stack">
            <div className="ss-row ss-row--between">
              <h2 className="ss-h2">Page completeness</h2>
              <span className="dj-v2__pct">{complete}%</span>
            </div>
            <div className="ss-bar dj-v2__completebar">
              <div className="ss-bar__fill dj-v2__completefill" style={{ width: `${complete}%` }} />
            </div>
            <div className="ss-stack dj-v2__checklist">
              {CHECKLIST.map((c) => (
                <div className="dj-v2__check" key={c.label}>
                  <span className={c.done ? "dj-v2__dot dj-v2__dot--on" : "dj-v2__dot"}>
                    {c.done ? "✓" : "○"}
                  </span>
                  <span className={c.done ? "dj-v2__check-label" : "dj-v2__check-label dj-v2__check-label--off"}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ss-card ss-stack">
            <h2 className="ss-h2">On your page</h2>
            {FACTS.map((f) => (
              <div className="dj-v2__fact" key={f.label}>
                <span className="dj-v2__fact-label">{f.label}</span>
                <span className="dj-v2__fact-value">{f.value}</span>
              </div>
            ))}
            <Link to="/profile/edit" className="ss-btn ss-btn--ghost dj-v2__editbtn">
              Edit details
            </Link>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
