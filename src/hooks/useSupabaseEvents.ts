// Purpose: Fetch events from Supabase and convert to ScheduleXEvent format

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  DatabaseEvent,
  ScheduleXEvent,
  City,
  databaseEventToScheduleX,
} from "../types/events";

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

        const { data, error: supabaseError } = await supabase
          .from("events")
          .select("*")
          .eq("status", "approved")
          .eq("city", city)
          .order("event_date", { ascending: true });

        if (!mounted) return;

        if (supabaseError) {
          setError(supabaseError.message);
          return;
        }

        const converted: ScheduleXEvent[] = ((data as DatabaseEvent[]) || []).map(
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
