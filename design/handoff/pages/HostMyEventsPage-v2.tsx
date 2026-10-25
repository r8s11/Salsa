import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "../components/Dashboard/DashboardShell";
import { HOST_RAIL } from "./HostDashboardPage-v2";
import "./HostMyEventsPage-v2.css";

type HostEvent = {
  id: string;
  cat: "upcoming" | "drafts" | "past";
  badge: string;
  dateLine: string;
  title: string;
  venue: string;
  status: string;
  tone: "live" | "good" | "plain";
  count: string;
  pct: number;
  note: string;
  /** null when the event has no public page yet (drafts). */
  publicId: string | null;
};

const EVENTS: HostEvent[] = [
  { id: "ev-havana", cat: "upcoming", badge: "OCT 24", dateLine: "Fri, Oct 24 · 9:00 PM", title: "Havana Nights Social", venue: "The Grand Ballroom, Downtown", status: "Live", tone: "live", count: "340/400", pct: 85, note: "Doors open at 9:00 PM", publicId: "ev-havana" },
  { id: "ev-mambo", cat: "upcoming", badge: "NOV 12", dateLine: "Wed, Nov 12 · 7:00 PM", title: "Mambo Masterclass", venue: "Studio 4B, Arts District", status: "On sale", tone: "plain", count: "45/100", pct: 45, note: "On sale · 55 seats left", publicId: "ev-mambo" },
  { id: "ev-gala", cat: "drafts", badge: "DEC 05", dateLine: "Fri, Dec 5 · time TBD", title: "Winter Salsa Gala", venue: "Venue not set", status: "Draft", tone: "plain", count: "0/500", pct: 0, note: "Not published yet", publicId: null },
  { id: "ev-rooftop", cat: "past", badge: "SEP 27", dateLine: "Sat, Sep 27 · 6:00 PM", title: "Rooftop Bachata Sunset", venue: "Seaport Rooftop, Boston", status: "Wrapped", tone: "good", count: "268/300", pct: 89, note: "Settled · report ready", publicId: "ev-rooftop" },
  { id: "ev-sixweek", cat: "past", badge: "AUG 06", dateLine: "Wed evenings · Aug 6 – Sep 10", title: "Salsa 101 · six-week course", venue: "Green Street Studios", status: "Wrapped", tone: "good", count: "32/32", pct: 100, note: "Settled · report ready", publicId: "ev-sixweek" },
];

const TABS = ["All", "Upcoming", "Drafts", "Past"] as const;
const VIEWS = ["Cards", "Table"] as const;

function badgeClass(tone: HostEvent["tone"]) {
  if (tone === "live") return "ss-badge ss-badge--live";
  if (tone === "good") return "ss-badge ss-badge--good";
  return "ss-badge";
}

function primaryTo(e: HostEvent) {
  return e.cat === "drafts" ? `/host/events/${e.id}/edit` : `/host/events/${e.id}`;
}

function primaryLabel(e: HostEvent) {
  if (e.cat === "drafts") return "Finish draft";
  if (e.cat === "past") return "View recap";
  return e.status === "Live" ? "Run the door" : "Open dashboard";
}

export default function HostMyEventsPageV2() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [view, setView] = useState<(typeof VIEWS)[number]>("Cards");

  const events = useMemo(
    () => (tab === "All" ? EVENTS : EVENTS.filter((e) => e.cat === tab.toLowerCase())),
    [tab]
  );

  return (
    <DashboardShell breadcrumb="Host · My Events" sections={HOST_RAIL}>
      <div className="ss-page">
        <div className="ss-row ss-row--between">
          <div>
            <h1 className="ss-h1">My Events</h1>
            <p className="ss-lede">Manage all your past, present, and future events.</p>
          </div>
          <Link to="/host/events/new" className="ss-btn ss-btn--primary">
            + Create new event
          </Link>
        </div>

        <div className="ss-row ss-row--between">
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

          <div className="ss-segmented">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className="ss-segmented__opt"
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "Table" ? (
          <div className="ss-card ss-card--flush">
            <div className="ss-tablewrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="ss-table__strong" data-label="Event">
                        {e.title}
                      </td>
                      <td data-label="Date">{e.badge}</td>
                      <td data-label="Venue">{e.venue}</td>
                      <td data-label="Registered">{e.count}</td>
                      <td data-label="Status">
                        <span className={badgeClass(e.tone)}>{e.status}</span>
                      </td>
                      <td className="ss-table__actions" data-label="">
                        {e.publicId && (
                          <Link to={`/events/${e.publicId}`} className="host-events__viewlink">
                            View page
                          </Link>
                        )}
                        <Link to={primaryTo(e)} className="ss-btn ss-btn--ghost ss-btn--sm">
                          {primaryLabel(e)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="ss-grid--cards ss-grid">
            {events.map((e) => (
              <article className="host-events__card" key={e.id}>
                <div className="host-events__thumb">
                  <span className="host-events__badge">{e.badge}</span>
                  <span className={badgeClass(e.tone)}>{e.status}</span>
                </div>
                <div className="host-events__body">
                  <h3 className="host-events__title">{e.title}</h3>
                  <div className="ss-muted">📍 {e.venue}</div>
                  <div className="ss-muted">{e.dateLine}</div>
                  <div className="host-events__meter">
                    <div className="ss-row ss-row--between">
                      <span className="ss-muted">Registered {e.count}</span>
                      <span className="ss-muted">{e.note}</span>
                    </div>
                    <div className="ss-bar">
                      <div className="ss-bar__fill" style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                  {e.publicId && (
                    <Link
                      to={`/events/${e.publicId}`}
                      className="ss-btn ss-btn--ghost ss-btn--sm host-events__block"
                    >
                      View event page
                    </Link>
                  )}
                  <Link to={primaryTo(e)} className="ss-btn ss-btn--primary ss-btn--sm host-events__block">
                    {primaryLabel(e)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {events.length === 0 && <div className="ss-empty">Nothing in this list yet.</div>}
      </div>
    </DashboardShell>
  );
}
