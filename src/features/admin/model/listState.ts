// List state: the view, filters, sort, page and page size of an admin list,
// carried entirely in the URL. Each list supplies codecs for the parts that
// vary (view, filters, sort); this module owns everything around them —
// page and size parsing, which changes reset or preserve the page, keeping
// unrelated params (?edit=, ?new=) intact, and clamping the page to the data.
// Pure: no React, no router. hooks/useListState.ts is the router adapter.

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type SortDir = "asc" | "desc";

/** Param writes: a null or empty-string value deletes the key. */
export type ParamPatch = Record<string, string | null>;

/**
 * Reads one part of the list state from the URL and writes it back.
 * `toParams` receives the params being replaced, so a codec can clear a
 * legacy alias it reads (Events' `flag=upcoming`) without touching other keys.
 */
export interface ParamCodec<T, Context = void> {
  parse(params: URLSearchParams, context: Context): T;
  toParams(value: T, previous: URLSearchParams): ParamPatch;
}

export interface ListDefinition<View, Filters, Sort> {
  view: ParamCodec<View>;
  filters: ParamCodec<Filters>;
  /** Sort may default per view (Events sorts Upcoming soonest-first). */
  sort: ParamCodec<Sort, View>;
}

export interface ListState<View, Filters, Sort> {
  view: View;
  filters: Filters;
  sort: Sort;
  /** As requested by the URL; may exceed the last page. Use pageWindow to clamp. */
  page: number;
  size: number;
}

export type ListChange<View, Filters, Sort> = Partial<ListState<View, Filters, Sort>>;

export interface PageWindow {
  /** Requested page clamped to [1, pageCount]. */
  page: number;
  pageCount: number;
  size: number;
  total: number;
  /** Zero-based index of the first row on the page. */
  offset: number;
  /** One-based, inclusive row range for "Showing 26–50 of 80"; 0–0 when empty. */
  from: number;
  to: number;
}

function parsePage(params: URLSearchParams): number {
  const raw = Number(params.get("page"));
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

function parseSize(params: URLSearchParams): number {
  const raw = Number(params.get("size"));
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

export function parseListState<View, Filters, Sort>(
  definition: ListDefinition<View, Filters, Sort>,
  params: URLSearchParams
): ListState<View, Filters, Sort> {
  const view = definition.view.parse(params);
  return {
    view,
    filters: definition.filters.parse(params),
    sort: definition.sort.parse(params, view),
    page: parsePage(params),
    size: parseSize(params),
  };
}

/**
 * Returns the params after `change`. Only keys the codecs write, plus `page`
 * and `size`, are touched; every other param survives.
 *
 * Page rules, unless `change.page` is given explicitly:
 * - a view or filter change returns to the first page;
 * - a size change keeps the first visible row on screen;
 * - a sort change keeps the current page.
 */
export function applyListChange<View, Filters, Sort>(
  definition: ListDefinition<View, Filters, Sort>,
  previous: URLSearchParams,
  change: ListChange<View, Filters, Sort>
): URLSearchParams {
  const next = new URLSearchParams(previous);
  const write = (patch: ParamPatch) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
  };

  if (change.view !== undefined) write(definition.view.toParams(change.view, previous));
  if (change.filters !== undefined) write(definition.filters.toParams(change.filters, previous));
  if (change.sort !== undefined) write(definition.sort.toParams(change.sort, previous));

  if (change.size !== undefined) {
    next.set("size", String(change.size));
    if (change.page === undefined) {
      const firstVisibleIndex = (parsePage(previous) - 1) * parseSize(previous);
      next.set("page", String(Math.floor(firstVisibleIndex / change.size) + 1));
    }
  }

  if (change.page !== undefined) next.set("page", String(change.page));
  else if (change.view !== undefined || change.filters !== undefined) next.delete("page");

  return next;
}

export function pageWindow(total: number, page: number, size: number): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const offset = (clamped - 1) * size;
  return {
    page: clamped,
    pageCount,
    size,
    total,
    offset,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + size, total),
  };
}

/** A single-valued enum param (`?view=`, Activity's `?sort=`), falling back to `fallback`. */
export function enumParam<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T
): ParamCodec<T, unknown> {
  return {
    parse: (params) => {
      const raw = params.get(key);
      return values.includes(raw as T) ? (raw as T) : fallback;
    },
    toParams: (value) => ({ [key]: value }),
  };
}

/** Comma-separated multi-value param, keeping only allowed values. */
export function parseCsvParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[]
): T[] {
  return (params.get(key)?.split(",") ?? []).filter((value): value is T =>
    allowed.includes(value as T)
  );
}

export interface SortOption<Key extends string> {
  value: string;
  key: Key;
  dir: SortDir;
}

/**
 * Sort stored as one `?sort=<option value>` (Venues, Organizer requests).
 * A key/direction pair with no matching option clears the param, which
 * falls back to `fallback`.
 */
export function sortOptionParam<Key extends string>(
  options: readonly SortOption<Key>[],
  fallback: { key: Key; dir: SortDir }
): ParamCodec<{ key: Key; dir: SortDir }, unknown> {
  return {
    parse: (params) => {
      const option = options.find((candidate) => candidate.value === params.get("sort"));
      return option ? { key: option.key, dir: option.dir } : fallback;
    },
    toParams: (sort) => ({
      sort:
        options.find((option) => option.key === sort.key && option.dir === sort.dir)?.value ?? null,
    }),
  };
}
