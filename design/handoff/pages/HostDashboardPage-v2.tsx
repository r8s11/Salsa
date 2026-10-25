import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, Settings, Upload, User } from "lucide-react";
import DashboardShell, { RailSection } from "../components/Dashboard/DashboardShell";
import "./HostDashboardPage-v2.css";

const NEXT_EVENT = {
  id: "ev-havana",
  day: "24",
  month: "OCT",
  status: "Live",
  title: "Havana Nights Social",
  when: "Fri · 9:00 PM – 1:00 AM",
  venue: "The Grand Ballroom, Downtown",
  registered: "340/400",
};

const KPIS = [
  { label: "Live right now", value: "1", sub: "event", note: "Havana Nights · doors open", tone: "" as const },
  { label: "Next 30 days", value: "3", sub: "scheduled", note: "One still needs a venue", tone: "warn" as const },
  { label: "RSVPs this month", value: "612", sub: "across 4 events", note: "▲ 84 vs. last month", tone: "good" as const },
  { label: "Open tasks", value: "7", sub: "across your events", note: "Across 3 upcoming events", tone: "" as const },
];

const ATTENTION = [
  {
    id: "a1",
    title: "Winter Salsa Gala has no venue",
    body: "The draft can't publish until a room is confirmed.",
    action: "Open event",
    to: "/host/events/ev-gala/edit",
    accent: "var(--ss-red)",
  },
  {
    id: "a2",
    title: "Two performers unconfirmed",
    body: "Havana Nights · the 11:30 PM and 12:30 AM sets.",
    action: "Manage lineup",
    to: "/host/events/ev-havana",
    accent: "var(--ss-gold)",
  },
  {
    id: "a3",
    title: "24 on the Mambo waitlist",
    body: "Release seats as cancellations come in.",
    action: "Review attendees",
    to: "/host/events/ev-mambo",
    accent: "var(--ss-tertiary)",
  },
];

const EVENTS = [
  { id: "ev-havana", cat: "upcoming", badge: "OCT 24", title: "Havana Nights Social", venue: "The Grand Ballroom, Downtown", status: "Live", count: "340/400", pct: 85, note: "Doors open at 9:00 PM" },
  { id: "ev-mambo", cat: "upcoming", badge: "NOV 12", title: "Mambo Masterclass", venue: "Studio 4B, Arts District", status: "On sale", count: "45/100", pct: 45, note: "On sale · 55 seats left" },
  { id: "ev-gala", cat: "drafts", badge: "DEC 05", title: "Winter Salsa Gala", venue: "Venue not set", status: "Draft", count: "0/500", pct: 0, note: "Not published yet" },
  { id: "ev-rooftop", cat: "past", badge: "SEP 27", title: "Rooftop Bachata Sunset", venue: "Seaport Rooftop, Boston", status: "Wrapped", count: "268/300", pct: 89, note: "Settled · report ready" },
];

const TABS = ["All", "Upcoming", "Drafts", "Past"] as const;

export const HOST_RAIL: RailSection[] = [
  { title: "Overview", items: [{ to: "/host", label: "Dashboard", icon: <BarChart3 size={16} /> }] },
  {
    title: "Management",
    items: [
      { to: "/host/events", label: "My Events", icon: <CalendarDays size={16} /> },
      { to: "/host/import", label: "Bulk Upload", icon: <Upload size={16} /> },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/account", label: "My Account", icon: <User size={16} /> },
      { to: "/profile/edit", label: "Profile Settings", icon: <Settings size={16} /> },
    ],
  },
];

export default function HostDashboardPageV2() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const events = useMemo(
    () => (tab === "All" ? EVENTS : EVENTS.filter((e) => e.cat === tab.toLowerCase())),
    [tab]
  );

  return (
    <DashboardShell breadcrumb="Host · Dashboard" sections={HOST_RAIL}>
      <div className="ss-page">
        <div className="ss-row ss-row--between">
          <div>
            <div className="ss-eyebrow">Host dashboard</div>
            <h1 className="ss-h1">Welcome back, Carlos.</h1>
            <p className="ss-lede">
              Every event you run, in one list. Open one to manage attendees, performers, and its own
              tasks.
            </p>
          </div>
          <Link to="/host/events/new" className="ss-btn ss-btn--primary">
            + Create new event
          </Link>
        </div>

        <div className="ss-card host-v2__next">
          <div className="host-v2__datechip">
            <span className="host-v2__datechip-kicker">Next</span>
            <span className="host-v2__datechip-day">{NEXT_EVENT.day}</span>
            <span className="host-v2__datechip-month">{NEXT_EVENT.month}</span>
          </div>
          <div className="host-v2__next-body">
            <span className="ss-badge ss-badge--live">{NEXT_EVENT.status}</span>
            <h2 className="host-v2__next-title">{NEXT_EVENT.title}</h2>
            <div className="ss-muted">
              {NEXT_EVENT.when} · {NEXT_EVENT.venue}
            </div>
            <div className="host-v2__next-count">
              <strong>{NEXT_EVENT.registered}</strong>
              <span className="ss-muted">registered · door list ready inside the event</span>
            </div>
            <div className="ss-row">
              <Link to={`/host/events/${NEXT_EVENT.id}`} className="ss-btn ss-btn--primary">
                Open event dashboard
              </Link>
              <Link to="/host/events" className="ss-btn ss-btn--ghost">
                All my events
              </Link>
            </div>
          </div>
        </div>

        <div className="ss-grid">
          {KPIS.map((k) => (
            <div className="ss-kpi" key={k.label}>
              <div className="ss-kpi__top">
                <span className="ss-kpi__label">{k.label}</span>
              </div>
              <div className="host-v2__kpi-value">
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

        <section>
          <h2 className="ss-h2 host-v2__section-title">Needs you before the weekend</h2>
          <div className="host-v2__attention">
            {ATTENTION.map((a) => (
              <div className="host-v2__attention-card" key={a.id} style={{ borderLeftColor: a.accent }}>
                <div className="host-v2__attention-title">{a.title}</div>
                <p className="ss-muted host-v2__attention-body">{a.body}</p>
                <Link to={a.to} className="ss-linkbtn">
                  {a.action} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="ss-row ss-row--between host-v2__section-title">
            <h2 className="ss-h2">All my events</h2>
            <div className="ss-chips">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="ss-chip"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-stack">
            {events.map((e) => (
              <div className="ss-card host-v2__event" key={e.id}>
                <span className="host-v2__event-badge">{e.badge}</span>
                <div className="host-v2__event-body">
                  <div className="ss-row">
                    <h3 className="host-v2__event-title">{e.title}</h3>
                    <span
                      className={
                        e.status === "Live"
                          ? "ss-badge ss-badge--live"
                          : e.status === "Wrapped"
                          ? "ss-badge ss-badge--good"
                          : "ss-badge"
                      }
                    >
                      {e.status}
                    </span>
                  </div>
                  <div className="ss-muted">📍 {e.venue}</div>
                  <div className="host-v2__event-meter">
                    <div className="ss-row ss-row--between">
                      <span className="ss-muted">Registered {e.count}</span>
                      <span className="ss-muted">{e.note}</span>
                    </div>
                    <div className="ss-bar">
                      <div className="ss-bar__fill" style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="host-v2__event-actions">
                  <Link to={`/events/${e.id}`} className="ss-btn ss-btn--ghost ss-btn--sm">
                    View event page
                  </Link>
                  <Link
                    to={e.cat === "drafts" ? `/host/events/${e.id}/edit` : `/host/events/${e.id}`}
                    className="ss-btn ss-btn--primary ss-btn--sm"
                  >
                    {e.cat === "drafts" ? "Finish draft" : "Open dashboard"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
