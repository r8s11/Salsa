// Purpose: Fetch events from Supabase and convert to ScheduleXEvent format

import { useState, useEffect } from "react";
import {
  ScheduleXEvent,
  City,
  databaseEventToScheduleX,
} from "../types/events";
import { fetchApprovedEvents } from "../features/events/api/eventsRepo";
export function useSupabaseEvents(city: City) {
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchApprovedEvents(city);

        if (!mounted) return;

        const converted: ScheduleXEvent[] = data.map(
          databaseEventToScheduleX
        );

        setEvents(converted);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      mounted = false;
    };
  }, [city]);

  return { events, loading, error };
}
