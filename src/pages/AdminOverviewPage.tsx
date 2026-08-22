import { useMemo } from "react";
import { useAuth } from "../contexts/useAuth";
import HostDashboard from "../components/Host/HostDashboard";
import ModeratorOverview from "../components/Moderator/ModeratorOverview";
import PlatformAdminOverview from "../components/Admin/PlatformAdminOverview";
import { AttentionItem } from "../components/Admin/AdminNeedsAttention";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminVenues } from "../features/admin/hooks/useAdminVenues";
import { useOrganizerRequests } from "../features/admin/hooks/useOrganizerRequests";
import {
  deriveOverviewMetrics,
  deriveUpcomingEvents,
} from "../features/admin/model/overviewMetrics";


export default function AdminOverviewPage() {
  const { role } = useAuth();
  if (role === "organizer") return <HostDashboard />;
  if (role === "moderator") return <ModeratorOverviewWrapper />;
  return <PlatformAdminOverview />;
}

function ModeratorOverviewWrapper() {
  const { events: queried, isLoading, error, refetch } = useAdminEvents();
  const {
    users: queriedUsers,
    isLoading: isUsersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useAdminUsers();
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

    const attentionItems: AttentionItem[] = [];
    if (metrics.pendingCount > 0) {
      attentionItems.push({
        id: "pending-submissions",
        severity: "action",
        message: `${metrics.pendingCount} event submission${metrics.pendingCount === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/submissions",
      });
    }
    if (metrics.organizerRequestCount > 0) {
      attentionItems.push({
        id: "organizer-requests",
        severity: "action",
        message: `${metrics.organizerRequestCount} organizer request${metrics.organizerRequestCount === 1 ? "" : "s"} waiting for review`,
        actionLabel: "Review",
        to: "/admin/organizer-requests",
      });
    }
    if (metrics.flaggedUserCount > 0) {
      attentionItems.push({
        id: "flagged-users",
        severity: "action",
        message: `${metrics.flaggedUserCount} flagged account${metrics.flaggedUserCount === 1 ? "" : "s"} requiring review`,
        actionLabel: "Review",
        to: "/admin/users?status=flagged",
      });
    }
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
    <ModeratorOverview
      isLoading={isLoading}
      isUsersLoading={isUsersLoading}
      error={error}
      usersError={usersError}
      metrics={metrics}
      attentionItems={attentionItems}
      upcoming={upcoming}
      todayLabel={todayLabel}
      refetch={refetch}
      refetchUsers={refetchUsers}
    />
  );
}
