import type { ComponentProps } from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../../model/adminEventForm";
import { draftToAdminPayload } from "../../../events/components/EventForm";
import { fetchAdminEntityDirectory, fetchAdminEntityDetail, saveAdminEntity } from "../../entities/api/entitiesRepo";
import { fetchVenueDetail } from "../../api/venuesRepo";
import type { VenueDetailRow } from "../../model/venuesQuery";

vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));
vi.mock("../../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms: () => ({ terms: [] }) }));
vi.mock("../../entities/api/entitiesRepo", () => ({
  fetchAdminEntityDirectory: vi.fn().mockResolvedValue([]),
  fetchAdminEntityDetail: vi.fn().mockResolvedValue(null),
  saveAdminEntity: vi.fn(),
}));
vi.mock("../../api/venuesRepo", () => ({
  fetchVenueDetail: vi.fn(),
  searchVenues: vi.fn().mockResolvedValue([]),
  createVenue: vi.fn(),
}));
vi.mock("../../../entity-matching/entityReviewClient", () => ({
  searchEntityMatches: vi.fn().mockResolvedValue([]),
  reconcileEntities: vi.fn(),
}));

function editor(props: Partial<ComponentProps<typeof AdminEventEditor>> = {}) {
  return render(
    <MemoryRouter>
      <AdminEventEditor
        initial={buildEmptyAdminForm("boston")}
        initialTaxonomyTerms={[]}
        heading="New event"
        isSaving={false}
        error={null}
        flyerOwnerId="admin-test"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("Event Composer", () => {
  beforeEach(() => localStorage.clear());

  it.each(["event", "series"] as const)("saves the flyer with %s scope without changing earlier events", async (scope) => {
    const user = userEvent.setup();
    vi.mocked(saveAdminEntity).mockClear();
    const onSubmit = vi.fn().mockResolvedValue({ id: "saved-event", status: "draft" });
    editor({
      initial: {
        ...buildEmptyAdminForm("boston"),
        title: "Weekly social",
        event_type: "social",
        event_date: "2026-11-12",
        series_id: "series-1",
        image_url: "https://example.com/flyer.jpg",
        image_urls: ["https://example.com/flyer.jpg", "https://example.com/flyer-2.jpg"],
      },
      onSubmit,
    });
    expect(screen.getByRole("radio", { name: "This event only" })).toBeChecked();
    if (scope === "series") await user.click(screen.getByRole("radio", { name: "Series default" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      image_url: "https://example.com/flyer.jpg",
      image_urls: ["https://example.com/flyer.jpg", "https://example.com/flyer-2.jpg"],
    });
    if (scope === "series") {
      await waitFor(() =>
        expect(saveAdminEntity).toHaveBeenCalledWith("series", "series-1", {
          image_url: "https://example.com/flyer.jpg",
        })
      );
    } else {
      expect(saveAdminEntity).not.toHaveBeenCalled();
    }
  });

  it("keeps the saved event ID when updating the series flyer fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveAdminEntity).mockRejectedValueOnce(new Error("Network unavailable"));
    const onSubmit = vi.fn().mockResolvedValue({ id: "saved-event", status: "draft" });
    editor({
      initial: {
        ...buildEmptyAdminForm("boston"),
        title: "Weekly social",
        event_type: "social",
        event_date: "2026-11-12",
        series_id: "series-1",
        image_url: "https://example.com/flyer.jpg",
      },
      onSubmit,
    });
    await user.click(screen.getByRole("radio", { name: "Series default" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText(/event was saved, but the series flyer was not updated/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(onSubmit.mock.calls[onSubmit.mock.calls.length - 1]?.[3]).toBe("saved-event"));
  });

  it("offers all entry methods without resetting work when changing method", async () => {
    const user = userEvent.setup();
    editor();
    await user.type(screen.getByLabelText("Event Title *"), "Keep my title");
    await user.click(screen.getByRole("button", { name: "Create from Series" }));
    expect(screen.getByRole("combobox", { name: "Event series" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Blank" }));
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Keep my title");
    expect(screen.getByRole("button", { name: "Upload Flyer" })).toBeInTheDocument();
  });

  it("restores incomplete work after leaving and remounting", async () => {
    const user = userEvent.setup();
    const view = editor();
    await user.type(screen.getByLabelText("Event Title *"), "Unfinished night");
    await user.type(screen.getByLabelText("Description"), "Do not lose this description");
    view.unmount();
    editor();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Unfinished night");
    expect(screen.getByLabelText("Description")).toHaveValue("Do not lose this description");
    expect(screen.getByText(/Restored.*device/i)).toBeInTheDocument();
  });

  it("shows field errors without publishing incomplete events", async () => {
    const onSubmit = vi.fn();
    editor({ onSubmit });
    await userEvent.click(screen.getByRole("button", { name: "Publish event" }));
    expect(screen.getByLabelText("Event Title *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Date *")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("publishes explicitly and stays in the editor for subsequent updates", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      id: "saved-event",
      status: "approved",
      publicUrl: "/events/saved-event",
    });
    const onCancel = vi.fn();
    editor({ onSubmit });
    await user.type(screen.getByLabelText("Event Title *"), "Salsa after work");
    await user.click(screen.getByRole("button", { name: "Social" }));
    fireEvent.change(screen.getByLabelText("Date *"), { target: { value: "2026-11-12" } });
    await user.click(screen.getByRole("button", { name: "Publish event" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "View public event" })).toHaveAttribute(
        "href",
        "/events/saved-event"
      )
    );
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Salsa after work");
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit.mock.calls[onSubmit.mock.calls.length - 1]?.[3]).toBe("saved-event");
  });

  it("previews current unsaved details without leaving the form", async () => {
    const user = userEvent.setup();
    editor();
    await user.type(screen.getByLabelText("Event Title *"), "Preview this night");
    await user.click(screen.getByRole("button", { name: "Preview event" }));
    expect(screen.getByRole("dialog", { name: "Event preview" })).toHaveTextContent(
      "Preview this night"
    );
    await user.click(screen.getByRole("button", { name: "Back to editing" }));
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Preview this night");
  });
});

it("retains the created event ID even when the editor unmounts before saving completes", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const pending = Promise.withResolvers<{ id: string; status: "draft" }>();
  const onSubmit = vi.fn().mockReturnValue(pending.promise);
  const view = editor({
    initial: {
      ...buildEmptyAdminForm("boston"),
      title: "In-flight draft",
      event_type: "social",
      event_date: "2026-11-12",
    },
    onSubmit,
  });
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(onSubmit).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => pending.resolve({ id: "saved-after-navigation", status: "draft" }));
  const resumedSubmit = vi.fn().mockResolvedValue(undefined);
  editor({ onSubmit: resumedSubmit });
  expect(screen.getByLabelText("Event Title *")).toHaveValue("In-flight draft");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(resumedSubmit.mock.calls[0][3]).toBe("saved-after-navigation");
});

it("keeps an existing venue and a deliberately cleared address when series defaults arrive late", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const series = {
    id: "series-b",
    kind: "series" as const,
    name: "Second series",
    slug: "second-series",
    status: "active" as const,
    description: null,
    image_url: null,
    city: "boston",
    website: null,
    instagram: null,
    venue_id: "venue-b",
    quality_issues: [],
    linked_events: [],
  };
  vi.mocked(fetchAdminEntityDirectory).mockResolvedValue([series]);
  vi.mocked(fetchAdminEntityDetail).mockResolvedValue(series);
  const pendingVenue = Promise.withResolvers<VenueDetailRow>();
  vi.mocked(fetchVenueDetail).mockReturnValue(pendingVenue.promise);
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  editor({
    initial: {
      ...buildEmptyAdminForm("boston"),
      title: "Existing night",
      event_type: "social",
      event_date: "2026-11-12",
      venue_id: "venue-a",
      location: "Existing venue",
      address: "Old address",
    },
    onSubmit,
  });
  await user.type(screen.getByRole("combobox", { name: "Event series" }), "Second");
  await user.click(await screen.findByRole("option", { name: /Second series/ }));
  await waitFor(() => expect(fetchVenueDetail).toHaveBeenCalledWith("venue-b"));
  await user.clear(screen.getByLabelText("Address", { exact: true }));
  await act(async () =>
    pendingVenue.resolve({
      id: "venue-b",
      name: "Series venue",
      address_line1: "New address",
      city: "boston",
    } as VenueDetailRow)
  );
  expect(screen.getByLabelText("Venue name")).toHaveValue("Existing venue");
  expect(screen.getByLabelText("Address", { exact: true })).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(onSubmit.mock.calls[0][0].venue_id).toBe("venue-a");
});

it("carries the series venue's time zone onto the draft so an LA venue saves as LA local time", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const series = {
    id: "series-la",
    kind: "series" as const,
    name: "Westside series",
    slug: "westside-series",
    status: "active" as const,
    description: null,
    image_url: null,
    city: "boston",
    website: null,
    instagram: null,
    venue_id: "venue-la",
    quality_issues: [],
    linked_events: [],
  };
  vi.mocked(fetchAdminEntityDirectory).mockResolvedValue([series]);
  vi.mocked(fetchAdminEntityDetail).mockResolvedValue(series);
  vi.mocked(fetchVenueDetail).mockResolvedValue({
    id: "venue-la",
    name: "Sunset Ritmo Hall",
    address_line1: "1 Sunset Blvd",
    city: "los-angeles",
    timezone: "America/Los_Angeles",
  } as VenueDetailRow);
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  editor({
    initial: {
      ...buildEmptyAdminForm("boston"),
      title: "West coast night",
      event_type: "social",
      event_date: "2026-07-18",
      event_time: "20:00",
    },
    onSubmit,
  });
  await user.type(screen.getByRole("combobox", { name: "Event series" }), "Westside");
  await user.click(await screen.findByRole("option", { name: /Westside series/ }));
  await waitFor(() => expect(screen.getByLabelText("Venue name")).toHaveValue("Sunset Ritmo Hall"));
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  const saved = onSubmit.mock.calls[0][0];
  expect(saved.venue_time_zone).toBe("America/Los_Angeles");
  // 8pm Pacific, not 8pm Eastern (which would be 00:00Z).
  expect(draftToAdminPayload(saved).event_date).toBe("2026-07-19T03:00:00Z");
});

it("does not restore a discarded draft after the editor unmounts", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const view = editor();
  await user.type(screen.getByLabelText("Event Title *"), "Discard this draft");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard changes" }));
  view.unmount();
  editor();
  expect(screen.getByLabelText("Event Title *")).toHaveValue("");
});
