import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BulkFlyerImportPage from "./BulkFlyerImportPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useMyOrganizers: vi.fn(),
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
  extractEventFromFlyer: vi.fn(),
  createOrganizerEvent: vi.fn(),
  createEventAsAdmin: vi.fn(),
  useActiveTaxonomyTerms: vi.fn(),
}));
vi.mock("../contexts/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../contexts/useCity", () => ({ useCity: () => ({ city: "boston" }) }));
vi.mock("../features/metros/hooks/useMetros", () => import("../test/mockMetros"));
vi.mock("../features/admin/hooks/useAdminTaxonomy", () => ({
  useActiveTaxonomyTerms: mocks.useActiveTaxonomyTerms,
}));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({
  useMyOrganizers: mocks.useMyOrganizers,
}));
vi.mock("../features/events/api/eventFlyers", () => ({
  validateEventFlyer: (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Unsupported image";
    if (file.size > 5 * 1024 * 1024) return "Image must be 5 MB or smaller.";
    return null;
  },
  uploadEventFlyer: mocks.uploadEventFlyer,
  removeEventFlyer: mocks.removeEventFlyer,
}));
vi.mock("../features/flyer-extraction/client", () => ({
  extractEventFromFlyer: mocks.extractEventFromFlyer,
}));
vi.mock("../features/host/api/organizerAccessRepo", () => ({
  createOrganizerEvent: mocks.createOrganizerEvent,
}));
vi.mock("../features/events/api/eventsRepo", () => ({
  createEventAsAdmin: mocks.createEventAsAdmin,
}));
vi.mock("../features/entity-matching/entityReviewClient", () => ({
  reconcileEntities: vi.fn().mockRejectedValue(new Error("Entity lookup unavailable")),
  searchEntityMatches: vi.fn().mockResolvedValue([]),
}));

const extracted = (title: string) => ({
  title,
  date: "2099-07-12",
  start_time: "20:00",
  end_time: null,
  venue_name: "Studio 5",
  address: "5 Main St",
  city: "Boston",
  dance_styles: ["salsa"],
  event_type: "social",
  price: null,
  organizer_name: null,
  instagram: null,
  website: null,
  details: [],
});

function renderPage(mode: "host" | "admin") {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <BulkFlyerImportPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({
    user: { id: "user-1", email: "owner@example.com" },
    isAdmin: true,
  });
  mocks.useMyOrganizers.mockReturnValue({
    data: [
      {
        organizerId: "org-1",
        organizerName: "Dance Club",
        organizerStatus: "active",
        memberRole: "owner",
      },
    ],
    isLoading: false,
    error: null,
  });
  mocks.useActiveTaxonomyTerms.mockImplementation((category: string) => ({
    terms:
      category === "dance_style"
        ? [
            {
              id: "salsa-id",
              name: "Salsa",
              slug: "salsa",
              category: "dance_style",
              status: "active",
            },
          ]
        : [],
    isLoading: false,
    error: null,
  }));
  mocks.uploadEventFlyer.mockImplementation(
    async ({ file, eventId }: { file: File; eventId: string }) => {
      if (!/^(submission|admin-draft)-[0-9a-f-]{36}$/.test(eventId)) {
        throw new Error("Flyer extraction rejects this storage path.");
      }
      return { url: `https://example.com/${file.name}`, path: `user-1/${eventId}/${file.name}` };
    }
  );
  mocks.removeEventFlyer.mockResolvedValue(undefined);
  mocks.extractEventFromFlyer.mockImplementation(async (url: string) =>
    extracted(url.includes("first") ? "First social" : "Second social")
  );
  mocks.createOrganizerEvent.mockResolvedValue("event-1");
  mocks.createEventAsAdmin.mockResolvedValue(undefined);
});

const frame = (fileName: string) =>
  screen.findByRole("button", { name: new RegExp(`^${fileName.replace(".", "\\.")}: `) });
const detail = (fileName: string) => screen.getByRole("region", { name: `Review ${fileName}` });
const saveBar = () => screen.getByRole("region", { name: "Save confirmed flyers" });

describe("BulkFlyerImportPage", () => {
  it("publishes only flyers explicitly confirmed after review", async () => {
    const user = userEvent.setup();
    renderPage("host");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "second.png", { type: "image/png" }),
    ]);
    await waitFor(() => expect(screen.getByLabelText("Flyer images")).toBeEnabled());
    expect(within(saveBar()).getByRole("button", { name: "Publish" })).toBeDisabled();

    await user.click(await frame("second.png"));
    await user.click(screen.getByRole("button", { name: "Skip this flyer" }));
    await user.click(await frame("first.png"));
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(within(saveBar()).getByRole("button", { name: "Publish 1 event" }));
    await waitFor(() => expect(within(saveBar()).getByRole("status")).toHaveTextContent("1 published."));
    expect(mocks.createOrganizerEvent).toHaveBeenCalledOnce();
    expect(mocks.createOrganizerEvent).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        title: "First social",
        image_url: "https://example.com/first.png",
        dance_styles: ["salsa"],
      }),
      true
    );
    expect(mocks.removeEventFlyer).toHaveBeenCalledWith("https://example.com/second.png");
  });

  it("allows correcting extracted fields before saving admin drafts", async () => {
    const user = userEvent.setup();
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );
    await user.click(await screen.findByRole("button", { name: "Confirm details against flyer" }));
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Confirmed");
    await user.clear(screen.getByLabelText("Event Title *"));
    await user.type(screen.getByLabelText("Event Title *"), "Corrected title");
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Needs review");
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(within(saveBar()).getByRole("button", { name: "Save 1 as draft" }));
    await waitFor(() =>
      expect(within(saveBar()).getByRole("status")).toHaveTextContent("1 draft saved.")
    );
    expect(mocks.createEventAsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Corrected title",
        image_url: "https://example.com/first.png",
        taxonomy_term_ids: ["salsa-id"],
      }),
      { id: "user-1", email: "owner@example.com" },
      false
    );
  });


  it("refuses to confirm a flyer that could not be saved", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted(""), date: null });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );
    await user.click(await screen.findByRole("button", { name: "Confirm details against flyer" }));
    expect(within(detail("first.png")).getByRole("alert")).toHaveTextContent(
      "Event title is required."
    );
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Needs review");
    expect(within(saveBar()).getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(mocks.createEventAsAdmin).not.toHaveBeenCalled();
  });

  it("keeps a flyer with no event type from blocking the rest of the batch", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockImplementation(async (url: string) =>
      url.includes("first")
        ? extracted("First social")
        : { ...extracted("Second social"), event_type: null }
    );
    renderPage("host");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "second.png", { type: "image/png" }),
    ]);
    await waitFor(() => expect(screen.getByLabelText("Flyer images")).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    // Confirming advances to the next flyer that still needs review.
    expect(detail("second.png")).toHaveTextContent(
      "Event type was not identified on the flyer; choose one."
    );
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    expect(within(detail("second.png")).getByRole("alert")).toHaveTextContent(
      "Choose an event type."
    );

    await user.click(within(saveBar()).getByRole("button", { name: "Publish 1 event" }));
    await waitFor(() => expect(within(saveBar()).getByRole("status")).toHaveTextContent("1 published."));
    expect(mocks.createOrganizerEvent).toHaveBeenCalledOnce();
    expect(mocks.createOrganizerEvent.mock.calls[0][1]).toEqual(
      expect.objectContaining({ title: "First social" })
    );
  });

  it("saves confirmed flyers while other flyers are still being read", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<object>();
    mocks.extractEventFromFlyer.mockImplementation((url: string) =>
      url.includes("first") ? Promise.resolve(extracted("First social")) : pending.promise
    );
    renderPage("host");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "second.png", { type: "image/png" }),
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm details against flyer" }));
    expect(await frame("second.png")).toHaveAccessibleName("second.png: Reading");
    await user.click(within(saveBar()).getByRole("button", { name: "Publish 1 event" }));
    await waitFor(() => expect(mocks.createOrganizerEvent).toHaveBeenCalledOnce());
    pending.resolve(extracted("Second social"));
    await waitFor(async () =>
      expect(await frame("second.png")).toHaveAccessibleName("second.png: Needs review")
    );
  });

  it("surfaces an extracted city that cannot be matched before review confirmation", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted("City social"), city: "Atlantis" });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "city.png", { type: "image/png" })
    );

    expect(await screen.findByRole("note")).toHaveTextContent(
      /Could not match flyer city "Atlantis" to a supported city/
    );
    expect(await frame("city.png")).toHaveAccessibleName("city.png: Needs review");
  });

  it("flags the default city when extraction finds no flyer city", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted("Boston social"), city: null });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "missing-city.png", { type: "image/png" })
    );

    expect(await screen.findByRole("note")).toHaveTextContent(
      /City was not identified on the flyer; verify the selected city/
    );
  });

  it("retains the uploaded flyer and draft after analysis fails and allows manual entry", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockRejectedValueOnce(new Error("Analysis unavailable"));
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );

    await waitFor(async () =>
      expect(await frame("first.png")).toHaveAccessibleName("first.png: Analysis failed")
    );
    const review = detail("first.png");
    expect(within(review).getByRole("alert")).toHaveTextContent("Analysis unavailable");
    expect(within(review).getByRole("button", { name: "Retry analysis" })).toBeInTheDocument();
    await user.click(within(review).getByRole("button", { name: "Continue manually" }));

    expect(screen.getByRole("img", { name: "Flyer first.png" })).toHaveAttribute(
      "src",
      "https://example.com/first.png"
    );
    expect(screen.getByLabelText("Event Title *")).toBeInTheDocument();
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Needs review");
  });

  it("retries only a failed save without repeating a successful event", async () => {
    const user = userEvent.setup();
    mocks.createOrganizerEvent
      .mockResolvedValueOnce("event-1")
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValueOnce("event-2");
    renderPage("host");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "second.png", { type: "image/png" }),
    ]);
    await waitFor(() => expect(screen.getByLabelText("Flyer images")).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(within(saveBar()).getByRole("button", { name: "Publish 2 events" }));
    await waitFor(() =>
      expect(within(saveBar()).getByRole("status")).toHaveTextContent("1 published · 1 failed.")
    );
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Published");
    expect(await frame("second.png")).toHaveAccessibleName("second.png: Save failed");
    const review = detail("second.png");
    expect(within(review).getByRole("img", { name: "Flyer second.png" })).toBeInTheDocument();
    expect(within(review).getByLabelText("Event Title *")).toHaveValue("Second social");

    await user.click(within(review).getByRole("button", { name: "Retry save" }));
    await waitFor(async () =>
      expect(await frame("second.png")).toHaveAccessibleName("second.png: Published")
    );
    expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(3);
    expect(mocks.createOrganizerEvent.mock.calls[2][1]).toEqual(
      expect.objectContaining({ title: "Second social" })
    );
    expect(await frame("first.png")).toHaveAccessibleName("first.png: Published");
  });

  it("counts flyers to review, confirmed, and needing attention", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockImplementation((url: string) =>
      url.includes("broken")
        ? Promise.reject(new Error("Analysis unavailable"))
        : Promise.resolve(extracted("First social"))
    );
    renderPage("admin");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "broken.png", { type: "image/png" }),
      new File(["three"], "third.jpg", { type: "image/jpeg" }),
    ]);
    const progress = screen.getByLabelText("Review progress");
    await waitFor(() => expect(progress).toHaveTextContent(/Attention\s*1/));
    expect(progress).toHaveTextContent(/To review\s*2/);
    expect(progress).toHaveTextContent(/Confirmed\s*0/);

    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    expect(progress).toHaveTextContent(/Confirmed\s*1/);
    expect(within(saveBar()).getByRole("button", { name: "Publish 1 event" })).toBeEnabled();
  });

  it("opens the first ready flyer when the first upload fails analysis", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockImplementation((url: string) =>
      url.includes("first")
        ? Promise.reject(new Error("Analysis unavailable"))
        : Promise.resolve(extracted("Ready second event"))
    );
    renderPage("admin");

    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["bad"], "first-broken.png", { type: "image/png" }),
      new File(["good"], "second-ready.png", { type: "image/png" }),
    ]);

    expect(await screen.findByLabelText("Event Title *")).toHaveValue("Ready second event");
    expect(detail("second-ready.png")).toBeInTheDocument();
  });

  it("keeps validation errors readable when a rejected flyer has no preview", async () => {
    const user = userEvent.setup();
    renderPage("admin");
    const oversizedFile = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "oversized.png",
      { type: "image/png" }
    );

    await user.upload(screen.getByLabelText("Flyer images"), oversizedFile);
    await waitFor(async () =>
      expect(await frame("oversized.png")).toHaveAccessibleName("oversized.png: Invalid file")
    );
    expect(within(detail("oversized.png")).getByRole("alert")).toHaveTextContent(
      "Image must be 5 MB or smaller."
    );
    expect(mocks.uploadEventFlyer).not.toHaveBeenCalled();
  });

  it("removes a flyer if its upload finishes after leaving the import page", async () => {
    const pending = Promise.withResolvers<{ url: string; path: string }>();
    mocks.uploadEventFlyer.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    const page = renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );
    await waitFor(() => expect(mocks.uploadEventFlyer).toHaveBeenCalledOnce());
    page.unmount();
    pending.resolve({ url: "https://example.com/first.png", path: "user-1/first.png" });
    await waitFor(() =>
      expect(mocks.removeEventFlyer).toHaveBeenCalledWith("https://example.com/first.png")
    );
    expect(mocks.extractEventFromFlyer).not.toHaveBeenCalled();
  });

  it("prevents host editors from uploading or publishing for an organizer", () => {
    mocks.useMyOrganizers.mockReturnValue({
      data: [
        {
          organizerId: "org-1",
          organizerName: "Dance Club",
          organizerStatus: "active",
          memberRole: "editor",
        },
      ],
      isLoading: false,
      error: null,
    });
    renderPage("host");
    expect(screen.getByText(/only active organizer owners and managers/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Flyer images")).not.toBeInTheDocument();
  });
});
