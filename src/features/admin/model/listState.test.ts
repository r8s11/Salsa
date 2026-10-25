import { describe, expect, it } from "vitest";
import {
  applyListChange,
  enumParam,
  pageWindow,
  parseCsvParam,
  parseListState,
  type ListDefinition,
} from "./listState";

type View = "all" | "active" | "archived";
type Filters = { q: string; tags: ("a" | "b")[] };
type Sort = { key: "name" | "date"; dir: "asc" | "desc" };

const definition: ListDefinition<View, Filters, Sort> = {
  view: enumParam<View>("view", ["all", "active", "archived"], "all"),
  filters: {
    parse: (params) => ({ q: params.get("q") ?? "", tags: parseCsvParam(params, "tags", ["a", "b"]) }),
    toParams: (filters) => ({ q: filters.q, tags: filters.tags.join(",") }),
  },
  sort: {
    // Sort default depends on the view, as Events' does.
    parse: (params, view) => ({
      key: params.get("sort") === "date" ? "date" : "name",
      dir: params.get("dir") === "desc" || (!params.get("dir") && view === "archived") ? "desc" : "asc",
    }),
    toParams: (sort) => ({ sort: sort.key, dir: sort.dir }),
  },
};

const parse = (query: string) => parseListState(definition, new URLSearchParams(query));
const change = (query: string, patch: Parameters<typeof applyListChange<View, Filters, Sort>>[2]) =>
  Object.fromEntries(applyListChange(definition, new URLSearchParams(query), patch));

describe("parseListState", () => {
  it("defaults an empty URL", () => {
    expect(parse("")).toEqual({
      view: "all",
      filters: { q: "", tags: [] },
      sort: { key: "name", dir: "asc" },
      page: 1,
      size: 25,
    });
  });

  it.each(["page=0", "page=-2", "page=1.5", "page=abc"])("falls back to page 1 for %s", (query) => {
    expect(parse(query).page).toBe(1);
  });

  it("accepts only the offered page sizes", () => {
    expect(parse("size=50").size).toBe(50);
    expect(parse("size=37").size).toBe(25);
  });

  it("drops unknown view and CSV values", () => {
    const state = parse("view=deleted&tags=a,zzz,b");
    expect(state.view).toBe("all");
    expect(state.filters.tags).toEqual(["a", "b"]);
  });

  it("hands the parsed view to the sort codec", () => {
    expect(parse("view=archived").sort.dir).toBe("desc");
  });
});

describe("applyListChange", () => {
  it("returns to the first page when the view or filters change", () => {
    expect(change("page=4&view=all", { view: "active" })).toEqual({ view: "active" });
    expect(change("page=4&q=old", { filters: { q: "new", tags: [] } })).toEqual({ q: "new" });
  });

  it("keeps the page when only the sort changes", () => {
    expect(change("page=4", { sort: { key: "date", dir: "desc" } })).toEqual({
      page: "4",
      sort: "date",
      dir: "desc",
    });
  });

  it("keeps the first visible row on screen when the size changes", () => {
    // Page 3 at 25 starts at row 51; at 50 per page that row is on page 2.
    expect(change("page=3&size=25", { size: 50 })).toEqual({ page: "2", size: "50" });
  });

  it("deletes keys whose codec writes null or an empty string", () => {
    expect(change("q=salsa&tags=a", { filters: { q: "", tags: [] } })).toEqual({});
  });

  it("never touches params the list does not own", () => {
    expect(change("edit=event-1&new=1&page=2", { page: 3 })).toEqual({
      edit: "event-1",
      new: "1",
      page: "3",
    });
  });

  it("lets a codec clear a legacy alias it reads", () => {
    const withAlias: ListDefinition<View, Filters, Sort> = {
      ...definition,
      view: {
        parse: definition.view.parse,
        toParams: (view, previous) => ({
          view,
          legacy: previous.get("legacy") === "view-alias" ? null : previous.get("legacy"),
        }),
      },
    };
    const aliased = applyListChange(withAlias, new URLSearchParams("legacy=view-alias"), {
      view: "active",
    });
    expect(Object.fromEntries(aliased)).toEqual({ view: "active" });
    const unrelated = applyListChange(withAlias, new URLSearchParams("legacy=keep-me"), {
      view: "active",
    });
    expect(Object.fromEntries(unrelated)).toEqual({ view: "active", legacy: "keep-me" });
  });
});

describe("pageWindow", () => {
  it("clamps an out-of-range page to the last page", () => {
    expect(pageWindow(30, 9, 25)).toEqual({
      page: 2,
      pageCount: 2,
      size: 25,
      total: 30,
      offset: 25,
      from: 26,
      to: 30,
    });
  });

  it("reports an empty list as one empty page", () => {
    expect(pageWindow(0, 3, 25)).toMatchObject({ page: 1, pageCount: 1, offset: 0, from: 0, to: 0 });
  });

  it("ends the range at the page size on a full page", () => {
    expect(pageWindow(80, 2, 25)).toMatchObject({ from: 26, to: 50 });
  });
});
