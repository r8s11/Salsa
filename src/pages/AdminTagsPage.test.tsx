import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function NavigationProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/admin/tags?q=Bachata")}>
      Load Bachata
    </button>
  );
}

describe("AdminTagsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("updates search URL when typing in the search box", async () => {
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

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/tags")
    );
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("q=Outdoor")
    );
  });

  it("does not let a stale search overwrite external navigation", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/admin/tags"]}>
        <AdminTagsPage />
        <LocationProbe />
        <NavigationProbe />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search taxonomy" }), {
      target: { value: "Outdoor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load Bachata" }));

    // External navigation should win immediately
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/tags?q=Bachata");
  });
});
