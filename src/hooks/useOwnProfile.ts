import { useQuery } from "@tanstack/react-query";
import { fetchOwnProfile } from "../features/account/api/accountRepo";

export function useOwnProfile(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["profile", "mine", userId],
    queryFn: () => fetchOwnProfile(userId!),
    enabled: !!userId,
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isPending && !!userId,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
