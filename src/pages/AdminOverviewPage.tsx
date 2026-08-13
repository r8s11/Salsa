import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, Users, Plus, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useAdminUserCount } from "../hooks/useAdminUserCount";
import { useAdminUsers } from "../hooks/useAdminUsers";
import {
  deriveOverviewMetrics,
  deriveUpcomingEvents,
} from "../features/admin/model/overviewMetrics";
import type { AttentionItem } from "../components/Admin/AdminNeedsAttention";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminMetricCard from "../components/Admin/AdminMetricCard";
import AdminNeedsAttention from "../components/Admin/AdminNeedsAttention";
import AdminUpcomingEvents from "../components/Admin/AdminUpcomingEvents";
import "./AdminOverviewPage.css";

export default function AdminOverviewPage() {
  const { events: queried, isLoading, error, refetch } = useAdminEvents();
  const { users: queriedUsers, isLoading: isUsersLoading, error: usersError, refetch: refetchUsers } = useAdminUsers();
  const {
    count: userCount,
    isLoading: isUserCountLoading,
    error: userCountError,
    refetch: refetchUserCount,
  } = useAdminUserCount();

  const events = useMemo(() => queried ?? [], [queried]);
  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);

  const { metrics, attentionItems, upcoming, todayLabel } = useMemo(() => {
    // Kept inside useMemo — calling `new Date()` in the render body trips
    // react-hooks/purity, which already fired on this file once.
    const now = new Date();
    const metrics = deriveOverviewMetrics(events, now, users);
    const upcoming = deriveUpcomingEvents(events, now);
    const todayLabel = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const attentionItems: AttentionItem[] = [];

    // Actionable: event submissions awaiting review (links to dedicated route)
    if (metrics.pendingCount > 0) {
      const n = metrics.pendingCount;
      attentionItems.push({
        id: "pending-submissions",
        severity: "action",
        message: `${n} event submission${n === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/submissions",
      });
    }

    // Organizer requests: Phase 21/26 requires a dedicated organizer_requests
    // table for pending approval tracking. That table does not exist yet
    // (see Docs/plans/phase6-admin-user-detail-management.md, "Recommended
    // Later"). Until it does, there are no organizer requests to surface in
    // Needs Attention — showing existing organizers here would conflate
    // "already approved" with "awaiting review".

    // Actionable: flagged accounts requiring review
    if (metrics.flaggedUserCount > 0) {
      const n = metrics.flaggedUserCount;
      attentionItems.push({
        id: "flagged-users",
        severity: "action",
        message: `${n} flagged account${n === 1 ? "" : "s"} requiring review`,
        actionLabel: "Review",
        to: "/admin/users?status=flagged",
      });
    }

    // Suggested: upcoming events with important missing information
    if (metrics.incompleteCount > 0) {
      const n = metrics.incompleteCount;
      attentionItems.push({
        id: "incomplete",
        severity: "suggested",
        message: `${n} upcoming event${n === 1 ? "" : "s"} missing venue, time, or image`,
        actionLabel: "Fix",
        to: "/admin/events?flag=incomplete",
      });
    }

    return { metrics, attentionItems, upcoming, todayLabel };
  }, [events, users]);

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
            icon={UserCheck}
            tone={metrics.organizerRequestCount > 0 ? "attention" : "informational"}
            to="/admin/users"
            actionLabel={metrics.organizerRequestCount > 0 ? "Review" : "View"}
            isLoading={isUsersLoading}
            onRetry={refetchUsers}
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
