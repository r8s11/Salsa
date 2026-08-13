import { useQuery } from "@tanstack/react-query";
import { fetchMySubmissions, fetchMyApprovedEvents } from "../features/events/api/eventsRepo";

export function useMySubmissions(userId: string | undefined) {
  const submissionsQuery = useQuery({
    queryKey: ["submissions", "mine", userId],
    queryFn: () => fetchMySubmissions(userId!),
    enabled: !!userId,
  });

  const approvedQuery = useQuery({
    queryKey: ["approved-events", "mine", userId],
    queryFn: () => fetchMyApprovedEvents(userId!),
    enabled: !!userId,
  });

  return {
    submissions: submissionsQuery.data ?? [],
    approvedEvents: approvedQuery.data ?? [],
    isLoading: submissionsQuery.isPending || approvedQuery.isPending,
    error: submissionsQuery.error?.message || approvedQuery.error?.message || null,
    refetch: () => {
      submissionsQuery.refetch();
      approvedQuery.refetch();
    },
  };
}
