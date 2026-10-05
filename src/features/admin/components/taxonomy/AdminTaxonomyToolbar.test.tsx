import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTaxonomyToolbar from "./AdminTaxonomyToolbar";

const filters = { search: "", category: null, status: null, view: "all" as const };

describe("AdminTaxonomyToolbar", () => {
  it("emits a selected category filter", async () => {
    const onFiltersChange = vi.fn();
    render(<AdminTaxonomyToolbar filters={filters} onFiltersChange={onFiltersChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Category"), "dance_style");
    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, category: "dance_style" });
  });

  it("clears all active filters", async () => {
    const onFiltersChange = vi.fn();
    render(
      <AdminTaxonomyToolbar
        filters={{ ...filters, search: "salsa", status: "active" }}
        onFiltersChange={onFiltersChange}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith(filters);
  });
});
