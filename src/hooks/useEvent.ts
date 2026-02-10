// Purpose: Wrapper hook for event data (allows future enhancements)

import { useSupabaseEvents } from "./useSupabaseEvents";

export function useEvents() {
  const { events, loading, error } = useSupabaseEvents();

  return {
    events,
    loading,
    error,
  };
}
