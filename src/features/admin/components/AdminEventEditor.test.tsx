import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../model/adminEventForm";

const { useActiveTaxonomyTerms, useVenueCombobox } = vi.hoisted(() => ({
  useActiveTaxonomyTerms: vi.fn(),
  useVenueCombobox: vi.fn(),
}));

vi.mock("../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms }));
vi.mock("../hooks/useVenueCombobox", () => ({ useVenueCombobox }));

describe("AdminEventEditor", () => {
  beforeEach(() => {
    useActiveTaxonomyTerms.mockReturnValue({ terms: [] });
    useVenueCombobox.mockReturnValue({
      selectedId: null,
      selectedName: "",
      selectedAddress: "",
      results: [],
      query: "",
      isOpen: false,
      clearVenue: vi.fn(),
      selectVenue: vi.fn(),
      setQuery: vi.fn(),
      setIsOpen: vi.fn(),
    });
  });

  it("keeps one visible flyer preview while editing an event", () => {
    const initial = {
      ...buildEmptyAdminForm("boston"),
      title: "Salsa Tuesday",
      image_url: "https://example.com/flyer.png",
    };

    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={initial}
          initialTaxonomyTerms={[]}
          heading="Edit event"
          submitLabel="Save changes"
          isSaving={false}
          error={null}
          eventId="event-1"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("img", { name: "Current event flyer" })).toHaveLength(1);
  });
});

describe("AdminEventEditor submitter identity", () => {
  beforeEach(() => {
    useActiveTaxonomyTerms.mockReturnValue({ terms: [] });
    useVenueCombobox.mockReturnValue({
      selectedId: null,
      selectedName: "",
      selectedAddress: "",
      results: [],
      query: "",
      isOpen: false,
      clearVenue: vi.fn(),
      selectVenue: vi.fn(),
      setQuery: vi.fn(),
      setIsOpen: vi.fn(),
    });
  });

  it("never asks an admin for a submitter name or email", () => {
    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={buildEmptyAdminForm("boston")}
          initialTaxonomyTerms={[]}
          heading="New event"
          submitLabel="Create event"
          isSaving={false}
          error={null}
          flyerOwnerId="11111111-1111-4111-8111-111111111111"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText(/Your name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your info/i })).not.toBeInTheDocument();
  });
});
