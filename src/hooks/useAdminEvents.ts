import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllEvents,
  setEventStatus,
  updateEvent,
  deleteEvent,
  createEventAsAdmin,
  AdminEventPayload,
} from "../features/events/api/eventsRepo";
import { useAuth } from "../contexts/useAuth";

export function useAdminEvents() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["events", "all"],
    queryFn: fetchAllEvents,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      setEventStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: AdminEventPayload }) =>
      id === null
        ? createEventAsAdmin(payload, { id: user!.id, email: user!.email ?? null })
        : updateEvent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    events: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,

    decide: decideMutation.mutate,
    // Gated on isPending: true only while THIS mutation call is in flight.
    decidingId: decideMutation.isPending ? (decideMutation.variables?.id ?? null) : null,
    decidingStatus: decideMutation.isPending ? (decideMutation.variables?.status ?? null) : null,
    // Gated on isError instead: mutation.variables persists after the
    // mutation settles (until the next mutate() call), so this stays
    // truthy for the failing card even after isPending flips back to
    // false — unlike decidingId, which must NOT still point at the
    // failed card once it's no longer "in flight".
    decideErrorId: decideMutation.isError ? (decideMutation.variables?.id ?? null) : null,
    decideError: decideMutation.error ? decideMutation.error.message : null,

    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error ? saveMutation.error.message : null,

    remove: removeMutation.mutate,
    removingId: removeMutation.isPending ? (removeMutation.variables ?? null) : null,
    removeErrorId: removeMutation.isError ? (removeMutation.variables ?? null) : null,
    removeError: removeMutation.error ? removeMutation.error.message : null,
  };
}
