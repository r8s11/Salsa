import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRequest } from "../../listingRequests/listingRequestTestKit";
import type { AdminListingRequest } from "../../listingRequests/model";
import { AdminPendingListingRequestsNote } from "../components/entities/AdminPendingListingRequestsNote";
import AdminListingRequestsPage from "./AdminListingRequestsPage";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

const LINK = 'Link "Friday Social" to Artist Ana Rivera';
const MISSING = 'Add "DJ Fuego" as a DJ';

function missingDj(overrides: Partial<AdminListingRequest> = {}): AdminListingRequest {
  return adminRequest({
    id: "r-missing", request_type: "missing_listing", entity_kind: "dj", entity_id: null, entity_name: null, entity_slug: null,
    event_id: null, event_title: null, event_date: null, event_status: null, event_location: null, event_organizer_name: null,
    proposed_name: "DJ Fuego", proposed_city: "Boston", website: "https://fuego.example", instagram: "@fuego",
    details: "<i>Plays</i> Fridays", member_role: null, display_name: null, email: "fan@example.com",
    ...overrides,
  });
}

let requests: AdminListingRequest[] = [];
let reviewError: { message: string; code: string } | null = null;

function installRpc() {
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "admin_listing_requests") {
      const scoped = args.p_entity_id ? requests.filter((r) => r.entity_kind === args.p_entity_kind && r.entity_id === args.p_entity_id) : requests;
      return { data: args.p_status ? scoped.filter((r) => r.status === args.p_status) : scoped, error: null };
    }
    if (fn === "admin_entity_directory") {
      return { data: [{ id: "dj-9", kind: "dj", name: "DJ Fuego", slug: "dj-fuego", status: "active", city: "Boston" }], error: null };
    }
    if (fn === "admin_review_listing_request") {
      if (reviewError) return { data: null, error: reviewError };
      requests = requests.map((r) =>
        r.id === args.p_request_id ? { ...r, status: args.p_approve ? "approved" : "rejected", review_note: (args.p_note as string | null) ?? null } : r,
      );
      return { data: { request_id: args.p_request_id, approved: args.p_approve }, error: null };
    }
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
}

function renderAt(path: string, element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const renderPage = (path = "/admin/requests") => renderAt(path, <AdminListingRequestsPage />);
const row = (name: string) => screen.findByRole("listitem", { name });

beforeEach(() => {
  rpc.mockReset();
  reviewError = null;
  requests = [adminRequest()];
  installRpc();
});

describe("AdminListingRequestsPage", () => {
  it("shows requester, role on the listing and the event's organizer for an event link", async () => {
    requests = [adminRequest({ details: "Teaching the opener" })];
    renderPage();

    const entry = await row(LINK);
    expect(within(entry).getByText("Ana Rivera")).toBeInTheDocument();
    expect(within(entry).getByText("Manager")).toBeInTheDocument();
    expect(within(entry).getByText("Organizer: Unrelated Promotions")).toBeInTheDocument();
    expect(within(entry).getByRole("link", { name: "Friday Social" })).toHaveAttribute("href", "/admin/events?edit=event-1");
    expect(within(entry).getByText(/Main Hall/)).toBeInTheDocument();
    expect(within(entry).getByText("Teaching the opener")).toBeInTheDocument();
    expect(within(entry).queryByText("Already on this profile")).not.toBeInTheDocument();
  });

  it("flags a link that already exists and an event with no organizer", async () => {
    requests = [adminRequest({ already_linked: true, event_organizer_name: null })];
    renderPage();

    const entry = await row(LINK);
    expect(within(entry).getByText("Already on this profile")).toBeInTheDocument();
    expect(within(entry).getByText("No organizer")).toBeInTheDocument();
  });

  it("approves an event link and calls admin_review_listing_request with the note", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: `Approve: ${LINK}` }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("This adds the event to the profile. It does not change the event or its organizer's access.")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Note (optional)"), "On the flyer");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve request" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_listing_request", {
        p_request_id: "r-link",
        p_approve: true,
        p_note: "On the flyer",
        p_resulting_entity_id: null,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: /Approved/ }));
    expect(within(await row(LINK)).getByText("Event linked")).toBeInTheDocument();
  });

  it("keeps the request pending and shows the message when approval is refused", async () => {
    reviewError = { message: "That event can no longer be linked.", code: "23514" };
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: `Approve: ${LINK}` }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve request" }));

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("That event can no longer be linked.");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveAttribute("aria-selected", "true");
    expect(await row(LINK)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Approve: ${LINK}` })).toBeEnabled();
  });

  it("requires choosing the created listing to approve a missing listing", async () => {
    requests = [missingDj()];
    renderPage();

    const entry = await row(MISSING);
    expect(within(entry).getByRole("link", { name: "Create the listing" })).toHaveAttribute("href", "/admin/djs/new");
    expect(within(entry).getByText("<i>Plays</i> Fridays")).toBeInTheDocument();
    expect(within(entry).getByText(/https:\/\/fuego\.example/)).toBeInTheDocument();
    expect(within(entry).queryByRole("link", { name: /fuego\.example/ })).not.toBeInTheDocument();

    await userEvent.click(within(entry).getByRole("button", { name: `Approve: ${MISSING}` }));
    expect(within(entry).getByRole("alert")).toHaveTextContent("Choose the listing you created for this request.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.selectOptions(await within(entry).findByLabelText(`Listing created for: ${MISSING}`), await within(entry).findByRole("option", { name: /DJ Fuego/ }));
    await userEvent.click(within(entry).getByRole("button", { name: `Approve: ${MISSING}` }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve request" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_listing_request", {
        p_request_id: "r-missing",
        p_approve: true,
        p_note: null,
        p_resulting_entity_id: "dj-9",
      }),
    );
  });

  it("links an identity change to the listing's admin page with what was asked", async () => {
    requests = [
      adminRequest({
        id: "r-change", request_type: "profile_change", entity_kind: "venue", entity_id: "venue-1", entity_name: "Havana Club",
        event_id: null, event_title: null, proposed_name: "Club Havana", proposed_city: "Cambridge", member_role: "owner",
      }),
    ];
    renderPage();

    const entry = await row("Change details for Havana Club");
    expect(within(entry).getByRole("link", { name: "Open the listing" })).toHaveAttribute("href", "/admin/venues/venue-1");
    expect(within(entry).getByText(/New name: Club Havana/)).toBeInTheDocument();
    expect(within(entry).getByText(/New city: Cambridge/)).toBeInTheDocument();
    expect(within(entry).getByText("Owner")).toBeInTheDocument();
  });

  it("filters to one listing from ?kind=dj&entity=…", async () => {
    requests = [
      adminRequest(),
      adminRequest({ id: "r-dj", entity_kind: "dj", entity_id: "dj-1", entity_name: "Fuego", event_title: "Sunday Rueda" }),
    ];
    renderPage("/admin/requests?kind=dj&entity=dj-1");

    expect(await row('Link "Sunday Rueda" to DJ Fuego')).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: LINK })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show every request" })).toHaveAttribute("href", "/admin/requests");
  });

  it("rejects with a note and moves the row to Rejected", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: `Reject: ${LINK}` }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Note (optional)"), "Not on the lineup");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_listing_request", {
        p_request_id: "r-link",
        p_approve: false,
        p_note: "Not on the lineup",
        p_resulting_entity_id: null,
      }),
    );
    expect(await screen.findByText("No requests are waiting on a decision.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Rejected/ }));
    const entry = await row(LINK);
    expect(within(entry).getByText("Not approved")).toBeInTheDocument();
    expect(within(entry).getByText("Not on the lineup")).toBeInTheDocument();
    expect(within(entry).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers a retry when the requests fail to load", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /retry|try again/i }));
    expect(await row(LINK)).toBeInTheDocument();
  });
});

describe("AdminPendingListingRequestsNote", () => {
  it("renders nothing when no request is waiting on the listing", async () => {
    requests = [];
    const { container } = renderAt("/admin/djs/dj-1", <AdminPendingListingRequestsNote kind="dj" id="dj-1" />);

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_listing_requests", { p_status: "pending", p_entity_kind: "dj", p_entity_id: "dj-1" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the filtered queue with the pending count", async () => {
    requests = [
      adminRequest({ id: "a", entity_kind: "dj", entity_id: "dj-1" }),
      adminRequest({ id: "b", entity_kind: "dj", entity_id: "dj-1" }),
      adminRequest({ id: "c", entity_kind: "dj", entity_id: "dj-1", status: "approved" }),
    ];
    renderAt("/admin/djs/dj-1", <AdminPendingListingRequestsNote kind="dj" id="dj-1" />);

    expect(await screen.findByRole("link", { name: "2 pending requests" })).toHaveAttribute("href", "/admin/requests?kind=dj&entity=dj-1");
  });
});
