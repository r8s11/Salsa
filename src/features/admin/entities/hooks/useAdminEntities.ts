import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVenueDirectory } from "../../api/venuesRepo";
import {
  archiveAdminEntity,
  fetchAdminEntityDetail,
  fetchAdminEntityDirectory,
  mergeAdminEntities,
  saveAdminEntity,
} from "../api/entitiesRepo";
import type { EntityKind, EntityStatus } from "../model";

export function useAdminEntityDirectory(
  kind: EntityKind,
  query: string,
  status: EntityStatus | null,
  enabled = true
) {
  const result = useQuery({
    queryKey: ["admin", "entities", kind, query, status],
    queryFn: () => fetchAdminEntityDirectory({ kind, query, status }),
    enabled,
  });
  return {
    rows: result.data,
    isLoading: result.isPending,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}

export function useAdminVenueOptions(enabled: boolean) {
  const query = useQuery({
    queryKey: ["admin", "entity-venue-options"],
    queryFn: () => fetchVenueDirectory({ status: ["active"] }),
    enabled,
  });
  return query.data ?? [];
}

export function useAdminEntity(kind: EntityKind, id: string | null) {
  const query = useQuery({
    queryKey: ["admin", "entity", kind, id ?? "new"],
    queryFn: () => fetchAdminEntityDetail(kind, id!),
    enabled: id !== null,
  });
  return {
    entity: query.data ?? null,
    isLoading: id !== null && query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useAdminEntityActions(kind: EntityKind) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "entities", kind] });
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: Record<string, unknown> }) =>
      saveAdminEntity(kind, id, payload),
    onSuccess: (row) => {
      invalidate();
      queryClient.setQueryData(["admin", "entity", kind, row.id], row);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveAdminEntity(kind, id),
    onSuccess: (row) => {
      invalidate();
      queryClient.setQueryData(["admin", "entity", kind, row.id], row);
    },
  });
  const mergeMutation = useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: string; mergeId: string }) =>
      mergeAdminEntities(kind, keepId, mergeId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["admin", "entity", kind] });
    },
  });
  return {
    save: saveMutation.mutateAsync,
    archive: archiveMutation.mutateAsync,
    merge: mergeMutation.mutateAsync,
    isSaving: saveMutation.isPending || archiveMutation.isPending,
    isMerging: mergeMutation.isPending,
    error:
      saveMutation.error?.message ??
      archiveMutation.error?.message ??
      mergeMutation.error?.message ??
      null,
  };
}

