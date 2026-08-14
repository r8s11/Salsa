import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AdminEventForm as AdminEventFormValues } from "../../features/admin/model/adminEventForm";
import AdminEventForm from "./AdminEventForm";

const { useActiveTaxonomyTerms } = vi.hoisted(() => ({ useActiveTaxonomyTerms: vi.fn() }));
vi.mock("../../features/admin/hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms }));
vi.mock("../../features/admin/hooks/useVenueCombobox", () => ({
  useVenueCombobox: () => ({ query: "", setQuery: vi.fn(), results: [], isOpen: false, setIsOpen: vi.fn(), selectedId: "", selectedName: "", selectedAddress: "", selectVenue: vi.fn(), clearVenue: vi.fn() }),
}));

const salsa = { id: "salsa-id", category: "dance_style" as const, name: "Salsa", slug: "salsa", status: "active" as const, display_order: 10, description: null, parent_id: null, usage_count: 42, updated_at: "2026-08-14T00:00:00Z" };
const archivedMambo = { ...salsa, id: "mambo-id", name: "Mambo", slug: "mambo", status: "archived" as const };
const outdoor = { ...salsa, id: "outdoor-id", category: "event_attribute", name: "Outdoor", slug: "outdoor" };
const initial: AdminEventFormValues = {
  title: "Salsa Night", description: "", event_type: "social", city: "boston", event_date: "2026-09-01", event_time: "20:00", location: "", address: "", price_type: "free", price_amount: "", rsvp_link: "", submitter_name: "", submitter_email: "", recurrence: "", host: "", image_url: "", contact_email: "", contact_instagram: "", contact_website: "", taxonomy_term_ids: ["salsa-id"], venue_id: "",
};

function renderForm(onSubmit = vi.fn()) {
  render(<MemoryRouter><AdminEventForm initial={initial} heading="Edit event" submitLabel="Save event" isSaving={false} error={null} onSubmit={onSubmit} onCancel={vi.fn()} /></MemoryRouter>);
  return onSubmit;
}

describe("AdminEventForm taxonomy selectors", () => {
  it("renders active terms supplied by each taxonomy query", () => {
    useActiveTaxonomyTerms.mockImplementation((category: string) => ({ terms: category === "dance_style" ? [salsa] : [outdoor], isLoading: false, error: null }));
    renderForm();
    expect(screen.getByRole("checkbox", { name: "Salsa" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Outdoor" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Archived Mambo" })).not.toBeInTheDocument();
  });

  it("submits selected dance styles and attributes as taxonomy IDs", async () => {
    useActiveTaxonomyTerms.mockImplementation((category: string) => ({ terms: category === "dance_style" ? [salsa] : [outdoor], isLoading: false, error: null }));
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole("checkbox", { name: "Outdoor" }));
    await userEvent.click(screen.getByRole("button", { name: "Save event" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ taxonomy_term_ids: ["salsa-id", "outdoor-id"] }));
  });

  it("shows an archived existing attachment without offering it as a checkbox", () => {
    useActiveTaxonomyTerms.mockImplementation((category: string) => ({ terms: category === "dance_style" ? [salsa] : [], isLoading: false, error: null }));
    render(<MemoryRouter><AdminEventForm initial={{ ...initial, taxonomy_term_ids: ["salsa-id", "mambo-id"] }} initialTaxonomyTerms={[archivedMambo]} heading="Edit event" submitLabel="Save event" isSaving={false} error={null} onSubmit={vi.fn()} onCancel={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Mambo (Archived)")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: /Mambo/ })).not.toBeInTheDocument();
  });
});
