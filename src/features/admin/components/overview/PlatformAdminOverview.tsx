import { useMemo } from "react";
import { useAdminEvents } from "../../hooks/useAdminEvents";
import { useAdminUsers } from "../../hooks/useAdminUsers";
import { useOrganizerRequests } from "../../hooks/useOrganizerRequests";
import { deriveUpcomingEvents } from "../../model/overviewMetrics";
import OperatorDesk from "../../../../components/desk/OperatorDesk";

export default function PlatformAdminOverview() {
  const { events: queried, isLoading, error, refetch } = useAdminEvents();
  const { users: queriedUsers, isLoading: isUsersLoading, error: usersError } = useAdminUsers();
  const { pendingCount: organizerPendingCount } = useOrganizerRequests();

  const events = useMemo(() => queried ?? [], [queried]);
  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);

  // `new Date()` stays inside useMemo: calling it in the render body trips
  // react-hooks/purity, the constraint AdminOverviewPage already documents.
  const { upcoming, flaggedUserCount } = useMemo(
    () => ({
      upcoming: deriveUpcomingEvents(events, new Date()),
      flaggedUserCount: users.filter((user) => user.status === "flagged").length,
    }),
    [events, users]
  );

  return (
    <OperatorDesk
      role="admin"
      upcoming={upcoming}
      organizerRequestCount={organizerPendingCount ?? 0}
      flaggedUserCount={flaggedUserCount}
      isLoading={isLoading || isUsersLoading}
      error={error ?? usersError}
      onRetry={refetch}
    />
  );
}
