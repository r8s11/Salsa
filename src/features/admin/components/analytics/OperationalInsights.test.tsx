import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import OperationalInsights from "./OperationalInsights";
import { INITIAL_OFFSETS, parseOperations } from "../../model/operationalAnalytics";

const data = parseOperations({
  submissions: { pending: 4, average_hours: 78, oldest_hours: 192, over_24: 3, over_48: 2, over_7d: 1, under_24: 1, hours_24_48: 1, days_2_7: 1 },
  metros: { total: 1, active: 0, limited: 0, critical: 0, previously_active: 1, low_inventory: 1, rows: [{ id: "metro-id", slug: "old-metro", name: "Old Metro", upcoming_events: 0, events_7d: 0, events_30d: 0, active_organizers: 0, active_venues: 0, past_events: 1, last_event_at: "2026-09-01T12:00:00Z", health: "none", activity: "previously_active" }] },
  organizers: { total: 1, active: 0, no_upcoming: 1, no_history: 0, past_only: 1, previously_frequent: 0, rows: [{ id: "organizer-id", name: "Past Organizer", total_events: 1, upcoming_events: 0, past_events: 1, last_event_at: "2026-09-01T12:00:00Z", activity: "no_upcoming", previously_frequent: false }] },
  quality: { total: 1, affected_events: 1, critical_events: 0, counts: { missing_venue: 1, missing_organizer: 0, missing_flyer: 0, missing_location: 0, missing_metro: 0, missing_taxonomy: 0, invalid_required: 0 }, rows: [{ id: "event-id", title: "Needs Venue", event_date: "2026-11-01T12:00:00Z", key: "missing_venue", severity: "informational" }] },
});
const props = { loading: false, error: null, offsets: INITIAL_OFFSETS, onOffsetsChange: vi.fn(), retry: vi.fn() };
describe("operational decision support", () => {
  it("uses existing moderation and canonical record management destinations", () => {
    render(<MemoryRouter><OperationalInsights {...props} data={data} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Review Submissions" })).toHaveAttribute("href", "/admin/submissions");
    fireEvent.click(screen.getByText("Organizer activity monitoring"));
    fireEvent.click(screen.getByRole("link", { name: "Explore data quality" }));
    fireEvent.click(screen.getByRole("link", { name: "Explore Metro Coverage" }));
    expect(screen.getByRole("link", { name: "Past Organizer" })).toHaveAttribute("href", "/admin/organizers/organizer-id");
    expect(screen.getByRole("link", { name: "Needs Venue" })).toHaveAttribute("href", "/admin/events?edit=event-id");
    expect(screen.getByText("Previously active")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Upcoming event quality issues" })).getByText("Informational")).toBeInTheDocument();
  });
  it("shows genuine empty pending review while a failed metro source stays unavailable", () => {
    const empty = parseOperations({ submissions: { pending: 0, average_hours: null, oldest_hours: null, over_24: 0, over_48: 0, over_7d: 0, under_24: 0, hours_24_48: 0, days_2_7: 0 } });
    render(<MemoryRouter><OperationalInsights {...props} data={empty} /></MemoryRouter>);
    expect(screen.getByText("No submissions are currently awaiting review.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Metropolitan inventory health"));
    expect(within(screen.getByRole("region", { name: "Metropolitan inventory health" })).getByRole("button", { name: "Retry section" })).toBeInTheDocument();
    expect(screen.queryByText("No urgent platform issues found.")).not.toBeInTheDocument();
  });
  it("keeps recoverable failures separate from loading and never displays stale issues", () => {
    const { rerender } = render(<MemoryRouter><OperationalInsights {...props} data={null} loading /></MemoryRouter>);
    expect(screen.getAllByRole("status").some((node) => node.textContent?.includes("Loading"))).toBe(true);
    rerender(<MemoryRouter><OperationalInsights {...props} data={null} error="Unable to load operational insights. Please try again." /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Retry operational insights" }));
    expect(props.retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Needs Venue" })).not.toBeInTheDocument();
  });
});

it("retains keyboard pagination focus while pending data replaces the queue", () => {
  const onOffsetsChange = vi.fn();
  const source = { ...data, quality: data.quality && { ...data.quality, total: 26 } };
  const { rerender } = render(<MemoryRouter><OperationalInsights {...props} data={source} offsets={{ ...INITIAL_OFFSETS, quality: 25 }} onOffsetsChange={onOffsetsChange} /></MemoryRouter>);
  fireEvent.click(screen.getByText("Event data quality action queue"));
  const previous = screen.getByRole("button", { name: "Previous quality issues" });
  previous.focus();
  fireEvent.click(previous);
  rerender(<MemoryRouter><OperationalInsights {...props} data={null} loading onOffsetsChange={onOffsetsChange} /></MemoryRouter>);
  expect(previous).toHaveFocus();
  fireEvent.click(previous);
  expect(onOffsetsChange).toHaveBeenCalledOnce();
});
