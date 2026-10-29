import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApprovedEvents } from "../api/eventsRepo";
import { City, databaseEventToScheduleX } from "../../../types/events";
import type { SubLocation } from "../../metros/model/sublocation";

/** Approved events within the selected city, optional borough, and neighborhood. */
export function useEventsQuery(city: City | null, subLocation: SubLocation | null = null, neighborhood: string | null = null) {
  const { data, isLoading, isFetching, error, errorUpdatedAt, refetch } = useQuery({
    queryKey: neighborhood ? ["events", city, subLocation, neighborhood] : ["events", city, subLocation],
    queryFn: () => fetchApprovedEvents(city!, subLocation, neighborhood),
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
