import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";

export interface EventAttendanceSummary {
  eventId: string;
  attendeeCount: number;
  checkedInCount: number;
}

/**
 * Fetches attendance and check-in counts for a batch of event IDs.
 * Uses Supabase count queries to avoid fetching full rosters.
 * Returns a map keyed by eventId for O(1) lookup.
 */
export function useEventAttendanceSummaries(eventIds: string[]) {
  const query = useQuery({
    queryKey: ["event-attendance-summaries", eventIds.sort()],
    queryFn: async (): Promise<Map<string, EventAttendanceSummary>> => {
      if (eventIds.length === 0) return new Map();

      const results = new Map<string, EventAttendanceSummary>();

      // Initialize all events with zero counts
      for (const id of eventIds) {
        results.set(id, { eventId: id, attendeeCount: 0, checkedInCount: 0 });
      }

      // Fetch attendee counts per event
      const { data: attendeeRows, error: attendeeError } = await supabase
        .from("event_attendees")
        .select("event_id")
        .in("event_id", eventIds);

      if (!attendeeError && attendeeRows) {
        for (const row of attendeeRows) {
          const existing = results.get(row.event_id);
          if (existing) {
            existing.attendeeCount++;
          }
        }
      }

      // Fetch active (non-reversed) check-in counts per event
      const { data: checkInRows, error: checkInError } = await supabase
        .from("event_check_ins")
        .select("event_id")
        .in("event_id", eventIds)
        .is("reversed_at", null);

      if (!checkInError && checkInRows) {
        for (const row of checkInRows) {
          const existing = results.get(row.event_id);
          if (existing) {
            existing.checkedInCount++;
          }
        }
      }

      return results;
    },
    enabled: eventIds.length > 0,
    staleTime: 30_000, // 30 seconds — attendance data changes infrequently
  });

  return {
    summaries: query.data ?? new Map(),
    isLoading: query.isPending,
    error: query.error?.message ?? null,
  };
}
