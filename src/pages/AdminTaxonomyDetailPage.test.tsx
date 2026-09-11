import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminTaxonomyDetailPage from "./AdminTaxonomyDetailPage";

const term = {
  id: "salsa-id",
  category: "dance_style" as const,
  name: "Salsa",
  slug: "salsa",
  description: null,
  parent_id: null,
  status: "active" as const,
  display_order: 10,
  usage_count: 42,
  updated_at: "2026-08-14T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
};

const unusedTerm = { ...term, id: "bachata-id", name: "Bachata", usage_count: 0 };

let mockTerm = term;
const archiveMutate = vi.fn();
const removeMutate = vi.fn();
let archiveState: { isPending: boolean; error: Error | null } = { isPending: false, error: null };
let removeState: { isPending: boolean; error: Error | null } = { isPending: false, error: null };

vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useAdminTaxonomyTerm: () => ({ term: mockTerm, isLoading: false, error: null }),
  useAdminTaxonomy: () => ({
    terms: [],
    update: { isPending: false, mutate: vi.fn() },
    archive: { mutate: archiveMutate, ...archiveState },
    restore: { mutate: vi.fn() },
    remove: { mutate: removeMutate, ...removeState },
    merge: { mutate: vi.fn() },
  }),
}));

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/tags/${id}`]}>
      <Routes>
        <Route path="/admin/tags/:id" element={<AdminTaxonomyDetailPage />} />
        <Route path="/admin/tags" element={<p>Tags list</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminTaxonomyDetailPage", () => {
  afterEach(() => {
    mockTerm = term;
    archiveState = { isPending: false, error: null };
    removeState = { isPending: false, error: null };
    archiveMutate.mockReset();
    removeMutate.mockReset();
  });
  it("shows usage before guarded destructive controls", () => {
    render(
      <MemoryRouter initialEntries={["/admin/tags/salsa-id"]}>
        <Routes>
          <Route path="/admin/tags/:id" element={<AdminTaxonomyDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Used by 42 events")).toBeVisible();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
  it("opens an archive confirmation dialog without mutating, then mutates on confirm", () => {
    renderPage(term.id);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Archive “Salsa”?")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Archive Term" }));
    expect(archiveMutate).toHaveBeenCalledTimes(1);
    expect(archiveMutate).toHaveBeenCalledWith("salsa-id", expect.any(Object));
  });

  it("closes the archive dialog on cancel without mutating", () => {
    renderPage(term.id);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(archiveMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the delete button disabled for a used term and navigates back after a successful delete", () => {
    mockTerm = unusedTerm;
    removeMutate.mockImplementation((_id, options) => options?.onSuccess?.());
    renderPage(unusedTerm.id);
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete “Bachata”?")).toBeVisible();
    expect(removeMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Term" }));
    expect(removeMutate).toHaveBeenCalledWith("bachata-id", expect.any(Object));
    expect(screen.getByText("Tags list")).toBeVisible();
    mockTerm = term;
    removeMutate.mockReset();
  });

  it("keeps the archive dialog open and busy while pending, and shows the mutation error", () => {
    archiveState = { isPending: true, error: new Error("Archive failed") };
    renderPage(term.id);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("button", { name: "Archiving…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Archive failed");
    archiveState = { isPending: false, error: null };
  });
});
