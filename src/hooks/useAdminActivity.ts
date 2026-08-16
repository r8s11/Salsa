import { useQuery } from "@tanstack/react-query";
import { fetchActivityLogs, fetchActivityLog } from "../features/admin/api/auditLogActivityRepo";
import type { ActivityFiltersForRpc } from "../features/admin/api/auditLogActivityRepo";

/**
 * Admin activity list query.
 *
 * Server-side pagination + filtering via the admin_audit_log RPC.
 * The query key encodes the filter parameters so each distinct filter
 * combination gets its own cache entry.
 */
export function useAdminActivity(params: ActivityFiltersForRpc) {
  const query = useQuery({
    queryKey: ["admin", "activity", params],
    queryFn: () => fetchActivityLogs(params),
    placeholderData: (previousData) => previousData,
  });

  return {
    entries: query.data?.entries ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Single activity detail query.
 */
export function useAdminActivityDetail(id: string | null) {
  const query = useQuery({
    queryKey: ["admin", "activity", id ?? "null"],
    queryFn: () => fetchActivityLog(id!),
    enabled: id !== null,
  });

  return {
    entry: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
