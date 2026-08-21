import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllEvents,
  setEventStatus,
  updateEvent,
  deleteEvent,
  createEventAsAdmin,
  duplicateEvent,
  AdminEventPayload,
} from "../features/events/api/eventsRepo";
import type { DatabaseEvent } from "../features/events/model/types";
import { useAuth } from "../contexts/useAuth";

export function useAdminEvents() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["events", "all"],
    queryFn: fetchAllEvents,
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: DatabaseEvent["status"];
      reason?: string;
    }) =>
      // Only Cancel carries a reason forward; every other transition clears
      // it so a later republish doesn't keep a stale cancellation_reason.
      setEventStatus(id, status, {
        cancellation_reason: status === "cancelled" ? (reason ?? null) : null,
      }),
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

  const duplicateMutation = useMutation({
    mutationFn: ({
      source,
      input,
    }: {
      source: DatabaseEvent;
      input: { date: string; time: string; publish: boolean };
    }) => duplicateEvent(source, input, { id: user!.id, email: user!.email ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    events: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,

    changeStatus: changeStatusMutation.mutate,
    // Gated on isPending: true only while THIS mutation call is in flight.
    changingStatusId: changeStatusMutation.isPending
      ? (changeStatusMutation.variables?.id ?? null)
      : null,
    // Gated on isError instead: mutation.variables persists after the
    // mutation settles (until the next mutate() call), so this stays
    // truthy for the failing card even after isPending flips back to
    // false — unlike changingStatusId, which must NOT still point at the
    // failed card once it's no longer "in flight".
    changeStatusErrorId: changeStatusMutation.isError
      ? (changeStatusMutation.variables?.id ?? null)
      : null,
    changeStatusError: changeStatusMutation.error ? changeStatusMutation.error.message : null,

    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error ? saveMutation.error.message : null,

    remove: removeMutation.mutate,
    removingId: removeMutation.isPending ? (removeMutation.variables ?? null) : null,
    removeErrorId: removeMutation.isError ? (removeMutation.variables ?? null) : null,
    removeError: removeMutation.error ? removeMutation.error.message : null,

    duplicate: duplicateMutation.mutate,
    isDuplicating: duplicateMutation.isPending,
    duplicateError: duplicateMutation.error ? duplicateMutation.error.message : null,
  };
}
