// Purpose: Wrapper hook for event data (allows future enhancements)
//
// Currently sourced from a live ICS feed via /api/ics (proxied to golatindance.com)
// while the Supabase events table is still being populated.
// To revert: swap useIcsEvents(city) → useSupabaseEvents().

import { useCity } from "../contexts/CityContext";
import { useIcsEvents } from "./useIcsEvents";

export function useEvents() {
  const { city } = useCity();
  const { events, loading, error } = useIcsEvents(city);

  return {
    events,
    loading,
    error,
  };
}
