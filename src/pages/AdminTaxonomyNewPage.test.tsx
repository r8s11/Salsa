import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminTaxonomyNewPage from "./AdminTaxonomyNewPage";

vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useAdminTaxonomy: () => ({ create: { isPending: false, mutate: vi.fn() } }),
}));

describe("AdminTaxonomyNewPage", () => {
  it("honors the category query parameter", () => {
    render(
      <MemoryRouter initialEntries={["/admin/tags/new?category=event_attribute"]}>
        <AdminTaxonomyNewPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Add taxonomy term" })).toBeVisible();
    expect(screen.getByLabelText("Category *")).toHaveValue("event_attribute");
  });
});
