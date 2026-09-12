import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSavedVenues, saveVenue, unsaveVenue } from "../api/savedVenuesRepo";
import type { SavedVenueRow } from "../model/savedVenue";
import { useAuth } from "../../../contexts/useAuth";

const savedVenueKey = (userId: string | undefined) => ["saved-venues", userId] as const;

/**
 * Saved-venue state for the current user. Query key is scoped to the user id
 * so cache from one session never bleeds into another after sign-out/sign-in.
 *
 * Mutations are optimistic: Save flips the control immediately, Unsave removes
 * the row from the list, and a failed mutation rolls the cache back to the
 * pre-mutation snapshot.
 */
export function useSavedVenues() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: savedVenueKey(userId),
    queryFn: fetchSavedVenues,
    enabled: !!userId,
  });

  const saved = query.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (venueId: string) => saveVenue(venueId),
    onMutate: async (venueId: string) => {
      await queryClient.cancelQueries({ queryKey: savedVenueKey(userId) });
      const previous = queryClient.getQueryData<SavedVenueRow[]>(savedVenueKey(userId));
      queryClient.setQueryData<SavedVenueRow[]>(savedVenueKey(userId), (old) => [
        {
          venue_id: venueId,
          name: "",
          slug: null,
          city: null,
          status: "active",
          created_at: new Date().toISOString(),
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _venueId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(savedVenueKey(userId), ctx.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedVenueKey(userId) }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (venueId: string) => unsaveVenue(venueId),
    onMutate: async (venueId: string) => {
      await queryClient.cancelQueries({ queryKey: savedVenueKey(userId) });
      const previous = queryClient.getQueryData<SavedVenueRow[]>(savedVenueKey(userId));
      queryClient.setQueryData<SavedVenueRow[]>(savedVenueKey(userId), (old) =>
        (old ?? []).filter((row) => row.venue_id !== venueId)
      );
      return { previous };
    },
    onError: (_err, _venueId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(savedVenueKey(userId), ctx.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedVenueKey(userId) }),
  });

  return {
    savedVenues: saved,
    isLoading: query.isPending && !!userId,
    isError: query.isError,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    isSaved: (venueId: string) => saved.some((row) => row.venue_id === venueId),
    save: saveMutation.mutate,
    unsave: unsaveMutation.mutate,
    isSaving: saveMutation.isPending,
    isUnsaving: unsaveMutation.isPending,
    saveError: saveMutation.error?.message ?? null,
    unsaveError: unsaveMutation.error?.message ?? null,
  };
}
