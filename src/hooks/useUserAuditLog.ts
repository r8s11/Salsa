import { useQuery } from "@tanstack/react-query";
import { fetchUserAuditLog } from "../features/admin/api/auditLogRepo";

// entityId is null for a guest row's underlying identity concept — audit
// log entries only ever exist for profile ids (admin_set_user_role/status
// require an existing profiles row), so the query is disabled for guests
// rather than issuing a request that can never return rows.
export function useUserAuditLog(entityId: string | null) {
  const query = useQuery({
    queryKey: ["admin", "auditLog", entityId],
    queryFn: () => fetchUserAuditLog(entityId!),
    enabled: entityId !== null,
  });

  return {
    entries: query.data,
    isLoading: entityId !== null && query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
