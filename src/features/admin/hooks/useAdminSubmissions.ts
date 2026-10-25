import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RejectionReason } from "../model/submissions";
import { updateSubmission } from "../model/submissionsQuery";

export function useAdminSubmissions() {
  const queryClient = useQueryClient();

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      reason,
      message,
      note,
    }: {
      id: string;
      reason: RejectionReason;
      message: string;
      note: string;
    }) => {
      return updateSubmission(id, {
        status: "rejected",
        rejection_reason: reason,
        rejection_message: message,
        internal_note: note,
        reviewed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  return {
    rejectSubmission: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    rejectionError: rejectMutation.error,
  };
}
