import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventLinkRequest, listingRequest } from "../listingRequestTestKit";
import type { ListingRequest } from "../model";
import ListingRequestStatusList from "./ListingRequestStatusList";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

function mockRequests(requests: ListingRequest[], withdraw: { data: unknown; error: { message: string; code?: string } | null } = { data: null, error: null }) {
  rpc.mockImplementation((name: string) =>
    Promise.resolve(name === "my_listing_requests" ? { data: requests, error: null } : name === "listing_request_withdraw" ? withdraw : { data: null, error: null }),
  );
}

function renderList(filter?: (request: ListingRequest) => boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ListingRequestStatusList heading="Your listing requests" emptyText="You have not sent a request yet." filter={filter} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const row = (name: RegExp) => screen.findByRole("listitem", { name });

beforeEach(() => rpc.mockReset());

describe("ListingRequestStatusList", () => {
  it("shows each request with its status word", async () => {
    mockRequests([
      listingRequest({ id: "r1" }),
      eventLinkRequest({ id: "r2", status: "approved" }),
      listingRequest({ id: "r3", proposed_name: "Club Tropical", status: "rejected" }),
    ]);
    renderList();

    expect(within(await row(/Casa Habana/)).getByText("Waiting for review")).toBeInTheDocument();
    expect(within(await row(/Friday Social/)).getByText("Event linked")).toBeInTheDocument();
    expect(within(await row(/Club Tropical/)).getByText("Not approved")).toBeInTheDocument();
  });

  it("shows the reviewer's note on a rejected request and no note otherwise", async () => {
    mockRequests([
      listingRequest({ id: "r1", review_note: "internal triage" }),
      listingRequest({ id: "r3", proposed_name: "Club Tropical", status: "rejected", review_note: "It closed in 2024." }),
    ]);
    renderList();

    expect(within(await row(/Club Tropical/)).getByText("Note: It closed in 2024.")).toBeInTheDocument();
    expect(within(await row(/Casa Habana/)).queryByText(/Note:/)).not.toBeInTheDocument();
  });

  it("offers Withdraw only on pending requests and calls listing_request_withdraw", async () => {
    mockRequests([listingRequest({ id: "r1" }), eventLinkRequest({ id: "r2", status: "approved" })]);
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: 'Withdraw request: Add "Casa Habana" as a Venue' }));

    expect(rpc).toHaveBeenCalledWith("listing_request_withdraw", { p_request_id: "r1" });
    expect(screen.getAllByRole("button", { name: /Withdraw request/ })).toHaveLength(1);
  });

  it("shows the server message when withdraw fails", async () => {
    mockRequests([listingRequest()], { data: null, error: { message: "This request was already decided.", code: "23514" } });
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: /Withdraw request/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This request was already decided.");
  });

  it("links an approved missing listing to its new page so the person can claim it", async () => {
    mockRequests([listingRequest({ status: "approved", resulting_entity_id: "v9", resulting_entity_slug: "casa-habana" })]);
    renderList();

    expect(within(await row(/Casa Habana/)).getByText("Listing added")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claim it" })).toHaveAttribute("href", "/v/casa-habana");
  });

  it("renders request text as plain text", async () => {
    mockRequests([listingRequest({ details: "<b>x</b> opened in May" })]);
    renderList();

    expect(await screen.findByText("<b>x</b> opened in May")).toBeInTheDocument();
  });

  it("lists only the requests the filter keeps, and says so when none remain", async () => {
    mockRequests([listingRequest(), eventLinkRequest()]);
    const { unmount } = renderList((request) => request.request_type === "event_link");
    expect(await row(/Friday Social/)).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /Casa Habana/ })).not.toBeInTheDocument();
    unmount();

    renderList(() => false);
    expect(await screen.findByText("You have not sent a request yet.")).toBeInTheDocument();
  });
});
