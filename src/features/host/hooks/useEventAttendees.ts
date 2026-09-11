import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEventAttendees,
  addEventAttendee,
  updateEventAttendee,
  deleteEventAttendee,
} from "../api/attendanceRepo";
import type { HostAttendeeInput } from "../model/attendance";

export function useEventAttendees(eventId: string | undefined) {
  const query = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => fetchEventAttendees(eventId!),
    enabled: !!eventId,
  });

  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (input: HostAttendeeInput) => addEventAttendee(eventId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      attendeeId,
      updates,
    }: {
      attendeeId: string;
      updates: Parameters<typeof updateEventAttendee>[1];
    }) => updateEventAttendee(attendeeId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attendeeId: string) => deleteEventAttendee(attendeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
    },
  });

  return {
    attendees: query.data ?? [],
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    addAttendee: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateAttendee: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteAttendee: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
