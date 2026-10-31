import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveLocations, fetchActiveMetros, fetchMetros } from "../api/metrosRepo";
import { metroLabelFromSlug, type MetroSlug } from "../model/metro";

export const METROS_QUERY_KEY = ["metros", "all"] as const;
export const ACTIVE_METROS_QUERY_KEY = ["metros", "active"] as const;
export const ACTIVE_LOCATIONS_QUERY_KEY = ["metros", "active-locations"] as const;

/** Every registered metro. Changes rarely; cached for the session. */
export function useMetros() {
  const query = useQuery({
    queryKey: METROS_QUERY_KEY,
    queryFn: fetchMetros,
    staleTime: 60 * 60 * 1000,
  });
  return {
    metros: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
  };
}

/** Metros with approved upcoming events. */
export function useActiveMetros() {
  const query = useQuery({ queryKey: ACTIVE_METROS_QUERY_KEY, queryFn: fetchActiveMetros });
  return {
    activeMetros: query.data ?? [],
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error?.message ?? null,
    loadFailed: query.data === undefined && query.errorUpdatedAt > 0,
    refetch: query.refetch,
  };
}

/** One shared inventory request, enabled only while a location picker is open. */
export function useActiveLocations(enabled: boolean) {
  const query = useQuery({
    queryKey: ACTIVE_LOCATIONS_QUERY_KEY,
    queryFn: fetchActiveLocations,
    enabled,
  });
  return {
    activeLocations: query.data ?? [],
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error?.message ?? null,
    loadFailed: query.data === undefined && query.errorUpdatedAt > 0,
    refreshFailed: query.isRefetchError,
    refetch: query.refetch,
  };
}

/** Slug → display name, falling back to a title-cased slug before load. */
export function useMetroName() {
  const { metros } = useMetros();
  return useCallback(
    (slug: MetroSlug | null | undefined) =>
      slug ? (metros.find((metro) => metro.slug === slug)?.name ?? metroLabelFromSlug(slug)) : "",
    [metros]
  );
}
