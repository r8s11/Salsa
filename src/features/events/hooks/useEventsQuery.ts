import { useQuery } from "@tanstack/react-query";
import { fetchApprovedEvents } from "../api/eventsRepo";
import { City, databaseEventToScheduleX } from "../../../types/events";

export function useEventsQuery(city: City) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["events", city],
    queryFn: () => fetchApprovedEvents(city),
  });

  return {
    events: data ? data.map(databaseEventToScheduleX) : [],
    loading: isLoading,
    error: error ? error.message : null,
    refetch,
  };
}
