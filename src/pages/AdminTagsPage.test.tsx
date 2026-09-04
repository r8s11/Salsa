import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminTagsPage from "./AdminTagsPage";
import type { TaxonomyTerm } from "../features/admin/model/taxonomy";

const archiveMutate = vi.fn();
const restoreMutate = vi.fn();
const removeMutate = vi.fn();
let mockTerms: TaxonomyTerm[] = [];
let archiveState: { isPending: boolean; error: Error | null } = { isPending: false, error: null };
let removeState: { isPending: boolean; error: Error | null } = { isPending: false, error: null };

vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useAdminTaxonomy: () => ({
    terms: mockTerms,
    isLoading: false,
    error: null,
    archive: { mutate: archiveMutate, ...archiveState },
    restore: { mutate: restoreMutate },
    remove: { mutate: removeMutate, ...removeState },
  }),
}));

const usedTerm: TaxonomyTerm = {
  id: "salsa-id",
  category: "dance_style",
  name: "Salsa",
  slug: "salsa",
  description: null,
  parent_id: null,
  status: "active",
  display_order: 10,
  usage_count: 3,
  updated_at: "2026-08-14T00:00:00Z",
};

const unusedTerm: TaxonomyTerm = { ...usedTerm, id: "bachata-id", name: "Bachata", usage_count: 0 };

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
    mockTerms = [];
    archiveState = { isPending: false, error: null };
    removeState = { isPending: false, error: null };
    archiveMutate.mockReset();
    restoreMutate.mockReset();
    removeMutate.mockReset();
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

  it("renders one taxonomy view control instead of duplicating it inside the filter card", () => {
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tablist", { name: "Taxonomy views" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Taxonomy views" })).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/admin/tags"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("q=Outdoor"));
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

  it("opens an archive confirmation dialog without mutating, then mutates on confirm", () => {
    mockTerms = [usedTerm];
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Archive Salsa" })[0]);
    expect(archiveMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Archive “Salsa”?")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Archive Term" }));
    expect(archiveMutate).toHaveBeenCalledTimes(1);
    expect(archiveMutate).toHaveBeenCalledWith("salsa-id", expect.any(Object));
  });

  it("closes the archive dialog on cancel without mutating", () => {
    mockTerms = [usedTerm];
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Archive Salsa" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(archiveMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never offers delete for a used term, and mutates delete for an unused term via the dialog", () => {
    mockTerms = [usedTerm, unusedTerm];
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

    for (const button of screen.getAllByRole("button", { name: "Delete Salsa" })) {
      expect(button).toBeDisabled();
    }

    fireEvent.click(screen.getAllByRole("button", { name: "Delete Bachata" })[0]);
    expect(screen.getByText("Delete “Bachata”?")).toBeVisible();
    expect(removeMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Term" }));
    expect(removeMutate).toHaveBeenCalledTimes(1);
    expect(removeMutate).toHaveBeenCalledWith("bachata-id", expect.any(Object));
  });

  it("keeps the delete dialog open and busy while pending, and shows the mutation error", () => {
    mockTerms = [unusedTerm];
    removeState = { isPending: true, error: new Error("Delete failed") };
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Delete Bachata" })[0]);
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Delete failed");
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
