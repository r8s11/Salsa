import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTaxonomyDirectory, mergeTaxonomyTerms, replaceEventTaxonomyTerms } from "./taxonomyRepo";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

describe("taxonomyRepo", () => {
  beforeEach(() => rpc.mockReset());

  it("returns taxonomy rows from the directory RPC", async () => {
    rpc.mockResolvedValue({ data: [{ id: "salsa", name: "Salsa" }], error: null });
    await expect(fetchTaxonomyDirectory({ search: "", category: null, status: null, view: "all" })).resolves.toEqual([
      { id: "salsa", name: "Salsa" },
    ]);
  });

  it("surfaces directory database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    await expect(fetchTaxonomyDirectory({ search: "", category: null, status: null, view: "all" })).rejects.toThrow(
      "Failed to load taxonomy terms: forbidden",
    );
  });

  it("merges through the atomic database RPC", async () => {
    rpc.mockResolvedValue({ error: null });
    await mergeTaxonomyTerms("keep-id", "source-id");
    expect(rpc).toHaveBeenCalledWith("merge_taxonomy_terms", { p_keep_id: "keep-id", p_merge_id: "source-id" });
  });

  it("replaces the complete event taxonomy relationship set", async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceEventTaxonomyTerms("event-id", ["salsa-id"]);
    expect(rpc).toHaveBeenCalledWith("replace_event_taxonomy_terms", {
      p_event_id: "event-id",
      p_taxonomy_term_ids: ["salsa-id"],
    });
  });
});
