import { useQuery } from "@tanstack/react-query";
import { fetchEntityDirectory, type EntityDirectoryParams } from "../entitiesRepo";

export function useEntityDirectory(params: EntityDirectoryParams) {
  return useQuery({
    queryKey: ["public-entity-directory", params.kind ?? null, params.query ?? "", params.city ?? null, params.limit ?? 50, params.offset ?? 0],
    queryFn: () => fetchEntityDirectory(params),
  });
}
