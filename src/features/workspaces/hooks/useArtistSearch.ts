import { useQuery } from "@tanstack/react-query";
import { fetchEntityDirectory } from "../../entities/entitiesRepo";

export const ARTIST_SEARCH_KEY = "workspace-artist-search";
export const ARTIST_SEARCH_MIN_LENGTH = 2;
const RESULT_LIMIT = 8;

/**
 * Active, public artists whose name matches `term`. Reads the public directory,
 * so only artists a dancer could open at /i/:slug can be offered, which is also
 * exactly what `school_offering_save` accepts as an instructor id.
 */
export function useArtistSearch(term: string, enabled: boolean) {
  const query = term.trim();
  return useQuery({
    queryKey: [ARTIST_SEARCH_KEY, query.toLowerCase()],
    queryFn: async () => {
      const refs = await fetchEntityDirectory({ kind: "instructor", query, limit: RESULT_LIMIT });
      return refs.filter((ref) => ref.kind === "instructor");
    },
    enabled: enabled && query.length >= ARTIST_SEARCH_MIN_LENGTH,
    staleTime: 60_000,
    retry: false,
  });
}
