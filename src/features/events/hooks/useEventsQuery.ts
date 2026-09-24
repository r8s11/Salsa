import { useQuery } from "@tanstack/react-query";
import { fetchApprovedEvents } from "../api/eventsRepo";
import { City, databaseEventToScheduleX } from "../../../types/events";

export function useEventsQuery(city: City) {
  const { data, isLoading, isFetching, error, errorUpdatedAt, refetch } = useQuery({
    queryKey: ["events", city],
    queryFn: () => fetchApprovedEvents(city),
  });

  return {
    events: data ? data.map(databaseEventToScheduleX) : [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? error.message : null,
    // The last attempt failed and there is nothing to show. Unlike `error`,
    // this holds through a retry: a refetch with no data puts the query back
    // in `pending` and clears `error`, which would swap the error UI (and the
    // focused Retry button) for a loading skeleton mid-retry.
    loadFailed: data === undefined && errorUpdatedAt > 0,
    refetch,
  };
}
