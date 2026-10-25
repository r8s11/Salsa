import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminVenueCreatePage from "./AdminVenueCreatePage";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  createError: null as string | null,
}));

vi.mock("../hooks/useAdminVenues", () => ({
  useAdminVenues: () => ({ create: mocks.create, isCreating: false, createError: mocks.createError }),
}));

vi.mock("../api/venuesRepo", () => ({ searchVenues: vi.fn().mockResolvedValue([]) }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/venues/new"]}>
      <Routes>
        <Route path="/admin/venues/new" element={<AdminVenueCreatePage />} />
        <Route path="/admin/venues/:id" element={<p>Venue detail</p>} />
        <Route path="/admin/venues" element={<p>Venue directory</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  mocks.create.mockReset();
  mocks.createError = null;
});

describe("AdminVenueCreatePage", () => {
  it("creates the venue and opens its record", () => {
    mocks.create.mockImplementation((_form, options) => options.onSuccess({ id: "venue-9" }));
    renderPage();
    fill("Venue Name *", "The Loft");
    fill("Address Line 1 *", "1 Main St");
    fill("City *", "Boston");
    fill("State / Region *", "MA");
    fireEvent.click(screen.getByRole("button", { name: "Create Venue" }));
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "The Loft", address_line1: "1 Main St", city: "Boston", state_region: "MA" }),
      expect.anything()
    );
    expect(screen.getByText("Venue detail")).toBeInTheDocument();
  });

  it("keeps the form open and shows the server error when creation fails", () => {
    mocks.createError = "Duplicate venue";
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate venue");
    expect(screen.getByRole("heading", { level: 1, name: "New venue" })).toBeInTheDocument();
  });

  it("returns to the venue directory on cancel", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Venue directory")).toBeInTheDocument();
  });
});
