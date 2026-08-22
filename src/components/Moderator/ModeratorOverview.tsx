import { ClipboardCheck, Users, AlertTriangle, CalendarDays } from "lucide-react";
import type { AttentionItem } from "../Admin/AdminNeedsAttention";
import AdminPageHeader from "../Admin/AdminPageHeader";
import AdminMetricCard from "../Admin/AdminMetricCard";
import AdminNeedsAttention from "../Admin/AdminNeedsAttention";
import type { OverviewMetrics } from "../../features/admin/model/overviewMetrics";
import AdminUpcomingEvents from "../Admin/AdminUpcomingEvents";
import type { DatabaseEvent } from "../../features/events/model/types";



interface Props {
  isLoading: boolean;
  isUsersLoading: boolean;
  error: string | null;
  usersError: string | null;
  metrics: OverviewMetrics;
  attentionItems: AttentionItem[];
  upcoming: DatabaseEvent[];
  todayLabel: string;
  refetch: () => void;
  refetchUsers: () => void;
}

export default function ModeratorOverview({
  isLoading,
  isUsersLoading,
  error,
  usersError,
  metrics,
  attentionItems,
  upcoming,
  todayLabel,
  refetch,
  refetchUsers,
}: Props) {
  return (
    <>
      <AdminPageHeader
        title="Moderator Dashboard"
        description={`Regional review queue · ${todayLabel}`}
      />

      {(isLoading || isUsersLoading) && (
        <p role="status" className="admin-overview-page__status">
          Loading overview…
        </p>
      )}

      <div className="admin-overview-page__body">
        <div className="admin-overview-page__metrics">
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
            label="Flagged Users"
            value={usersError ? null : metrics.flaggedUserCount}
            subLabel="Requires attention"
            icon={AlertTriangle}
            tone={metrics.flaggedUserCount > 0 ? "attention" : "informational"}
            to="/admin/users?status=flagged"
            actionLabel="Review"
            isLoading={isUsersLoading}
            onRetry={refetchUsers}
          />
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
