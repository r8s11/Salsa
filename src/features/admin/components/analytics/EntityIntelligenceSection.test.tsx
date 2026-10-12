import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ENTITY_OPTIONS, type EntityIntelligence, type EntityPerformanceRow } from "../../model/analyticsQuery";
import EntityIntelligenceSection from "./EntityIntelligenceSection";

const row: EntityPerformanceRow = {
  id: "organizer-a", name: "Canonical organizer with a long descriptive name", city: null, status: "active",
  total_events: 3, upcoming_events: 2, past_events: 1, created_events: 1,
  latest_scheduled_at: "2026-10-30T12:00:00Z", last_occurred_at: "2026-09-01T12:00:00Z", last_published_at: null,
  engagement: null, related_total: 1, related: [{ id: "venue-a", name: "Shared Venue", event_count: 3 }],
  metro_total: 2, metros: [{ slug: "first", name: "Same City", upcoming_events: 1 }, { slug: "second", name: "Same City", upcoming_events: 1 }],
  style_total: null, styles: null,
};
const data: EntityIntelligence = {
  asOf: null, firstRecordedAt: null, engagementAvailable: false,
  organizers: { total: 26, active: 1, created: 2, offset: 0, page_size: 25, rows: [row] },
  venues: { total: 0, active: 0, created: 0, offset: 0, page_size: 25, rows: [] },
  coverage: { active_metros: 1, inventory_history_available: false, rows: [
    { slug: "first", city: "First Metro", upcoming_events: 2, active_organizers: 1, active_venues: 2 },
    { slug: "empty", city: "Empty Metro", upcoming_events: 0, active_organizers: 0, active_venues: 0 },
  ] },
  quality: [{ key: "missing_venue", severity: "optional", count: 1,
    events: [{ id: "event-a", title: "Unassociated event", event_date: null }] }],
};
function setup(overrides: Partial<Parameters<typeof EntityIntelligenceSection>[0]> = {}) {
  const onOptionsChange = vi.fn(), retry = vi.fn();
  const props = { data, loading: false, error: null, options: DEFAULT_ENTITY_OPTIONS, onOptionsChange, retry, ...overrides };
  const rendered = render(<MemoryRouter><EntityIntelligenceSection {...props} /></MemoryRouter>);
  return { ...rendered, onOptionsChange, retry, props };
}
describe("entity intelligence", () => {
  it("shows canonical inventory and collaboration without presenting unavailable engagement as zero", () => {
    setup();
    const section = screen.getByRole("region", { name: "Organizer intelligence" });
    expect(within(section).getByRole("link", { name: row.name })).toHaveAttribute("href", "/admin/organizers/organizer-a");
    expect(within(section).queryByRole("columnheader", { name: "Detail views" })).not.toBeInTheDocument();
    expect(within(section).getByText(/Recorded engagement is unavailable/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Shared Venue" })).toHaveAttribute("href", "/admin/venues/venue-a");
    expect(within(section).getByText("Same City (first)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unassociated event" })).toHaveAttribute("href", "/admin/events?edit=event-a");
    expect(screen.getByText(/Optional information/)).toBeInTheDocument();
  });
  it("keeps sorting focused and requests a fresh first page rather than reusing the previous offset", () => {
    const view = setup({ options: { ...DEFAULT_ENTITY_OPTIONS, organizerOffset: 25 } });
    const select = screen.getByLabelText("Sort organizers");
    select.focus();
    fireEvent.change(select, { target: { value: "total_events" } });
    expect(view.onOptionsChange).toHaveBeenCalledWith({ ...DEFAULT_ENTITY_OPTIONS, organizerSort: "total_events", organizerOffset: 0 });
    view.rerender(<MemoryRouter><EntityIntelligenceSection {...view.props} loading data={null} /></MemoryRouter>);
    expect(screen.getByLabelText("Sort organizers")).toHaveFocus();
    expect(screen.queryByRole("link", { name: row.name })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Loading .* intelligence/).length).toBe(2);
  });
  it("paginates server-ranked results and distinguishes an empty venue directory", () => {
    const view = setup();
    fireEvent.click(screen.getByRole("button", { name: "Next organizers page" }));
    expect(view.onOptionsChange).toHaveBeenCalledWith({ ...DEFAULT_ENTITY_OPTIONS, organizerOffset: 25 });
    expect(screen.getByRole("button", { name: "Previous organizers page" })).toBeDisabled();
    expect(screen.getByText("No canonical venues are stored.")).toBeInTheDocument();
  });
  it("retains healthy sections after a partial source failure and offers retry", () => {
    const view = setup({ data: { ...data, organizers: null } });
    const section = screen.getByRole("region", { name: "Organizer intelligence" });
    expect(within(section).getByText("Organizer intelligence is unavailable.")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Retry organizer intelligence" }));
    expect(view.retry).toHaveBeenCalledOnce();
    expect(screen.getByText("First Metro (first)")).toBeInTheDocument();
    expect(screen.getByText("No canonical venues are stored.")).toBeInTheDocument();
  });
  it("does not label a draft or archived-event contributor past-only or inactive", () => {
    setup({ data: { ...data, organizers: { ...data.organizers!, rows: [{ ...row, upcoming_events: 0, past_events: 1, total_events: 3 }] } } });
    expect(screen.getByText(/^No upcoming events/)).toBeInTheDocument();
    expect(screen.queryByText(/Past events only/)).not.toBeInTheDocument();
    expect(screen.queryByText(/inactive organizer/i)).not.toBeInTheDocument();
  });
  it("shows recorded interactions only when supported, never completed registration labels", () => {
    setup({ data: { ...data, engagementAvailable: true, firstRecordedAt: "2026-10-01T12:00:00Z",
      organizers: { ...data.organizers!, rows: [{ ...row, engagement: { detail_views: 4, rsvp_clicks: 1, ticket_clicks: 2, shares: 1 } }] } } });
    const section = screen.getByRole("region", { name: "Organizer intelligence" });
    expect(within(section).getByRole("columnheader", { name: "Detail views" })).toBeInTheDocument();
    expect(within(section).getByRole("columnheader", { name: "Ticket clicks" })).toBeInTheDocument();
    expect(screen.queryByText(/tickets sold/i)).not.toBeInTheDocument();
  });
});
