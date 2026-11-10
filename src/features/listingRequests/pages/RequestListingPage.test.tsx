import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listingRequest } from "../listingRequestTestKit";
import type { ListingRequest } from "../model";
import RequestListingPage from "./RequestListingPage";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

type Result = { data: unknown; error: { message: string; code?: string } | null };

/** `mine` is what my_listing_requests returns; a successful submit adds the new request to it. */
function mockServer(options: { submit?: Result; matches?: unknown[] } = {}) {
  const mine: ListingRequest[] = [];
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    switch (name) {
      case "public_entity_directory":
        return Promise.resolve({ data: options.matches ?? [], error: null });
      case "listing_request_submit_missing": {
        const result = options.submit ?? { data: "r-new", error: null };
        if (!result.error) mine.unshift(listingRequest({ id: "r-new", proposed_name: String(args.p_name) }));
        return Promise.resolve(result);
      }
      case "my_listing_requests":
        return Promise.resolve({ data: [...mine], error: null });
      default:
        return Promise.resolve({ data: null, error: null });
    }
  });
}

function renderPage(path = "/request-listing") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <RequestListingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const casaCuba = { kind: "venue", id: "v1", name: "Casa Cuba", slug: "casa-cuba", description: null, image_url: null, city: "boston" };

async function fillAndConfirm(name = "Casa Habana") {
  await userEvent.selectOptions(screen.getByLabelText("Type of listing"), "venue");
  await userEvent.type(screen.getByLabelText("Name"), name);
  await userEvent.click(screen.getByLabelText("I searched and this listing is not here"));
}

beforeEach(() => rpc.mockReset());

describe("RequestListingPage", () => {
  it("lists directory matches while the name is typed", async () => {
    mockServer({ matches: [casaCuba] });
    renderPage("/request-listing?kind=venue");

    await userEvent.type(screen.getByLabelText("Name"), "Casa");

    const matches = await screen.findByRole("region", { name: "Possible matches" });
    expect(await within(matches).findByRole("link", { name: /Casa Cuba/ })).toHaveAttribute("href", "/v/casa-cuba");
    expect(rpc).toHaveBeenCalledWith("public_entity_directory", expect.objectContaining({ p_kind: "venue", p_query: "Casa" }));
  });

  it("will not send until the existing-listing box is ticked", async () => {
    mockServer();
    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Casa Habana");

    const send = screen.getByRole("button", { name: "Send request" });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByLabelText("I searched and this listing is not here"));
    expect(send).toBeEnabled();
  });

  it("sends the typed fields with checked_existing true", async () => {
    mockServer();
    renderPage();
    await fillAndConfirm();
    await userEvent.type(screen.getByLabelText("City"), "Boston");
    await userEvent.type(screen.getByLabelText("Website"), "https://casa.example");

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(rpc).toHaveBeenCalledWith("listing_request_submit_missing", {
      p_kind: "venue",
      p_name: "Casa Habana",
      p_city: "Boston",
      p_website: "https://casa.example",
      p_instagram: "",
      p_details: "",
      p_checked_existing: true,
    });
  });

  it("keeps the typed values and shows the server's message on a duplicate", async () => {
    mockServer({ submit: { data: null, error: { message: "A listing with that name already exists. Search for it and claim it instead.", code: "23505" } } });
    renderPage();
    await fillAndConfirm();

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A listing with that name already exists. Search for it and claim it instead.");
    expect(screen.getByLabelText("Name")).toHaveValue("Casa Habana");
    expect(screen.getByLabelText("I searched and this listing is not here")).toBeChecked();
  });

  it("rejects a non-https website before calling the server", async () => {
    mockServer();
    renderPage();
    await fillAndConfirm();
    await userEvent.type(screen.getByLabelText("Website"), "casa.example");

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByText("Website must be a full link starting with https://")).toBeInTheDocument();
    expect(screen.getByLabelText("Website")).toHaveAccessibleDescription("Website must be a full link starting with https://");
    expect(rpc).not.toHaveBeenCalledWith("listing_request_submit_missing", expect.anything());
  });

  it("preselects the kind from ?kind=dj", () => {
    mockServer();
    renderPage("/request-listing?kind=dj");
    expect(screen.getByLabelText("Type of listing")).toHaveValue("dj");
  });

  it("shows the new request as Waiting for review and clears the form", async () => {
    mockServer();
    renderPage();
    await fillAndConfirm();

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Request sent. We will review it; you can follow it below.")).toBeInTheDocument();
    const sent = await screen.findByRole("listitem", { name: 'Add "Casa Habana" as a Venue' });
    expect(within(sent).getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("I searched and this listing is not here")).not.toBeChecked();
  });
});
