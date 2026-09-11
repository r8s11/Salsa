import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CityProvider } from "../contexts/CityContext";
import HostCreateEventPage from "./HostCreateEventPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useMyOrganizers: vi.fn(),
  createOrganizerEvent: vi.fn(),
  updateOrganizerEvent: vi.fn(),
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
}));
vi.mock("../contexts/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers: mocks.useMyOrganizers }));
vi.mock("../features/host/api/organizerAccessRepo", () => ({
  createOrganizerEvent: mocks.createOrganizerEvent,
  updateOrganizerEvent: mocks.updateOrganizerEvent,
  OrganizerAccessError: class OrganizerAccessError extends Error {},
}));
vi.mock("../features/events/api/eventFlyers", () => ({
  uploadEventFlyer: mocks.uploadEventFlyer,
  removeEventFlyer: mocks.removeEventFlyer,
  validateEventFlyer: () => null,
}));

function renderPage() {
  return render(
    <CityProvider>
      <MemoryRouter>
        <HostCreateEventPage />
      </MemoryRouter>
    </CityProvider>
  );
}

describe("HostCreateEventPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it("uses the only active manageable organizer without showing a selector", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [{ organizerId: "org-1", organizerName: "Boston Salsa Collective", organizerStatus: "active", memberRole: "owner" }],
      isLoading: false,
      error: null,
    });
    mocks.createOrganizerEvent.mockResolvedValue("evt-1");

    renderPage();

    expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    expect(screen.queryByLabelText("Organizer")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Creating event for" })).toBeInTheDocument();
    expect(screen.getByText("Creating event for")).toHaveAttribute("id", "host-event-organizer-label");
    expect(screen.queryByLabelText("Organizer")).not.toBeInTheDocument();
    expect(mocks.createOrganizerEvent).not.toHaveBeenCalled();
  });
  it("shows a safe organizer access error with retry instead of the no-organizer state", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("network down"),
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't check organizer access/i);
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create an Organizer first" })).not.toBeInTheDocument();
  });


  it("excludes inactive organizers and editors from creation access", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [
        { organizerId: "org-1", organizerName: "Suspended Club", organizerStatus: "suspended", memberRole: "owner" },
        { organizerId: "org-2", organizerName: "Editor Club", organizerStatus: "active", memberRole: "editor" },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "You don't have create access" })).toBeInTheDocument();
    expect(screen.getByText(/owners and managers can create/i)).toBeInTheDocument();
    expect(screen.queryByText("Suspended Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Editor Club")).not.toBeInTheDocument();
  });

  it("selects one of multiple active owner/manager organizers and persists draft styles", async () => {
    const user = userEvent.setup();
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [
        { organizerId: "org-1", organizerName: "Boston Salsa Collective", organizerStatus: "active", memberRole: "owner" },
        { organizerId: "org-2", organizerName: "NYC Dance Co", organizerStatus: "active", memberRole: "manager" },
      ],
      isLoading: false,
      error: null,
    });
    mocks.createOrganizerEvent.mockResolvedValue("evt-1");

    renderPage();
    await user.selectOptions(screen.getByRole("combobox", { name: "Creating event for" }), "org-2");
    await user.type(screen.getByLabelText("Event Title *"), "Tuesday Social");
    await user.click(screen.getByRole("button", { name: "Social" }));
    await user.type(screen.getByLabelText("Date *"), "2099-10-24");
    await user.click(screen.getByRole("button", { name: "Salsa" }));
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(1));
    expect(mocks.createOrganizerEvent).toHaveBeenCalledWith(
      "org-2",
      expect.objectContaining({ title: "Tuesday Social", dance_styles: ["salsa"] }),
      false
    );
  });

  it("shows a safe access error and does not retry the mutation implicitly", async () => {
    const user = userEvent.setup();
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [{ organizerId: "org-1", organizerName: "Boston Salsa Collective", organizerStatus: "active", memberRole: "owner" }],
      isLoading: false,
      error: null,
    });
    mocks.createOrganizerEvent.mockRejectedValue(new Error("active owner or manager membership required"));

    renderPage();
    await user.type(screen.getByLabelText("Event Title *"), "Tuesday Social");
    await user.click(screen.getByRole("button", { name: "Social" }));
    await user.type(screen.getByLabelText("Date *"), "2099-10-24");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have permission/i);
    expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(1);
  });
  it("keeps a created event when flyer attachment fails and cleans up the uploaded object", async () => {
    const user = userEvent.setup();
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", email: "host@example.com" } });
    mocks.useMyOrganizers.mockReturnValue({
      data: [{ organizerId: "org-1", organizerName: "Boston Salsa Collective", organizerStatus: "active", memberRole: "owner" }],
      isLoading: false,
      error: null,
    });
    mocks.createOrganizerEvent.mockResolvedValue("evt-1");
    mocks.uploadEventFlyer.mockResolvedValue({ url: "https://cdn.test/flyer.jpg", path: "x" });
    mocks.updateOrganizerEvent.mockRejectedValue(new Error("temporary update failure"));

    const view = renderPage();
    await user.type(screen.getByLabelText("Event Title *"), "Tuesday Social");
    await user.click(screen.getByRole("button", { name: "Social" }));
    await user.type(screen.getByLabelText("Date *"), "2099-10-24");
    const input = view.container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, new File(["flyer"], "flyer.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => expect(mocks.updateOrganizerEvent).toHaveBeenCalledTimes(1));
    expect(mocks.removeEventFlyer).toHaveBeenCalledWith("https://cdn.test/flyer.jpg");
    expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(1);
  });
});
