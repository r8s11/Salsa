import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  applyListChange,
  pageWindow,
  parseListState,
  type ListChange,
  type ListDefinition,
  type ListState,
  type PageWindow,
} from "../model/listState";

export interface ListStateHandle<View, Filters, Sort> {
  state: ListState<View, Filters, Sort>;
  change: (change: ListChange<View, Filters, Sort>, options?: { replace?: boolean }) => void;
}

/** Router adapter for model/listState: reads and writes the list state in the URL. */
export function useListState<View, Filters, Sort>(
  definition: ListDefinition<View, Filters, Sort>
): ListStateHandle<View, Filters, Sort> {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(
    () => parseListState(definition, searchParams),
    [definition, searchParams]
  );
  const change = useCallback(
    (next: ListChange<View, Filters, Sort>, options?: { replace?: boolean }) =>
      setSearchParams((previous) => applyListChange(definition, previous, next), options),
    [definition, setSearchParams]
  );
  return { state, change };
}

/**
 * Clamps the requested page against `total` and, once `total` is known,
 * rewrites an out-of-range `?page=` in place so the URL matches what is shown.
 * Pass `null` while the data is loading: an unknown total never clamps, so a
 * deep link to page 3 survives the first render.
 */
export function usePageWindow<View, Filters, Sort>(
  list: ListStateHandle<View, Filters, Sort>,
  total: number | null
): PageWindow {
  const { state, change } = list;
  const bounds = pageWindow(total ?? 0, state.page, state.size);
  const clampTo = total !== null && bounds.page !== state.page ? bounds.page : null;
  useEffect(() => {
    if (clampTo !== null) change({ page: clampTo }, { replace: true });
  }, [clampTo, change]);
  return bounds;
}
