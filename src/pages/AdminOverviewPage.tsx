import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ClipboardCheck, CircleCheck, TrendingUp } from "lucide-react";
import { useAdminEvents } from "../hooks/useAdminEvents";
import type { DatabaseEvent, City } from "../features/events/model/types";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import "./AdminOverviewPage.css";

const CITY_LABEL: Record<City, string> = {
  boston: "Boston",
  "new-york-city": "New York City",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminOverviewPage() {
  const { events: queriedEvents, isLoading, error, refetch } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  const metrics = useMemo(() => {
    const now = new Date();
    const pending = events.filter((event) => event.status === "pending").length;
    const approved = events.filter((event) => event.status === "approved").length;
    const upcoming = events.filter(
      (event) => event.status === "approved" && new Date(event.event_date) >= now,
    ).length;
    return { total: events.length, pending, approved, upcoming };
  }, [events]);

  const recentSubmissions = useMemo(
    () =>
      [...events]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 5),
    [events],
  );

  const cityCounts = useMemo(() => {
    const counts: Record<City, number> = { boston: 0, "new-york-city": 0 };
    for (const event of events) {
      counts[event.city] += 1;
    }
    return counts;
  }, [events]);

  const cityBarWidth = (count: number) => (events.length === 0 ? "0%" : `${(count / events.length) * 100}%`);

  return (
    <>
      <AdminPageHeader title="Overview" description="A high-level view of platform health and event activity." />

      {isLoading && (
        <p role="status" className="admin-overview-page__status">
          Loading overview…
        </p>
      )}

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>Couldn't load overview: {error}</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="admin-overview-page__metrics">
            <div className="admin-card admin-overview-page__metric">
              <span className="admin-overview-page__metric-icon">
                <CalendarDays size={20} />
              </span>
              <span className="admin-overview-page__metric-label">Total events</span>
              <span className="admin-overview-page__metric-value">{metrics.total}</span>
            </div>

            <Link to="/admin/events" className="admin-card admin-overview-page__metric admin-overview-page__metric--link">
              <span className="admin-overview-page__metric-icon">
                <ClipboardCheck size={20} />
              </span>
              <span className="admin-overview-page__metric-label">Pending review</span>
              <span className="admin-overview-page__metric-value">{metrics.pending}</span>
            </Link>

            <div className="admin-card admin-overview-page__metric">
              <span className="admin-overview-page__metric-icon">
                <CircleCheck size={20} />
              </span>
              <span className="admin-overview-page__metric-label">Approved</span>
              <span className="admin-overview-page__metric-value">{metrics.approved}</span>
            </div>

            <div className="admin-card admin-overview-page__metric">
              <span className="admin-overview-page__metric-icon">
                <TrendingUp size={20} />
              </span>
              <span className="admin-overview-page__metric-label">Upcoming</span>
              <span className="admin-overview-page__metric-value">{metrics.upcoming}</span>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="admin-card admin-overview-page__empty">
              <p>No events yet.</p>
            </div>
          ) : (
            <div className="admin-overview-page__panels">
              <div className="admin-card admin-overview-page__panel">
                <h2>Recent submissions</h2>
                <ul className="admin-overview-page__submissions">
                  {recentSubmissions.map((event: DatabaseEvent) => (
                    <li key={event.id} className="admin-overview-page__submission">
                      <div>
                        <p className="admin-overview-page__submission-title">{event.title}</p>
                        <p className="admin-overview-page__submission-meta">
                          {event.submitter_name || event.submitter_email || "—"}
                        </p>
                      </div>
                      <AdminStatusBadge status={event.status} />
                      <span className="admin-overview-page__submission-date">{formatDate(event.created_at)}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/admin/events" className="admin-overview-page__panel-footer">
                  View all events
                </Link>
              </div>

              <div className="admin-card admin-overview-page__panel">
                <h2>By city</h2>
                <div className="admin-overview-page__city-list">
                  {(Object.keys(CITY_LABEL) as City[]).map((cityKey) => (
                    <div key={cityKey} className="admin-overview-page__city-row">
                      <div className="admin-overview-page__city-label">
                        <span>{CITY_LABEL[cityKey]}</span>
                        <span>{cityCounts[cityKey]}</span>
                      </div>
                      <div className="admin-overview-page__city-bar-track">
                        <div
                          className="admin-overview-page__city-bar-fill"
                          style={{ width: cityBarWidth(cityCounts[cityKey]) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
