import { useQuery } from "@tanstack/react-query";
import { fetchMySubmissions } from "../features/events/api/eventsRepo";

export function useMySubmissions(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["events", "mine", userId],
    queryFn: () => fetchMySubmissions(userId!),
    enabled: !!userId,
  });

  return {
    submissions: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
