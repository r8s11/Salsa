import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateOwnProfile,
  type OwnProfileUpdate,
} from "../features/account/api/accountRepo";

export function useUpdateOwnProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (patch: OwnProfileUpdate) => updateOwnProfile(userId!, patch),
    onSuccess: (profile) => {
      if (!userId) return;
      queryClient.setQueryData(["profile", "mine", userId], profile);
    },
  });

  return {
    update: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
