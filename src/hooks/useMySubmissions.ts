import { useQuery } from "@tanstack/react-query";
import { fetchOwnEventSubmissions } from "../features/admin/api/submissionsRepo";
import { submissionToDatabaseEvent } from "../features/host/model/ownerSubmissions";
import { fetchMySubmissions, fetchMyApprovedEvents } from "../features/events/api/eventsRepo";

export function useMySubmissions(userId: string | undefined) {
  const submissionsQuery = useQuery({
    queryKey: ["submissions", "mine", userId],
    queryFn: () => fetchMySubmissions(userId!),
    enabled: !!userId,
  });
  const ownerSubmissionsQuery = useQuery({
    queryKey: ["event-submissions", "mine", userId],
    queryFn: () => fetchOwnEventSubmissions(userId!),
    enabled: !!userId,
  });

  const approvedQuery = useQuery({
    queryKey: ["approved-events", "mine", userId],
    queryFn: () => fetchMyApprovedEvents(userId!),
    enabled: !!userId,
  });

  const submissions = [
    ...(submissionsQuery.data ?? []),
    ...(ownerSubmissionsQuery.data ?? []).flatMap((submission) => {
      const event = submissionToDatabaseEvent(submission);
      return event ? [event] : [];
    }),
  ];

  return {
    submissions,
    approvedEvents: approvedQuery.data ?? [],
    isLoading:
      submissionsQuery.isPending || ownerSubmissionsQuery.isPending || approvedQuery.isPending,
    error:
      submissionsQuery.error?.message ||
      ownerSubmissionsQuery.error?.message ||
      approvedQuery.error?.message ||
      null,
    refetch: () => {
      submissionsQuery.refetch();
      ownerSubmissionsQuery.refetch();
      approvedQuery.refetch();
    },
  };
}
