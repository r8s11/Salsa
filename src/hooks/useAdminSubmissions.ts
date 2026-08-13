import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { submissionsRepo, type SubmissionUpdate } from "../features/admin/api/submissionsRepo";
import { type EventSubmission } from "../features/admin/model/submissions";

export function useAdminSubmissions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["submissions", "all"],
    queryFn: () => submissionsRepo.getPendingSubmissions(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: SubmissionUpdate }) =>
      submissionsRepo.updateSubmission(id, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  return {
    submissions: (query.data ?? []) as EventSubmission[],
    isLoading: query.isLoading,
    error: query.error,
    updateSubmission: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}
