import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUserDirectory, setUserRole, setUserStatus } from "../features/admin/api/profilesRepo";
import type { AccountStatus, UserRole } from "../features/admin/model/usersQuery";

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUserDirectory,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => setUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles", "count"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AccountStatus;
      reason?: string | null;
    }) => setUserStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles", "count"] });
    },
  });

  return {
    users: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,

    setRole: roleMutation.mutate,
    // Gated on isPending: true only while THIS mutation call is in flight.
    settingRoleId: roleMutation.isPending ? (roleMutation.variables?.id ?? null) : null,
    // Gated on isError instead: mutation.variables persists after the
    // mutation settles (until the next mutate() call), so this stays
    // truthy for the failing row even after settingRoleId flips back to
    // false — unlike settingRoleId, which must NOT still point at the
    // failed row once it's no longer "in flight".
    roleErrorId: roleMutation.isError ? (roleMutation.variables?.id ?? null) : null,
    roleError: roleMutation.error ? roleMutation.error.message : null,

    setStatus: statusMutation.mutate,
    // Gated on isPending: true only while THIS mutation call is in flight.
    settingStatusId: statusMutation.isPending ? (statusMutation.variables?.id ?? null) : null,
    // Gated on isError instead: mutation.variables persists after the
    // mutation settles (until the next mutate() call), so this stays
    // truthy for the failing row even after settingStatusId flips back to
    // false — unlike settingStatusId, which must NOT still point at the
    // failed row once it's no longer "in flight".
    statusErrorId: statusMutation.isError ? (statusMutation.variables?.id ?? null) : null,
    statusError: statusMutation.error ? statusMutation.error.message : null,
  };
}
