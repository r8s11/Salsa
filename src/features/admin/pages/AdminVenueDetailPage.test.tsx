import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminVenueDetailPage from "./AdminVenueDetailPage";
import type { VenueDetailRow } from "../model/venuesQuery";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  updateError: null as string | null,
}));

const venue: VenueDetailRow = {
  id: "venue-1", name: "The Loft", slug: "the-loft", address_line1: "1 Main St", address_line2: null,
  city: "Boston", state_region: "MA", postal_code: "02139", country: "US", latitude: null, longitude: null,
  timezone: null, website: null, instagram: null, phone: null, status: "active", upcoming_count: 0,
  quality_issues: [], updated_at: "2026-10-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
};

vi.mock("../hooks/useAdminVenues", () => ({
  useAdminVenue: () => ({ venue, isLoading: false, error: null, refetch: vi.fn() }),
  useAdminVenues: () => ({
    venues: [venue], archive: vi.fn(), isArchiving: false, archiveError: null, restore: vi.fn(), isRestoring: false,
    restoreError: null, remove: vi.fn(), isRemoving: false, removeError: null, isMerging: false, mergeError: null,
    update: mocks.update, isUpdating: false, updateError: mocks.updateError,
  }),
  useVenueEventCount: () => ({ data: 0 }),
  useVenueAuditLog: () => ({ data: [] }),
}));
vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents: () => ({ events: [] }) }));
vi.mock("../api/venuesRepo", () => ({ searchVenues: vi.fn().mockResolvedValue([]) }));
vi.mock("../components/entities/AdminEntityTeamSection", () => ({ default: () => null }));

function openEdit() {
  render(
    <MemoryRouter initialEntries={["/admin/venues/venue-1"]}>
      <Routes><Route path="/admin/venues/:id" element={<AdminVenueDetailPage />} /></Routes>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions for The Loft" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit Venue" }));
}

beforeEach(() => {
  mocks.update.mockReset();
  mocks.updateError = null;
});

describe("AdminVenueDetailPage edit", () => {
  it("saves the edited venue and closes the form", () => {
    mocks.update.mockImplementation((_vars, options) => options.onSuccess());
    openEdit();
    fireEvent.change(screen.getByLabelText("Venue Name *"), { target: { value: "The Loft Ballroom" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.update).toHaveBeenCalledWith(
      { id: "venue-1", form: expect.objectContaining({ name: "The Loft Ballroom", city: "Boston" }) },
      expect.anything()
    );
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("keeps the form open and shows the server error when saving fails", () => {
    mocks.updateError = "Duplicate venue";
    openEdit();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate venue");
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});
