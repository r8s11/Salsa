import { useMemo } from "react";
import { useAuth } from "../../contexts/useAuth";
import ModeratorOverview from "../../components/Moderator/ModeratorOverview";
import PlatformAdminOverview from "../../components/Admin/PlatformAdminOverview";
import { useAdminEvents } from "../../features/admin/hooks/useAdminEvents";
import { useAdminUsers } from "../../features/admin/hooks/useAdminUsers";
import { useAdminVenues } from "../../features/admin/hooks/useAdminVenues";
import { useOrganizerRequests } from "../../features/admin/hooks/useOrganizerRequests";
import {
  deriveOverviewMetrics,
  deriveUpcomingEvents,
} from "../../features/admin/model/overviewMetrics";

// Host (the organizer role) never reaches /admin: RequireReviewer admits only
// admin and moderator. Host surfaces live under /host behind RequireOrganizer.
export default function AdminOverviewPage() {
  const { role } = useAuth();
  if (role === "moderator") return <ModeratorOverviewWrapper />;
  return <PlatformAdminOverview />;
}

function ModeratorOverviewWrapper() {
  const { events: queried, isLoading, error, refetch } = useAdminEvents();
  const { users: queriedUsers, isLoading: isUsersLoading, error: usersError } = useAdminUsers();
  const { pendingCount: organizerPendingCount } = useOrganizerRequests();
  const { venues: allVenues = [] } = useAdminVenues();

  const events = useMemo(() => queried ?? [], [queried]);
  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);

  // `new Date()` stays inside useMemo: calling it in the render body trips
  // react-hooks/purity.
  const { metrics, upcoming } = useMemo(() => {
    const now = new Date();
    return {
      metrics: deriveOverviewMetrics(
        events,
        now,
        0,
        0,
        users,
        organizerPendingCount ?? 0,
        allVenues.filter((venue) => venue.status !== "archived").length,
        allVenues.filter((venue) => venue.status === "archived").length
      ),
      upcoming: deriveUpcomingEvents(events, now),
    };
  }, [events, users, organizerPendingCount, allVenues]);

  return (
    <ModeratorOverview
      isLoading={isLoading}
      isUsersLoading={isUsersLoading}
      error={error}
      usersError={usersError}
      metrics={metrics}
      upcoming={upcoming}
      refetch={refetch}
    />
  );
}
