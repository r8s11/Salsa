import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, ClipboardCheck, FileEdit, ListChecks, MapPin } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useMySubmissions } from "../../hooks/useMySubmissions";
import { useMyOrganizers } from "../../features/host/hooks/useMyOrganizers";
import { useMyOrganizerEvents } from "../../features/host/hooks/useMyOrganizerEvents";
import type { OrganizerMemberRole } from "../../features/host/api/organizerAccessRepo";
import {
  deriveHostEventRows,
  findNextHostEvent,
  isUpcomingHostEvent,
} from "../../features/host/model/hostEvents";
import AdminMetricCard from "../Admin/AdminMetricCard";
import AdminPageHeader from "../Admin/AdminPageHeader";
import "./HostDashboard.css";

const ROLE_LABELS: Record<OrganizerMemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  editor: "Editor",
};

export default function HostDashboard() {
  const { user, isAdmin, isModerator } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const {
    data: organizers = [],
    isLoading: organizersLoading,
    error: organizersError,
    refetch: refetchOrganizers,
  } = useMyOrganizers();
  const organizerEvents = useMyOrganizerEvents();
  const canCreate = organizers.some(
    (organizer) =>
      organizer.organizerStatus === "active" &&
      (organizer.memberRole === "owner" || organizer.memberRole === "manager")
  );
  const dashboardLoading = isLoading || organizerEvents.isLoading;
  const dashboardError = error || organizersError?.message || organizerEvents.error;
  const refetchAll = () => {
    void refetch();
    void refetchOrganizers?.();
    void organizerEvents.refetch();
  };

  // `new Date()` stays inside useMemo — calling it in the render body trips
  // react-hooks/purity, the same constraint AdminOverviewPage documents.
  const { rows, nextRow, upcomingCount, pendingCount, draftCount } = useMemo(() => {
    const now = new Date();
    const byId = new Map(
      [...submissions, ...approvedEvents, ...organizerEvents.events].map((event) => [event.id, event] as const)
    );
    const owned = [...byId.values()];
    const derived = deriveHostEventRows(owned);
    const next = findNextHostEvent(owned, now);

    return {
      rows: derived,
      nextRow: next ? (derived.find((row) => row.event.id === next.id) ?? null) : null,
      upcomingCount: owned.filter((event) => isUpcomingHostEvent(event, now)).length,
      pendingCount: owned.filter((event) => event.status === "pending").length,
      draftCount: owned.filter((event) => event.status === "draft").length,
    };
  }, [submissions, approvedEvents, organizerEvents.events]);


  const otherRows = rows.filter((row) => row.event.id !== nextRow?.event.id);

  return (
    <>
      <div className="host-dashboard__intro">
        <p className="host-dashboard__eyebrow">Host workspace</p>
        <AdminPageHeader
          title="Welcome back"
          description="Your submitted and published events, with next steps that match their status."
            actions={
              <>
                {canCreate && <Link to="/host/events/new" className="admin-btn admin-btn--primary">+ Create Event</Link>}
                <Link to="/submit" className="admin-btn admin-btn--secondary">Submit an event</Link>
              </>
            }
        />
      </div>

      <section className="host-dashboard__organizers" aria-labelledby="host-organizers">
        <h2 id="host-organizers" className="host-dashboard__eyebrow">
          Your organizers
        </h2>
        {organizersLoading ? (
          <p role="status" className="admin-overview-page__status">
            Checking organizer access…
          </p>
        ) : organizers.length > 0 ? (
          <ul className="host-dashboard__organizer-list">
            {organizers.map((organizer) => (
              <li key={organizer.organizerId} className="host-dashboard__organizer-card">
                <div className="host-dashboard__organizer-main">
                  <Building2 size={18} aria-hidden />
                  <div>
                    <h3>{organizer.organizerName}</h3>
                    <p>{ROLE_LABELS[organizer.memberRole]}</p>
                  </div>
                </div>
                <span className="host-dashboard__status host-dashboard__status--approved">
                  Organizer access confirmed
                </span>
              </li>
            ))}
          </ul>
        ) : isAdmin || isModerator ? (
          <p className="host-dashboard__organizer-note">
            No organizer memberships on this account. Platform tools live in{" "}
            <Link to="/admin">Admin</Link>.
          </p>
        ) : (
          <p className="host-dashboard__organizer-note">
            No organizer access yet. Organizer access is granted by the Salsa Segura team once an
            organizer request is approved.{" "}
            <Link to="/contact">Contact Salsa Segura</Link> to get started.
          </p>
        )}
      </section>

      {dashboardError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load your events.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={refetchAll}>
            Try Again
          </button>
        </div>
      )}

      {!dashboardError && (
        <div className="admin-overview-page__body">
          <div className="admin-overview-page__metrics">
            <AdminMetricCard
              label="Upcoming Events"
              value={upcomingCount}
              subLabel="Your next dates"
              icon={CalendarDays}
              tone="informational"
              to="/host/events"
              actionLabel="View events"
              isLoading={dashboardLoading}
            />
            <AdminMetricCard
              label="Drafts"
              value={draftCount}
              subLabel="Events in progress"
              icon={FileEdit}
              tone="informational"
              to="/host/events?filter=drafts"
              actionLabel="Continue editing"
              isLoading={dashboardLoading}
            />
            <AdminMetricCard
              label="Awaiting Review"
              value={pendingCount}
              subLabel="Submitted, not yet published"
              icon={ClipboardCheck}
              tone="attention"
              to="/host/events"
              actionLabel="Review"
              isLoading={dashboardLoading}
            />
            <AdminMetricCard
              label="Total Events"
              value={rows.length}
              subLabel="Submitted or published"
              icon={ListChecks}
              tone="informational"
              to="/host/events"
              actionLabel="Manage"
              isLoading={dashboardLoading}
            />
          </div>

          {dashboardLoading && (
            <p role="status" className="admin-overview-page__status">
              Loading your events…
            </p>
          )}

          {!dashboardLoading && nextRow && (
            <section className="admin-card host-dashboard__next" aria-labelledby="host-next-event">
              <h2 id="host-next-event" className="host-dashboard__eyebrow">
                Next event
              </h2>
              <p className="host-dashboard__next-date">{nextRow.dateLabel}</p>
              <h3 className="host-dashboard__next-title">
                <Link to={`/host/events/${nextRow.event.id}`}>{nextRow.event.title}</Link>
              </h3>
              <p className="host-dashboard__next-venue">
                <MapPin size={15} aria-hidden />
                {nextRow.event.location || "Venue not set"}
              </p>
              <div className="host-dashboard__next-actions">
                <span
                  className={`host-dashboard__status host-dashboard__status--${nextRow.event.status}`}
                >
                  {nextRow.statusLabel}
                </span>
                <Link className="admin-btn admin-btn--secondary" to={nextRow.action.to}>
                  {nextRow.action.label}
                </Link>
              </div>
            </section>
          )}

          {!dashboardLoading && !nextRow && (
            <section className="admin-card host-dashboard__empty">
              <h2 className="host-dashboard__next-title">No upcoming events yet</h2>
              <p>{canCreate ? "Create an event and it will appear here once it is scheduled." : "Submit an event and it appears here once it is scheduled."}</p>
              <Link className="admin-btn admin-btn--primary" to={canCreate ? "/host/events/new" : "/submit"}>
                {canCreate ? "Create an event" : "Submit an event"}
              </Link>
              {canCreate && <Link className="admin-btn admin-btn--secondary" to="/submit">Submit an event</Link>}
            </section>
          )}

          {!dashboardLoading && otherRows.length > 0 && (
            <section className="admin-card host-dashboard__events" aria-labelledby="host-events">
              <div className="host-dashboard__events-head">
                <h2 id="host-events" className="host-dashboard__eyebrow">
                  Your other events
                </h2>
                <Link className="host-dashboard__all" to="/host/events">
                  All my events →
                </Link>
              </div>
              <ul className="host-dashboard__list">
                {otherRows.map((row) => (
                  <li key={row.event.id} className="host-dashboard__row">
                    <div className="host-dashboard__row-main">
                      <h3 className="host-dashboard__row-title">
                        <Link to={`/host/events/${row.event.id}`}>{row.event.title}</Link>
                      </h3>
                      <p className="host-dashboard__row-meta">
                        {row.dateLabel} · {row.event.location || "Venue not set"}
                      </p>
                    </div>
                    <span
                      className={`host-dashboard__status host-dashboard__status--${row.event.status}`}
                    >
                      {row.statusLabel}
                    </span>
                    <Link className="host-dashboard__row-action" to={row.action.to}>
                      {row.action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
