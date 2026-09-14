import type { OverviewMetrics } from "../../features/admin/model/overviewMetrics";
import type { DatabaseEvent } from "../../features/events/model/types";
import OperatorDesk from "../Desk/OperatorDesk";

interface Props {
  isLoading: boolean;
  isUsersLoading: boolean;
  error: string | null;
  usersError: string | null;
  metrics: OverviewMetrics;
  upcoming: DatabaseEvent[];
  refetch: () => void;
}

/**
 * A moderator reads the same desk as an admin. The role changes which
 * counts stand in the rule and removes event creation; it never changes
 * the language of the week.
 */
export default function ModeratorOverview({
  isLoading,
  isUsersLoading,
  error,
  usersError,
  metrics,
  upcoming,
  refetch,
}: Props) {
  return (
    <OperatorDesk
      role="moderator"
      upcoming={upcoming}
      organizerRequestCount={metrics.organizerRequestCount}
      flaggedUserCount={metrics.flaggedUserCount}
      isLoading={isLoading || isUsersLoading}
      error={error ?? usersError}
      onRetry={refetch}
    />
  );
}
