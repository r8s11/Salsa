import { useQuery } from "@tanstack/react-query";
import { fetchProfileCount } from "../features/admin/api/profilesRepo";

export function useAdminUserCount() {
  const query = useQuery({
    queryKey: ["profiles", "count"],
    queryFn: fetchProfileCount,
  });

  return {
    count: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
