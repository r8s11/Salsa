import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTaxonomyTable from "./AdminTaxonomyTable";

const term = { id: "salsa", category: "dance_style" as const, name: "Salsa", slug: "salsa", description: null, parent_id: null, status: "active" as const, display_order: 1, usage_count: 42, updated_at: "2026-08-14T00:00:00Z" };

describe("AdminTaxonomyTable", () => {
  it("renders usage accessibly and blocks deletion for referenced terms", () => {
    render(<MemoryRouter><AdminTaxonomyTable terms={[term]} onArchive={vi.fn()} onRestore={vi.fn()} onDelete={vi.fn()} /></MemoryRouter>);
    expect(screen.getAllByLabelText("Used by 42 events")).toHaveLength(2);
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Delete Salsa" })).toBeDisabled();
  });
});
