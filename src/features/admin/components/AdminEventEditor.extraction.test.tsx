import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../model/adminEventForm";
import type * as EventFlyersModule from "../../events/api/eventFlyers";
import type { ExtractedEvent } from "../../flyer-extraction/types";

const { useActiveTaxonomyTerms, useVenueCombobox, uploadEventFlyer, extractEventFromFlyer } =
  vi.hoisted(() => ({
    useActiveTaxonomyTerms: vi.fn(),
    useVenueCombobox: vi.fn(),
    uploadEventFlyer: vi.fn(),
    extractEventFromFlyer: vi.fn(),
  }));

vi.mock("../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms }));
vi.mock("../hooks/useVenueCombobox", () => ({ useVenueCombobox }));
vi.mock("../../events/api/eventFlyers", async (importOriginal) => ({
  ...(await importOriginal<typeof EventFlyersModule>()),
  uploadEventFlyer,
  removeEventFlyer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../flyer-extraction/client", () => ({ extractEventFromFlyer }));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const FLYER_URL =
  `https://project.supabase.co/storage/v1/object/public/event-flyers/${ADMIN_ID}` +
  `/admin-draft-33333333-3333-4333-8333-333333333333/flyer.png`;

function extraction(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    title: "Salsa Rooftop",
    date: "2026-10-01",
    start_time: "21:00",
    end_time: null,
    venue_name: "The Terrace",
    address: "5 Main St",
    city: "boston",
    dance_styles: [],
    event_type: null,
    price: null,
    organizer_name: null,
    instagram: null,
    website: null,
    details: [],
    ...overrides,
  };
}

function renderCreateEditor(flyerOwnerId: string | null = ADMIN_ID) {
  return render(
    <MemoryRouter>
      <AdminEventEditor
        initial={buildEmptyAdminForm("boston")}
        initialTaxonomyTerms={[]}
        heading="New event"
        submitLabel="Create event"
        isSaving={false}
        error={null}
        flyerOwnerId={flyerOwnerId}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />
    </MemoryRouter>
  );
}

function flyerFile() {
  return new File(["flyer-bytes"], "flyer.png", { type: "image/png" });
}

async function uploadFlyer(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("Event flyer"), flyerFile());
  return waitFor(() =>
    expect(screen.getByRole("button", { name: /Analyze flyer/i })).toBeEnabled()
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
  uploadEventFlyer.mockResolvedValue({ path: "p", url: FLYER_URL });
  extractEventFromFlyer.mockResolvedValue(extraction());
});

describe("Admin direct-create flyer analysis", () => {
  it("uploads the flyer under the admin's own id so analysis can read it", async () => {
    const user = userEvent.setup();
    renderCreateEditor();

    await uploadFlyer(user);

    expect(uploadEventFlyer).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: ADMIN_ID,
        eventId: expect.stringMatching(/^admin-draft-/),
      })
    );
  });

  it("analyzes the uploaded flyer and applies the extracted details on request", async () => {
    const user = userEvent.setup();
    renderCreateEditor();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));

    expect(extractEventFromFlyer).toHaveBeenCalledWith(FLYER_URL);
    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use These Details" }));

    expect(screen.getByLabelText(/Event Title/i)).toHaveValue("Salsa Rooftop");
    expect(screen.getByLabelText("Date *")).toHaveValue("2026-10-01");
  });

  it("keeps the applied fields editable by hand", async () => {
    const user = userEvent.setup();
    renderCreateEditor();
    await uploadFlyer(user);
    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));
    await screen.findByText(/Flyer analyzed/i);
    await user.click(screen.getByRole("button", { name: "Use These Details" }));

    const title = screen.getByLabelText(/Event Title/i);
    await user.clear(title);
    await user.type(title, "Corrected Title");

    expect(title).toHaveValue("Corrected Title");
  });

  it("shows a readable failure with retry instead of appearing to do nothing", async () => {
    const user = userEvent.setup();
    extractEventFromFlyer.mockRejectedValueOnce(new Error("We couldn't read this flyer."));
    renderCreateEditor();
    await uploadFlyer(user);

    await user.click(screen.getByRole("button", { name: /Analyze flyer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't read this flyer.");

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText(/Flyer analyzed/i)).toBeInTheDocument();
    expect(extractEventFromFlyer).toHaveBeenCalledTimes(2);
  });

  it("refuses to upload to an unanalyzable path when the admin id is unresolved", async () => {
    const user = userEvent.setup();
    renderCreateEditor(null);

    await user.upload(screen.getByLabelText("Event flyer"), flyerFile());

    expect(uploadEventFlyer).not.toHaveBeenCalled();
    expect(await screen.findByText(/admin session is still loading/i)).toBeInTheDocument();
  });
});
