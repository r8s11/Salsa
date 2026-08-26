import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUserDirectory,
  setUserRole,
  setUserStatus,
  createUserAccount,
} from "../features/admin/api/profilesRepo";
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

  const createMutation = useMutation({
    mutationFn: createUserAccount,
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
    settingRoleId: roleMutation.isPending ? (roleMutation.variables?.id ?? null) : null,
    roleErrorId: roleMutation.isError ? (roleMutation.variables?.id ?? null) : null,
    roleError: roleMutation.error ? roleMutation.error.message : null,

    setStatus: statusMutation.mutate,
    settingStatusId: statusMutation.isPending ? (statusMutation.variables?.id ?? null) : null,
    statusErrorId: statusMutation.isError ? (statusMutation.variables?.id ?? null) : null,
    statusError: statusMutation.error ? statusMutation.error.message : null,

    createUser: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error ? createMutation.error.message : null,
  };
}
