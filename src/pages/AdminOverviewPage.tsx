import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, TriangleAlert, Users, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useAdminUserCount } from "../hooks/useAdminUserCount";
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
  const {
    count: userCount,
    isLoading: isUserCountLoading,
    error: userCountError,
    refetch: refetchUserCount,
  } = useAdminUserCount();

  const events = useMemo(() => queried ?? [], [queried]);

  const { metrics, attentionItems, upcoming, todayLabel } = useMemo(() => {
    // Kept inside useMemo — calling `new Date()` in the render body trips
    // react-hooks/purity, which already fired on this file once.
    const now = new Date();
    const metrics = deriveOverviewMetrics(events, now);
    const upcoming = deriveUpcomingEvents(events, now);
    const todayLabel = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const attentionItems: AttentionItem[] = [];
    if (metrics.pendingCount > 0) {
      const n = metrics.pendingCount;
      attentionItems.push({
        id: "pending",
        severity: "action",
        message: `${n} event submission${n === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/events?status=pending",
      });
    }
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
  }, [events]);

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

      {(isLoading || isUserCountLoading) && (
        <p role="status" className="admin-overview-page__status">
          Loading overview…
        </p>
      )}

      <div className="admin-overview-page__body">
        <div className="admin-overview-page__metrics">
          <AdminMetricCard
            label="Upcoming Events"
            value={error ? null : metrics.upcomingCount}
            subLabel="Next 30 days"
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
            to="/admin/events?status=pending"
            actionLabel="Review"
            isLoading={isLoading}
            onRetry={refetch}
          />
          <AdminMetricCard
            label="Incomplete Events"
            value={error ? null : metrics.incompleteCount}
            subLabel="Missing details"
            icon={TriangleAlert}
            tone="attention"
            to="/admin/events?flag=incomplete"
            actionLabel="Fix"
            isLoading={isLoading}
            onRetry={refetch}
          />
          <AdminMetricCard
            label="Total Users"
            value={userCountError ? null : (userCount ?? 0)}
            subLabel="Registered"
            icon={Users}
            tone="informational"
            isLoading={isUserCountLoading}
            onRetry={refetchUserCount}
          />
        </div>

        <AdminNeedsAttention
          items={attentionItems}
          isLoading={isLoading}
          error={error}
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
