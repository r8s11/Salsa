import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApprovedEvents } from "../api/eventsRepo";
import { City, databaseEventToScheduleX } from "../../../types/events";
import type { SubLocation } from "../../metros/model/sublocation";

/** Approved upcoming events for one metro or NYC borough; idle while no metro is chosen. */
export function useEventsQuery(city: City | null, subLocation: SubLocation | null = null) {
  const { data, isLoading, isFetching, error, errorUpdatedAt, refetch } = useQuery({
    queryKey: ["events", city, subLocation],
    queryFn: () => fetchApprovedEvents(city!, subLocation),
    enabled: city !== null,
  });
  // Incidental renders must not look like a different list collection.
  const events = useMemo(() => data ? data.map(databaseEventToScheduleX) : [], [data]);

  return {
    events,
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
