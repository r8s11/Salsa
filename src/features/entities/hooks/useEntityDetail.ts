import { useQuery } from "@tanstack/react-query";
import { fetchEntityDetail } from "../entitiesRepo";
import type { PublicEntityKind } from "../model";

export function useEntityDetail(kind: PublicEntityKind, slug: string) {
  return useQuery({
    queryKey: ["public-entity-detail", kind, slug],
    queryFn: () => fetchEntityDetail(kind, slug),
    enabled: Boolean(slug),
  });
}
