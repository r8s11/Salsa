import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEntityDirectory } from "../entitiesRepo";
import type { PublicEntityKind } from "../model";

export const ENTITY_DIRECTORY_PAGE_SIZE = 24;

export type DirectorySearch = { query: string; city: string; kind?: PublicEntityKind };

export function useEntityDirectory(kind?: PublicEntityKind) {
  const [search, setSearch] = useState<DirectorySearch>({ query: "", city: "", kind });
  const [searched, setSearched] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = ENTITY_DIRECTORY_PAGE_SIZE;
  const active = Boolean(kind) || searched;
  const { data = [], isPending, error, refetch } = useQuery({
    queryKey: ["public-entity-directory", search.kind ?? null, search.query, search.city || null, limit, offset],
    queryFn: () => fetchEntityDirectory({ ...search, limit, offset }),
    enabled: active,
  });

  return {
    active,
    entities: data,
    isPending,
    error,
    offset,
    pageSize: limit,
    retry: () => void refetch(),
    setOffset,
    submitSearch(next: DirectorySearch) {
      setSearch(next);
      setOffset(0);
      setSearched(true);
    },
    clearSearch() {
      setSearch({ query: "", city: "", kind });
      setOffset(0);
      setSearched(false);
    },
  };
}

export type EntityDirectory = ReturnType<typeof useEntityDirectory>;
