import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchVenueDirectory,
  fetchVenueDetail,
  createVenue,
  updateVenue,
  archiveVenue,
  restoreVenue,
  mergeVenues,
  deleteVenue,
  countVenueEvents,
  fetchVenueAuditLog,
} from "../api/venuesRepo";
import type { VenueForm, VenueStatus } from "../model/venuesQuery";

/**
 * Admin venue data + mutations.
 *
 * Directory query key: ["admin", "venues"] — source of truth for the queue page.
 * Single-venue query: ["admin", "venue", id] — powers the detail page.
 * Both share the invalidate target so any create/update/archive/delete/merge
 * refreshes the directory.
 */
export function useAdminVenues() {
  const queryClient = useQueryClient();

  const directoryQuery = useQuery({
    queryKey: ["admin", "venues"],
    queryFn: () =>
      fetchVenueDirectory({
        search: undefined,
        status: undefined,
        city: undefined,
        state: undefined,
        has_upcoming: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "venues"] });
  };

  const createMutation = useMutation({
    mutationFn: (form: VenueForm) => createVenue(form),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: VenueForm }) => updateVenue(id, form),
    onSuccess: () => invalidate(),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveVenue(id),
    onSuccess: () => invalidate(),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, targetStatus }: { id: string; targetStatus?: VenueStatus }) =>
      restoreVenue(id, targetStatus),
    onSuccess: () => invalidate(),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: string; mergeId: string }) =>
      mergeVenues(keepId, mergeId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["admin", "venue"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => invalidate(),
  });

  return {
    venues: directoryQuery.data,
    isLoading: directoryQuery.isPending,
    error: directoryQuery.error ? directoryQuery.error.message : null,
    refetch: directoryQuery.refetch,

    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error ? createMutation.error.message : null,

    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateErrorId: updateMutation.isError ? (updateMutation.variables?.id ?? null) : null,
    updateError: updateMutation.error ? updateMutation.error.message : null,

    archive: archiveMutation.mutate,
    isArchiving: archiveMutation.isPending,
    archiveError: archiveMutation.error ? archiveMutation.error.message : null,

    restore: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
    restoreError: restoreMutation.error ? restoreMutation.error.message : null,

    merge: mergeMutation.mutate,
    isMerging: mergeMutation.isPending,
    mergeError: mergeMutation.error ? mergeMutation.error.message : null,

    remove: deleteMutation.mutate,
    isRemoving: deleteMutation.isPending,
    removeError: deleteMutation.error ? deleteMutation.error.message : null,
  };
}

/**
 * Single-venue query for the detail page.
 * Reads from the directory result in cache when available;
 * falls back to fetchVenueDetail when opened directly via URL.
 */
export function useAdminVenue(id: string | null) {
  const query = useQuery({
    queryKey: ["admin", "venue", id ?? "null"],
    queryFn: () => fetchVenueDetail(id!),
    enabled: id !== null,
  });

  return {
    venue: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/** Count events referencing a venue — used by the delete safeguard. */
export function useVenueEventCount(venueId: string | null) {
  return useQuery({
    queryKey: ["admin", "venue-event-count", venueId ?? "null"],
    queryFn: () => countVenueEvents(venueId!),
    enabled: venueId !== null,
  });
}

/** Audit log entries for a venue (newest-first). */
export function useVenueAuditLog(venueId: string | null) {
  return useQuery({
    queryKey: ["admin", "venue-audit", venueId ?? "null"],
    queryFn: () => fetchVenueAuditLog(venueId!),
    enabled: venueId !== null,
  });
}
