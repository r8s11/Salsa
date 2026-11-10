import { useQuery } from "@tanstack/react-query";
import { fetchEntityDirectory, type PublicEntityRef } from "../../entities/entitiesRepo";
import type { ManagedKind } from "../../workspaces/model";

/** Directory listings of one kind whose name matches what the person is typing. */
export function useExistingListingSearch(kind: ManagedKind, term: string) {
  const query = term.trim();
  return useQuery<PublicEntityRef[]>({
    queryKey: ["listing-request-existing", kind, query],
    queryFn: () => fetchEntityDirectory({ kind, query, limit: 8 }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
