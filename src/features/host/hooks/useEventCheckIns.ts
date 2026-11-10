import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEventCheckIns, checkInAttendee, reverseCheckIn } from "../api/attendanceRepo";
import type { CheckInInput, ReverseCheckInInput } from "../model/attendance";

export function useEventCheckIns(eventId: string | undefined) {
  const query = useQuery({
    queryKey: ["event-check-ins", eventId],
    queryFn: () => fetchEventCheckIns(eventId!),
    enabled: !!eventId,
  });

  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: (input: CheckInInput) => checkInAttendee(eventId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-check-ins", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summaries"] });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (input: ReverseCheckInInput) => reverseCheckIn(eventId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-check-ins", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summaries"] });
    },
  });

  return {
    checkIns: query.data ?? [],
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    checkIn: checkInMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
    reverseCheckIn: reverseMutation.mutateAsync,
    isReversing: reverseMutation.isPending,
  };
}
