import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useActiveTaxonomyTerms, useAdminTaxonomy, useAdminTaxonomyTerm } from "./useAdminTaxonomy";
import * as taxonomyRepo from "../api/taxonomyRepo";

vi.mock("../api/taxonomyRepo");

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

const filters = { search: "", category: null, status: null, view: "all" as const };

describe("useAdminTaxonomy", () => {
  it("loads the current directory filters", async () => {
    vi.mocked(taxonomyRepo.fetchTaxonomyDirectory).mockResolvedValue([]);
    const { result } = renderHook(() => useAdminTaxonomy(filters), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(taxonomyRepo.fetchTaxonomyDirectory).toHaveBeenCalledWith(filters);
  });

  it("loads active terms only for the requested category", async () => {
    vi.mocked(taxonomyRepo.searchActiveTaxonomyTerms).mockResolvedValue([]);
    const { result } = renderHook(() => useActiveTaxonomyTerms("dance_style"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(taxonomyRepo.searchActiveTaxonomyTerms).toHaveBeenCalledWith("dance_style");
  });

  it("does not fetch a term when no ID is supplied", () => {
    renderHook(() => useAdminTaxonomyTerm(undefined), { wrapper });
    expect(taxonomyRepo.fetchTaxonomyTerm).not.toHaveBeenCalled();
  });
});
