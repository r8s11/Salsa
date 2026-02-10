// Purpose: Fetch events from Supabase and convert to ScheduleXEvent format

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DatabaseEvent, ScheduleXEvent, databaseEventToScheduleX } from "../types/events";

export function useSupabaseEvents() {
  // State for the events array (Starts empty)
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);

  // State for loading indicator (starts True because we fetch on mount)
  const [loading, setLoading] = useState(true);

  // State for error message (starts null because there are no errors)
  const [error, setError] = useState<string | null>(null);
  // useEffect runs when component mounts (empty dependency array [])
  useEffect(() => {
    let mounted = true;

    // Define async function to fetch events
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from("events")
          .select("*")
          .eq("status", "approved")
          .order("event_date", { ascending: true });

        // If component unmounted while fetching, don't update state
        if (!mounted) return;

        // Handle Supabase Error
        if (supabaseError) {
          setError(supabaseError.message);
          return;
        }
        // Conver database events to Schedule-X format
        // Data is DatabaseEvent[], we convert each to ScheduleXEvent
        const converted: ScheduleXEvent[] = ((data as DatabaseEvent[]) || []).map(
          databaseEventToScheduleX
        );

        setEvents(converted);
      } catch (err) {
        // handle unexpected errors
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        if (mounted) {
          // Always set loading to false when done
          setLoading(false);
        }
      }
    }
    // call the fetch function
    fetchEvents();
    // cleanup function
    return () => {
      mounted = false;
    };
  }, []);
  return { events, loading, error };
}
