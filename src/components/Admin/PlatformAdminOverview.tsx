import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, Users, Plus, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminEvents } from "../../hooks/useAdminEvents";
import { useAdminUserCount } from "../../hooks/useAdminUserCount";
import { useAdminUsers } from "../../hooks/useAdminUsers";
import { useAdminVenues } from "../../features/admin/hooks/useAdminVenues";
import { useOrganizerRequests } from "../../features/admin/hooks/useOrganizerRequests";
import {
  deriveOverviewMetrics,
  deriveUpcomingEvents,
} from "../../features/admin/model/overviewMetrics";
import AdminPageHeader from "../Admin/AdminPageHeader";
import AdminMetricCard from "../Admin/AdminMetricCard";
import AdminNeedsAttention from "../Admin/AdminNeedsAttention";
import AdminUpcomingEvents from "../Admin/AdminUpcomingEvents";
import "../../pages/AdminOverviewPage.css";

export default function PlatformAdminOverview() {
  const { events: queried, isLoading, error, refetch } = useAdminEvents();
  const {
    users: queriedUsers,
    isLoading: isUsersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useAdminUsers();
  const {
    count: userCount,
    isLoading: isUserCountLoading,
    error: userCountError,
    refetch: refetchUserCount,
  } = useAdminUserCount();
  const { pendingCount: organizerPendingCount } = useOrganizerRequests();
  const { venues: allVenues = [] } = useAdminVenues();

  const events = useMemo(() => queried ?? [], [queried]);
  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);

  const { metrics, attentionItems, upcoming, todayLabel } = useMemo(() => {
    const now = new Date();
    const metrics = deriveOverviewMetrics(
      events,
      now,
      0,
      0,
      users,
      organizerPendingCount ?? 0,
      allVenues.filter((v) => v.status !== "archived").length,
      allVenues.filter((v) => v.status === "archived").length
    );
    const upcoming = deriveUpcomingEvents(events, now);
    const todayLabel = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const attentionItems = [];

    // Actionable: event submissions awaiting review
    if (metrics.pendingCount > 0) {
      attentionItems.push({
        id: "pending-submissions",
        severity: "action",
        message: `${metrics.pendingCount} event submission${metrics.pendingCount === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/submissions",
      });
    }

    // Actionable: organizer requests awaiting approval
    if (metrics.organizerRequestCount > 0) {
      attentionItems.push({
        id: "organizer-requests",
        severity: "action",
        message: `${metrics.organizerRequestCount} organizer request${metrics.organizerRequestCount === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/organizer-requests",
      });
    }

    // Actionable: flagged accounts requiring review
    if (metrics.flaggedUserCount > 0) {
      attentionItems.push({
        id: "flagged-users",
        severity: "action",
        message: `${metrics.flaggedUserCount} flagged account${metrics.flaggedUserCount === 1 ? "" : "s"} requiring review`,
        actionLabel: "Review",
        to: "/admin/users?status=flagged",
      });
    }

    // Suggested: upcoming events with important missing information
    if (metrics.incompleteCount > 0) {
      attentionItems.push({
        id: "incomplete",
        severity: "suggested",
        message: `${metrics.incompleteCount} upcoming event${metrics.incompleteCount === 1 ? "" : "s"} missing venue, time, or image`,
        actionLabel: "Fix",
        to: "/admin/events?flag=incomplete",
      });
    }

    return { metrics, attentionItems, upcoming, todayLabel };
  }, [events, users, organizerPendingCount, allVenues]);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={`Here's what's happening with SalsaSegura. · ${todayLabel}`}
        actions={
          <Link to="/admin/events?new=1" className="admin-btn admin-btn--primary">
            <Plus size={18} /> Create Event
          </Link>
        }
      />

      {(isLoading || isUserCountLoading || isUsersLoading) && (
        <p role="status" className="admin-overview-page__status">
          Loading overview…
        </p>
      )}

      <div className="admin-overview-page__body">
        <div className="admin-overview-page__metrics">
          <AdminMetricCard
            label="Upcoming Events"
            value={error ? null : metrics.upcomingCount}
            subLabel="Published · Next 30 days"
            icon={CalendarDays}
            tone="informational"
            to="/admin/events?flag=upcoming"
            actionLabel="View events"
            isLoading={isLoading}
            onRetry={refetch}
          />
          <AdminMetricCard
            label="Pending Submissions"
            value={error ? null : metrics.pendingCount}
            subLabel="Awaiting review"
            icon={ClipboardCheck}
            tone="attention"
            to="/admin/submissions"
            actionLabel="Review"
            isLoading={isLoading}
            onRetry={refetch}
          />
          <AdminMetricCard
            label="Organizer Requests"
            value={usersError ? null : metrics.organizerRequestCount}
            subLabel="Awaiting approval"
            icon={Users}
            tone={metrics.organizerRequestCount > 0 ? "attention" : "informational"}
            to="/admin/organizer-requests"
            actionLabel={metrics.organizerRequestCount > 0 ? "Review" : "View"}
            isLoading={isUsersLoading}
            onRetry={refetchUsers}
          />
          <AdminMetricCard
            label="Total Venues"
            value={metrics.venueCount}
            subLabel="Active venues"
            icon={MapPin}
            tone="informational"
            to="/admin/venues"
            actionLabel="Manage"
            isLoading={isLoading}
            onRetry={refetch}
          />
          <AdminMetricCard
            label="Total Users"
            value={userCountError ? null : (userCount ?? 0)}
            subLabel="Registered"
            icon={Users}
            tone="informational"
            to="/admin/users"
            actionLabel="Manage"
            isLoading={isUserCountLoading}
            onRetry={refetchUserCount}
          />
        </div>

        <AdminNeedsAttention
          items={attentionItems}
          isLoading={isLoading || isUsersLoading}
          error={error ?? usersError}
          onRetry={refetch}
        />

        <AdminUpcomingEvents
          events={upcoming}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
      </div>
    </>
  );
}
