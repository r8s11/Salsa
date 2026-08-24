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

    expect(screen.getAllByRole("img", { name: "Event flyer preview" })).toHaveLength(1);
  });
});
