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
  validateEventFlyer: (file: File) => (file.type === "image/png" ? null : "Unsupported image"),
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

describe("BulkFlyerImportPage", () => {
  it("publishes only flyers explicitly confirmed after review", async () => {
    const user = userEvent.setup();
    renderPage("host");
    await user.upload(screen.getByLabelText("Flyer images"), [
      new File(["one"], "first.png", { type: "image/png" }),
      new File(["two"], "second.png", { type: "image/png" }),
    ]);
    await screen.findByRole("listitem", { name: "first.png" });
    await screen.findByRole("listitem", { name: "second.png" });
    expect(screen.getByRole("listitem", { name: "first.png" })).toHaveTextContent("Not reviewed");
    await user.click(
      within(screen.getByRole("listitem", { name: /second.png/i })).getByRole("button", {
        name: "Skip",
      })
    );
    await user.click(screen.getByRole("button", { name: "Publish 0 reviewed events" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Review at least one flyer before saving.");
    expect(mocks.createOrganizerEvent).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Publish 1 reviewed event" }));
    await waitFor(() => expect(screen.getByText(/1 published/i)).toBeInTheDocument());
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
    await screen.findByRole("listitem", { name: "first.png" });
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    expect(screen.getByRole("listitem", { name: "first.png" })).toHaveTextContent("Reviewed");
    await user.clear(screen.getByLabelText("Event Title *"));
    await user.type(screen.getByLabelText("Event Title *"), "Corrected title");
    expect(screen.getByRole("listitem", { name: "first.png" })).toHaveTextContent("Not reviewed");
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Save 1 reviewed draft" }));
    await waitFor(() => expect(screen.getByText(/1 draft saved/i)).toBeInTheDocument());
    expect(mocks.createEventAsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Corrected title",
        image_url: "https://example.com/first.png",
        taxonomy_term_ids: ["salsa-id"],
      }),
      { id: "user-1", email: "owner@example.com" },
      false,
      expect.any(Function)
    );
  });

  it("retains a created admin flyer and shows a warning if taxonomy linking fails", async () => {
    const user = userEvent.setup();
    const page = renderPage("admin");
    mocks.createEventAsAdmin.mockImplementationOnce(
      async (
        _payload: unknown,
        _actor: unknown,
        _publish: boolean,
        onTaxonomyFailure: (message: string) => void
      ) => {
        onTaxonomyFailure(
          "Event saved, but tags could not be linked. Check them in the event editor."
        );
      }
    );
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );
    await screen.findByRole("listitem", { name: "first.png" });
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Save 1 reviewed draft" }));
    await waitFor(() =>
      expect(screen.getByRole("listitem", { name: "first.png" })).toHaveTextContent(
        /Saved.*tags could not be linked/
      )
    );
    page.unmount();
    expect(mocks.removeEventFlyer).not.toHaveBeenCalled();
  });

  it("does not publish unreviewed or invalid extracted rows", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted(""), date: null });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "first.png", { type: "image/png" })
    );
    await screen.findByRole("listitem", { name: "first.png" });
    expect(screen.getByRole("listitem", { name: "first.png" })).toHaveTextContent("Not reviewed");
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Publish 1 reviewed event" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/title is required/i);
    expect(mocks.createEventAsAdmin).not.toHaveBeenCalled();
  });

  it("surfaces an extracted city that cannot be matched before review confirmation", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted("City social"), city: "Atlantis" });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "city.png", { type: "image/png" })
    );

    await screen.findByRole("listitem", { name: "city.png" });
    expect(screen.getByRole("note")).toHaveTextContent(
      /Could not match flyer city "Atlantis" to a supported city/
    );
    expect(screen.getByRole("listitem", { name: "city.png" })).toHaveTextContent("Not reviewed");
  });

  it("flags the default city when extraction finds no flyer city", async () => {
    const user = userEvent.setup();
    mocks.extractEventFromFlyer.mockResolvedValue({ ...extracted("Boston social"), city: null });
    renderPage("admin");
    await user.upload(
      screen.getByLabelText("Flyer images"),
      new File(["one"], "missing-city.png", { type: "image/png" })
    );

    await screen.findByRole("listitem", { name: "missing-city.png" });
    expect(screen.getByRole("note")).toHaveTextContent(
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

    const row = await screen.findByRole("listitem", { name: "first.png" });
    expect(row).toHaveTextContent("Analysis unavailable");
    expect(within(row).getByRole("button", { name: "Retry analysis" })).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Continue manually" }));

    expect(screen.getByRole("img", { name: "Flyer first.png" })).toHaveAttribute(
      "src",
      "https://example.com/first.png"
    );
    expect(screen.getByLabelText("Event Title *")).toBeInTheDocument();
    expect(row).toHaveTextContent("Not reviewed");
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
    await screen.findByRole("listitem", { name: "second.png" });
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(
      within(screen.getByRole("listitem", { name: "second.png" })).getByRole("button", {
        name: "Review",
      })
    );
    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    await user.click(screen.getByRole("button", { name: "Publish 2 reviewed events" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("1 published; 1 failed")
    );
    const firstRow = screen.getByRole("listitem", { name: "first.png" });
    const secondRow = screen.getByRole("listitem", { name: "second.png" });
    expect(firstRow).toHaveTextContent("Saved");
    expect(secondRow).toHaveTextContent("Save failed");
    expect(within(secondRow).getByRole("button", { name: "Retry save" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Flyer second.png" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Second social");

    await user.click(within(secondRow).getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(secondRow).toHaveTextContent("Saved"));
    expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(3);
    expect(mocks.createOrganizerEvent.mock.calls[2][1]).toEqual(
      expect.objectContaining({ title: "Second social" })
    );
    expect(firstRow).toHaveTextContent("Saved");
  });
  it("shows batch progress, selected event facts, and the publication count", async () => {
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
      new File(["three"], "invalid.jpg", { type: "image/jpeg" }),
    ]);

    await screen.findByRole("listitem", { name: "first.png" });
    const progress = screen.getByRole("group", { name: "Review progress" });
    await waitFor(() => expect(progress).toHaveTextContent(/Failed\s*2/));
    expect(progress).toHaveTextContent(/Analyzed\s*1/);
    expect(progress).toHaveTextContent(/Reviewed\s*0/);
    const facts = screen.getByLabelText("Selected event facts");
    expect(facts).toHaveTextContent("First social");
    expect(facts).toHaveTextContent("2099-07-12");
    expect(facts).toHaveTextContent("20:00");
    expect(facts).toHaveTextContent("Studio 5");
    expect(facts).toHaveTextContent("Boston");

    await user.click(screen.getByRole("button", { name: "Confirm details against flyer" }));
    expect(progress).toHaveTextContent(/Reviewed\s*1/);
    expect(
      screen.getByRole("button", { name: "Publish 1 reviewed event" })
    ).toBeInTheDocument();
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
