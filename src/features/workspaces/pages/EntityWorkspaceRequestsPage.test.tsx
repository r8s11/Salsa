import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventLinkRequest, listingRequest } from "../../listingRequests/listingRequestTestKit";
import type { ListingRequest } from "../../listingRequests/model";
import type { EntityWorkspace, WorkspaceRole } from "../model";
import { workspaceSections } from "../workspaceSections";
import EntityWorkspaceRequestsPage from "./EntityWorkspaceRequestsPage";
import { member, renderWorkspacePage } from "./workspaceTestKit";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

function artistWorkspace(role: WorkspaceRole = "manager"): EntityWorkspace {
  return {
    kind: "instructor",
    role,
    members: [member("owner")],
    upcoming: [],
    offerings: null,
    entity: {
      id: "artist-1", name: "Ana Rivera", slug: "ana-rivera", status: "active", city: "boston", state_region: null,
      country: null, organization: null, website: null, instagram: null, description: null, image_url: null,
    },
  };
}

function venueWorkspace(): EntityWorkspace {
  return {
    kind: "venue",
    role: "owner",
    members: [member("owner")],
    upcoming: [],
    offerings: null,
    entity: {
      id: "venue-1", name: "Havana Club", slug: "havana-club", status: "active", city: "boston", state_region: null,
      country: null, address_line1: null, address_line2: null, postal_code: null, website: null, instagram: null, phone: null,
    },
  };
}

const candidate = { id: "event-1", title: "Friday Social", event_date: "2026-11-20T01:00:00Z", location: "Main Hall" };

/** A successful submit adds a pending request to what my_listing_requests returns. */
function serve(workspace: EntityWorkspace, options: { mine?: ListingRequest[]; submitLink?: RpcResult } = {}) {
  const mine = [...(options.mine ?? [])];
  rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case "entity_workspace":
        return Promise.resolve({ data: workspace, error: null });
      case "listing_request_event_candidates":
        return Promise.resolve({ data: [candidate], error: null });
      case "my_listing_requests":
        return Promise.resolve({ data: [...mine], error: null });
      case "listing_request_submit_event_link": {
        const result = options.submitLink ?? { data: "r-new", error: null };
        if (!result.error) mine.unshift(eventLinkRequest({ id: "r-new" }));
        return Promise.resolve(result);
      }
      case "listing_request_submit_profile_change":
        mine.unshift(listingRequest({ id: "r-change", request_type: "profile_change", entity_kind: workspace.kind, entity_id: workspace.entity.id, entity_name: workspace.entity.name, proposed_name: "Club Havana" }));
        return Promise.resolve({ data: "r-change", error: null });
      default:
        return Promise.resolve({ data: null, error: null });
    }
  });
}

function renderRequests(kind: "instructor" | "venue" = "instructor") {
  const segment = kind === "venue" ? "venues/venue-1" : "instructors/artist-1";
  return renderWorkspacePage(
    <EntityWorkspaceRequestsPage kind={kind} />,
    `/host/${segment}/requests`,
    `/host/${kind === "venue" ? "venues" : "instructors"}/:id/requests`,
  );
}

async function chooseFridaySocial(form: HTMLElement) {
  await userEvent.type(within(form).getByLabelText("Find an event"), "Friday");
  await userEvent.click(await within(form).findByRole("radio", { name: /Friday Social/ }));
}

beforeEach(() => rpc.mockReset());

describe("EntityWorkspaceRequestsPage", () => {
  it("offers the event-link form to an Artist manager and sends it", async () => {
    serve(artistWorkspace());
    renderRequests();
    const form = await screen.findByRole("form", { name: "Ask for an event to be added to Ana Rivera" });
    expect(within(form).getByText("Salsa Segura checks every request. The event's organizer keeps control of the event.")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Send request" })).toBeDisabled();

    await chooseFridaySocial(form);
    expect(within(form).getByRole("radio", { name: /Main Hall/ })).toBeChecked();
    await userEvent.type(within(form).getByLabelText("Note for the reviewer"), "Teaching the opener");
    await userEvent.click(within(form).getByRole("button", { name: "Send request" }));

    expect(rpc).toHaveBeenCalledWith("listing_request_submit_event_link", {
      p_kind: "instructor",
      p_entity_id: "artist-1",
      p_event_id: "event-1",
      p_note: "Teaching the opener",
    });
    expect(rpc).toHaveBeenCalledWith("listing_request_event_candidates", { p_kind: "instructor", p_entity_id: "artist-1", p_query: "Friday" });
    const sent = await screen.findByRole("listitem", { name: 'Link "Friday Social" to Artist Ana Rivera' });
    expect(within(sent).getByText("Waiting for review")).toBeInTheDocument();
  });

  it("offers no event-link form on a venue workspace", async () => {
    serve(venueWorkspace());
    renderRequests("venue");

    expect(await screen.findByRole("form", { name: "Ask for a change to name, city or page address" })).toBeInTheDocument();
    expect(screen.getByText("Events at your venue are managed by their organizers. Ask the organizer, or contact them from the event page.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Find an event")).not.toBeInTheDocument();
  });

  it("shows editors a refusal instead of the forms", async () => {
    serve(artistWorkspace("editor"));
    renderRequests();

    expect(await screen.findByText("Only owners and managers can send requests for this listing.")).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("shows the server message and keeps the selection when the request is refused", async () => {
    serve(artistWorkspace(), { submitLink: { data: null, error: { message: "You already asked for this link. It is waiting for review.", code: "23505" } } });
    renderRequests();
    const form = await screen.findByRole("form", { name: "Ask for an event to be added to Ana Rivera" });
    await chooseFridaySocial(form);

    await userEvent.click(within(form).getByRole("button", { name: "Send request" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("You already asked for this link. It is waiting for review.");
    expect(within(form).getByRole("radio", { name: /Friday Social/ })).toBeChecked();
    expect(within(form).getByLabelText("Find an event")).toHaveValue("Friday");
  });

  it("requires at least one field for an identity change", async () => {
    serve(venueWorkspace());
    renderRequests("venue");
    const form = await screen.findByRole("form", { name: "Ask for a change to name, city or page address" });

    await userEvent.click(within(form).getByRole("button", { name: "Send request" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Fill in at least one field.");
    expect(rpc).not.toHaveBeenCalledWith("listing_request_submit_profile_change", expect.anything());

    await userEvent.type(within(form).getByLabelText("New name"), "Club Havana");
    await userEvent.click(within(form).getByRole("button", { name: "Send request" }));
    expect(rpc).toHaveBeenCalledWith("listing_request_submit_profile_change", {
      p_kind: "venue",
      p_entity_id: "venue-1",
      p_requested_name: "Club Havana",
      p_requested_city: "",
      p_note: "",
    });
    expect(await screen.findByRole("listitem", { name: "Change details for Havana Club" })).toBeInTheDocument();
    expect(within(form).getByLabelText("New name")).toHaveValue("");
  });

  it("lists only this listing's requests", async () => {
    serve(artistWorkspace(), {
      mine: [
        eventLinkRequest({ id: "r-here" }),
        eventLinkRequest({ id: "r-other", entity_id: "artist-2", entity_name: "Luis Vega", event_title: "Sunday Rueda" }),
        listingRequest({ id: "r-missing" }),
      ],
    });
    renderRequests();

    const list = await screen.findByRole("region", { name: "Requests for Ana Rivera" });
    expect(await within(list).findByRole("listitem", { name: /Friday Social/ })).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("workspaceSections", () => {
  const labels = (role: WorkspaceRole) => workspaceSections("instructor", "artist-1", role).map((section) => section.label);

  it("lists Requests for owners and managers but not editors", () => {
    expect(labels("owner")).toContain("Requests");
    expect(labels("manager")).toContain("Requests");
    expect(labels("admin")).toContain("Requests");
    expect(labels("editor")).not.toContain("Requests");
    expect(workspaceSections("instructor", "artist-1", "manager").find((section) => section.key === "requests")?.to).toBe(
      "/host/instructors/artist-1/requests",
    );
  });
});
