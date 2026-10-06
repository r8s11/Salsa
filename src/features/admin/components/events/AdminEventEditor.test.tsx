import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../../model/adminEventForm";

const { useActiveTaxonomyTerms, useVenueCombobox } = vi.hoisted(() => ({
  useActiveTaxonomyTerms: vi.fn(),
  useVenueCombobox: vi.fn(),
}));

vi.mock("../../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms }));
vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));
vi.mock("../../hooks/useVenueCombobox", () => ({ useVenueCombobox }));
// The editor imports the entity review client, which would otherwise load Supabase.
vi.mock("../../../entity-matching/entityReviewClient", () => ({
  reconcileEntities: vi.fn().mockResolvedValue({
    venue: null,
    organizer: null,
    instructors: [],
    school: null,
  }),
  searchEntityMatches: vi.fn().mockResolvedValue([]),
}));

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

describe("AdminEventEditor leaving and venue search", () => {
  const venues = [
    { id: "venue-1", name: "Havana Club", address: "1 Main St", city: "boston" },
    { id: "venue-2", name: "Salsa Loft", address: "2 Side St", city: "boston" },
  ];
  const selectVenue = vi.fn();

  function renderEditor(onCancel = vi.fn(), venueResults: typeof venues = []) {
    useActiveTaxonomyTerms.mockReturnValue({ terms: [] });
    useVenueCombobox.mockReturnValue({
      query: "ha",
      setQuery: vi.fn(),
      results: venueResults,
      isOpen: venueResults.length > 0,
      setIsOpen: vi.fn(),
      selectedId: "",
      selectedName: "",
      selectedAddress: "",
      selectVenue,
      clearVenue: vi.fn(),
    });
    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={buildEmptyAdminForm("boston")}
          initialTaxonomyTerms={[]}
          heading="New event"
          submitLabel="Create event"
          isSaving={false}
          error={null}
          onSubmit={vi.fn()}
          onCancel={onCancel}
        />
      </MemoryRouter>
    );
    return onCancel;
  }

  it("leaves at once when nothing was changed", async () => {
    const user = userEvent.setup();
    const onCancel = renderEditor();
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before discarding edits, and keeps them on Keep editing", async () => {
    const user = userEvent.setup();
    const onCancel = renderEditor();
    await user.type(screen.getByLabelText("Event Title *"), "Draft title");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Discard changes?" });
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Draft title");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("venue search is a combobox the keyboard can drive", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn(), venues);
    const input = screen.getByRole("combobox", { name: "Venue" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox", { name: "Matching venues" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);

    input.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "venue-option-venue-2");
    expect(within(listbox).getByRole("option", { name: /Salsa Loft/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.keyboard("{Enter}");
    expect(selectVenue).toHaveBeenCalledWith(expect.objectContaining({ id: "venue-2" }));
  });
});
