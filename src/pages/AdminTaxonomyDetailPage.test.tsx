import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminTaxonomyDetailPage from "./AdminTaxonomyDetailPage";

const term = { id: "salsa-id", category: "dance_style" as const, name: "Salsa", slug: "salsa", description: null, parent_id: null, status: "active" as const, display_order: 10, usage_count: 42, updated_at: "2026-08-14T00:00:00Z", created_at: "2026-08-01T00:00:00Z" };
vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useAdminTaxonomyTerm: () => ({ term, isLoading: false, error: null }),
  useAdminTaxonomy: () => ({ terms: [], update: { isPending: false, mutate: vi.fn() }, archive: { mutate: vi.fn() }, restore: { mutate: vi.fn() }, remove: { mutate: vi.fn() }, merge: { mutate: vi.fn() } }),
}));

describe("AdminTaxonomyDetailPage", () => {
  it("shows usage before guarded destructive controls", () => {
    render(<MemoryRouter initialEntries={["/admin/tags/salsa-id"]}><Routes><Route path="/admin/tags/:id" element={<AdminTaxonomyDetailPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText("Used by 42 events")).toBeVisible();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
