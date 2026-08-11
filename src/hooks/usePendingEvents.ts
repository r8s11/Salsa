import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPendingEvents, setEventStatus } from "../features/events/api/eventsRepo";

export function usePendingEvents() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["events", "pending"],
    queryFn: fetchPendingEvents,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      setEventStatus(id, status),
    onSuccess: () => {
      // Invalidates the pending queue AND the public per-city query, so an
      // approval shows up on the calendar without a manual refetch.
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    pending: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
    decide: mutation.mutate,
    // Gated on isPending: true only while THIS mutation call is in flight.
    decidingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
    decidingStatus: mutation.isPending ? (mutation.variables?.status ?? null) : null,
    // Gated on isError instead: mutation.variables persists after the
    // mutation settles (until the next mutate() call), so this stays
    // truthy for the failing card even after isPending flips back to
    // false — unlike decidingId, which must NOT still point at the
    // failed card once it's no longer "in flight".
    decideErrorId: mutation.isError ? (mutation.variables?.id ?? null) : null,
    decideError: mutation.error ? mutation.error.message : null,
  };
}
