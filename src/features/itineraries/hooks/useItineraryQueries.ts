import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApprovedEventsBetween, fetchApprovedEventsByIds } from "../../events/api/eventsRepo";
import type { City, DatabaseEvent } from "../../../types/events";
import {
  fetchItineraries,
  fetchItineraryDraft,
  fetchPublishedItinerary,
  fetchPublishedNeighbours,
} from "../api/itinerariesRepo";
import { weekBounds } from "../model/week";

export const ADMIN_ITINERARIES_KEY = ["admin", "itineraries"] as const;
export const adminItineraryKey = (id: string) => [...ADMIN_ITINERARIES_KEY, id] as const;
export const publicItineraryKey = (city: string, weekStart: string) =>
  ["itineraries", city, weekStart] as const;
export const weekEventsKey = (city: string, weekStart: string) =>
  ["events", "week", city, weekStart] as const;

export function useAdminItineraries() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ADMIN_ITINERARIES_KEY,
    queryFn: fetchItineraries,
  });
  return { itineraries: data ?? [], loading: isLoading, error: error ? error.message : null, refetch };
}

export function useItineraryDraft(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: adminItineraryKey(id ?? ""),
    queryFn: () => fetchItineraryDraft(id!),
    enabled: id !== null,
  });
  return {
    itinerary: data?.itinerary ?? null,
    draft: data?.draft ?? null,
    loading: isLoading,
    error: error ? error.message : null,
  };
}

/** A published itinerary with its events and the neighbouring published weeks. */
export function usePublishedItinerary(city: string, weekStart: string) {
  const published = useQuery({
    queryKey: publicItineraryKey(city, weekStart),
    queryFn: () => fetchPublishedItinerary(city, weekStart),
  });
  const ids = useMemo(() => published.data?.items.map((item) => item.eventId) ?? [], [published.data]);
  const events = useQuery({
    queryKey: [...publicItineraryKey(city, weekStart), "events", ids],
    queryFn: () => fetchApprovedEventsByIds(ids),
    enabled: published.data != null,
  });
  const neighbours = useQuery({
    queryKey: [...publicItineraryKey(city, weekStart), "neighbours"],
    queryFn: () => fetchPublishedNeighbours(city, weekStart),
  });
  const eventsById = useMemo(
    () => new Map<string, DatabaseEvent>((events.data ?? []).map((event) => [event.id, event])),
    [events.data]
  );
  const error = published.error ?? events.error ?? neighbours.error;

  return {
    itinerary: published.data?.itinerary ?? null,
    items: published.data?.items ?? [],
    events: eventsById,
    neighbours: neighbours.data ?? { previous: null, next: null },
    loading: published.isLoading || (published.data != null && events.isLoading),
    error: error ? error.message : null,
  };
}

/** Approved events whose start falls in the itinerary week. */
export function useWeekEvents(city: City, weekStart: string, timeZone: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: weekEventsKey(city, weekStart),
    queryFn: () => {
      const { startISO, endISO } = weekBounds(weekStart, timeZone);
      return fetchApprovedEventsBetween(city, startISO, endISO);
    },
  });
  return { events: data ?? [], loading: isLoading, error: error ? error.message : null };
}
