import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntityWorkspaceOverviewPage from "./EntityWorkspaceOverviewPage";
import { member, pricePlan, privateOffer, renderWorkspacePage, schoolClass, schoolWorkspace } from "./workspaceTestKit";
import type { EntityWorkspace } from "../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

function serve(workspace: EntityWorkspace) {
  rpc.mockResolvedValue({ data: workspace, error: null });
}

const upcoming = [
  {
    id: "event-1",
    slug: "salsa-social",
    title: "Salsa Social",
    event_date: "2026-10-20T00:00:00Z",
    city: "boston",
    location: "Havana Club",
    image_url: null,
  },
];

beforeEach(() => {
  rpc.mockReset();
});

describe("EntityWorkspaceOverviewPage", () => {
  it("names the listing, its status, the caller's role and the public page", async () => {
    serve(schoolWorkspace({ role: "manager" }));
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    expect(await screen.findByRole("heading", { level: 1, name: "Salsa Academy" })).toBeInTheDocument();
    expect(screen.getByText("School · Overview")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Your role: Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View public page/ })).toHaveAttribute("href", "/s/salsa-academy");
  });

  it("links a venue and an artist to their own public pages", async () => {
    const venue: EntityWorkspace = {
      kind: "venue",
      role: "owner",
      members: [member("owner")],
      upcoming: [],
      offerings: null,
      entity: {
        id: "venue-1",
        name: "Havana Club",
        slug: "havana-club",
        status: "active",
        city: "boston",
        state_region: null,
        country: null,
        address_line1: null,
        address_line2: null,
        postal_code: null,
        website: null,
        instagram: null,
        phone: null,
      },
    };
    serve(venue);
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="venue" />, "/host/venues/venue-1", "/host/venues/:id");

    expect(await screen.findByRole("link", { name: /View public page/ })).toHaveAttribute("href", "/v/havana-club");
    // Venues carry no timetable.
    expect(screen.queryByText("The week's timetable")).not.toBeInTheDocument();
  });

  it("withholds the public link while the listing awaits review", async () => {
    const workspace = schoolWorkspace();
    serve({ ...workspace, entity: { ...workspace.entity, status: "needs_review" } });
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    expect(await screen.findByText("Awaiting review")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View public page/ })).not.toBeInTheDocument();
  });

  it("sets a school's standing figures and a seven-division week", async () => {
    serve(
      schoolWorkspace({
        members: [member("owner"), member("editor")],
        offerings: {
          classes: [schoolClass(), schoolClass({ id: "class-2", title: "Paused class", status: "paused" })],
          privates: [privateOffer()],
          plans: [pricePlan(), pricePlan({ id: "plan-2", name: "Membership", plan_type: "membership" })],
        },
        upcoming,
      })
    );
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    await screen.findByRole("heading", { level: 1, name: "Salsa Academy" });
    const figures = document.querySelector(".ws-figures") as HTMLElement;
    const figure = (label: RegExp) => within(screen.getByText(label).closest(".desk__count") as HTMLElement).getByText(/^\d+$/).textContent;
    expect(figures).not.toBeNull();
    expect(figure(/active class/)).toBe("1");
    expect(figure(/private lesson/)).toBe("1");
    expect(figure(/price plans/)).toBe("2");
    expect(figure(/team members/)).toBe("2");

    const week = screen.getByRole("region", { name: "The week's timetable" });
    expect(within(week).getByText("Tuesday")).toBeInTheDocument();
    expect(within(week).getAllByText("No classes.")).toHaveLength(6);
    expect(within(week).getByText("Salsa On2 Fundamentals")).toBeInTheDocument();
    // A paused class is not on the public week.
    expect(within(week).queryByText("Paused class")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit timetable" })).toHaveAttribute(
      "href",
      "/host/schools/school-1/timetable"
    );
  });

  it("lists upcoming linked nights as links to their event pages", async () => {
    serve(schoolWorkspace({ upcoming }));
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    const nights = await screen.findByRole("region", { name: "Upcoming nights" });
    expect(within(nights).getByRole("link", { name: "Salsa Social" })).toHaveAttribute("href", "/events/salsa-social");
  });

  it("says plainly when no night is linked yet", async () => {
    serve(schoolWorkspace());
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    expect(await screen.findByText(/No upcoming nights are linked/)).toBeInTheDocument();
  });

  it("explains a refused listing and links back to Host", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "You do not manage this listing.", code: "42501" } });
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    expect(await screen.findByRole("heading", { name: "You can’t open this listing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Host" })).toHaveAttribute("href", "/host");
  });

  it("offers a retry when the read fails for another reason", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "network down", code: "500" } });
    serve(schoolWorkspace());
    renderWorkspacePage(<EntityWorkspaceOverviewPage kind="school" />, "/host/schools/school-1", "/host/schools/:id");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("network down");
    alert.querySelector("button")?.click();
    expect(await screen.findByRole("heading", { level: 1, name: "Salsa Academy" })).toBeInTheDocument();
  });
});
