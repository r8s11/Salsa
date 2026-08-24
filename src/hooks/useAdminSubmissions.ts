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

  const approveMutation = useMutation({
    mutationFn: ({
      submissionId,
      taxonomyTermIds,
    }: {
      submissionId: string;
      taxonomyTermIds: string[];
    }) => submissionsRepo.approveSubmissionWithTaxonomy(submissionId, taxonomyTermIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy"] });
    },
  });

  return {
    submissions: (query.data ?? []) as EventSubmission[],
    isLoading: query.isLoading,
    error: query.error,
    updateSubmission: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    approveSubmissionWithTaxonomy: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,
  };
}
