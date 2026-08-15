import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminTagsPage from "./AdminTagsPage";

vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useAdminTaxonomy: () => ({
    terms: [],
    isLoading: false,
    error: null,
    archive: { mutate: vi.fn() },
    restore: { mutate: vi.fn() },
    remove: { mutate: vi.fn() },
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

describe("AdminTagsPage", () => {
  it("shows the taxonomy directory and add-term route", () => {
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Tags & Taxonomy" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add term" })).toHaveAttribute(
      "href",
      "/admin/tags/new"
    );
  });

  it("debounces search URL updates without dropping typed characters", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/tags"]}>
        <AdminTagsPage />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search taxonomy" }), {
      target: { value: "Outdoor" },
    });

    await act(async () => {});

    expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin\/tags$/);
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/tags?q=Outdoor")
    );
  });
});
