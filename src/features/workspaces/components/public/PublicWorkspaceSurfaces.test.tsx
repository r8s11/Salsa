import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicEntityPage from "../../../../pages/PublicEntityPage";
import type { EntityClaim, EntityMembership, PublicSchoolOfferings } from "../../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase", () => ({ supabase: { rpc } }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("../../../../contexts/useAuth", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
const returnDestination = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/authReturnDestination", () => ({ setAuthReturnDestination: returnDestination }));

const entity = {
  kind: "school" as const, id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo", description: "Community dance school",
  image_url: null, city: "boston",
};
const detail = { entity, upcoming: [], past: [], related: [] };

const offerings: PublicSchoolOfferings = {
  classes: [
    { id: "c2", title: "Bachata Basics", style_name: "Bachata", level: "beginner", weekday: 3, start_time: "20:00", duration_minutes: 60, instructor_name: "Ana Rivera", instructor_slug: "ana-rivera", room: "Studio B", drop_in_cents: 1250, notes: null },
    { id: "c1", title: "Salsa On1", style_name: "Salsa", level: "intermediate", weekday: 1, start_time: "19:30", duration_minutes: 90, instructor_name: null, instructor_slug: null, room: null, drop_in_cents: 2000, notes: null },
  ],
  privates: [{ id: "p1", title: "One-on-one", duration_minutes: 60, price_cents: 9000, instructor_name: "Ana Rivera", instructor_slug: "ana-rivera", notes: null }],
  plans: [{ id: "pl1", name: "8-class pack", plan_type: "class_pack", price_cents: 12000, class_count: 8, valid_days: 60, notes: "Shareable" }],
};

type Handlers = {
  detail?: unknown;
  offerings?: { data: unknown; error: { message: string } | null };
  memberships?: EntityMembership[];
  claims?: EntityClaim[];
  claimSubmit?: { data: unknown; error: { message: string } | null };
};

function mockRpc(handlers: Handlers) {
  rpc.mockImplementation((name: string) => {
    switch (name) {
      case "public_entity_detail": return Promise.resolve({ data: handlers.detail ?? detail, error: null });
      case "public_school_offerings": return Promise.resolve(handlers.offerings ?? { data: null, error: null });
      case "my_entity_memberships": return Promise.resolve({ data: handlers.memberships ?? [], error: null });
      case "my_entity_claims": return Promise.resolve({ data: handlers.claims ?? [], error: null });
      case "entity_claim_submit": return Promise.resolve(handlers.claimSubmit ?? { data: "claim-1", error: null });
      default: return Promise.resolve({ data: null, error: null });
    }
  });
}

function renderPage(kind: "school" | "venue" | "instructor" = "school") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const path = { school: "/s/ritmo-vivo", venue: "/v/ritmo-vivo", instructor: "/i/ritmo-vivo" }[kind];
  const pattern = { school: "/s/:slug", venue: "/v/:slug", instructor: "/i/:slug" }[kind];
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={pattern} element={<PublicEntityPage kind={kind} />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockReset();
  returnDestination.mockReset();
  auth.user = null;
});

describe("school offerings on the public page", () => {
  it("groups classes by weekday with prices and instructor links", async () => {
    mockRpc({ offerings: { data: offerings, error: null } });

    renderPage();

    const timetable = (await screen.findByRole("heading", { name: "Weekly classes" })).closest("section")!;
    const days = within(timetable).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(days).toEqual(["Monday", "Wednesday"]);
    expect(within(timetable).getByText("7:30 PM – 9:00 PM")).toBeInTheDocument();
    expect(within(timetable).getByText("$20")).toBeInTheDocument();
    expect(within(timetable).getByText("$12.50")).toBeInTheDocument();
    expect(within(timetable).getByRole("link", { name: "Ana Rivera" })).toHaveAttribute("href", "/i/ana-rivera");
    expect(within(timetable).getByText(/classes repeat weekly/i)).toBeInTheDocument();

    const privates = screen.getByRole("heading", { name: "Private lessons" }).closest("section")!;
    expect(within(privates).getByText("$90")).toBeInTheDocument();
    const prices = screen.getByRole("heading", { name: "Prices" }).closest("section")!;
    expect(within(prices).getByText("Class pack")).toBeInTheDocument();
    expect(within(prices).getByText("8 classes · valid 60 days")).toBeInTheDocument();
    expect(within(prices).getByText("$120")).toBeInTheDocument();
  });

  it("keeps the entity description and offers a retry when offerings fail to load", async () => {
    mockRpc({ offerings: { data: null, error: { message: "offline" } } });

    renderPage();

    expect(await screen.findByText("Community dance school")).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to load/i);

    mockRpc({ offerings: { data: offerings, error: null } });
    fireEvent.click(within(alert).getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: "Weekly classes" })).toBeInTheDocument();
  });

  it("renders nothing for a school without offerings", async () => {
    mockRpc({ offerings: { data: { classes: [], privates: [], plans: [] }, error: null } });

    renderPage();

    expect(await screen.findByText("Community dance school")).toBeInTheDocument();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("public_school_offerings", { p_slug: "ritmo-vivo" }));
    expect(screen.queryByRole("heading", { name: "Weekly classes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Prices" })).not.toBeInTheDocument();
  });
});

describe("claim control on public pages", () => {
  it("prompts signed-out visitors to sign in and return to the page", async () => {
    mockRpc({});

    renderPage();

    expect(await screen.findByText("Run this school?")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/signin");
    fireEvent.click(link);
    expect(returnDestination).toHaveBeenCalledWith("/s/ritmo-vivo");
  });

  it("asks instructors whether the profile is theirs", async () => {
    mockRpc({ detail: { ...detail, entity: { ...entity, kind: "instructor" } } });

    renderPage("instructor");

    expect(await screen.findByText("Is this you?")).toBeInTheDocument();
  });

  it("links members to their workspace", async () => {
    auth.user = { id: "user-1" };
    mockRpc({ memberships: [{ kind: "school", id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo", status: "active", city: "boston", image_url: null, member_role: "owner" }] });

    renderPage();

    expect(await screen.findByRole("link", { name: "Open your workspace" })).toHaveAttribute("href", "/host/schools/school-1");
  });

  it("shows the waiting state for a pending claim", async () => {
    auth.user = { id: "user-1" };
    mockRpc({ claims: [{ id: "claim-1", kind: "school", entity_id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo", relationship: "owner", status: "pending", review_note: null, created_at: "2026-10-01T00:00:00Z", reviewed_at: null }] });

    renderPage();

    expect(await screen.findByText("Your claim is waiting for review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim this/i })).not.toBeInTheDocument();
  });

  it("shows a rejection note and allows a new claim", async () => {
    auth.user = { id: "user-1" };
    mockRpc({ claims: [{ id: "claim-1", kind: "school", entity_id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo", relationship: "owner", status: "rejected", review_note: "Could not verify ownership", created_at: "2026-10-01T00:00:00Z", reviewed_at: "2026-10-02T00:00:00Z" }] });

    renderPage();

    expect(await screen.findByText(/could not verify ownership/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim this school" })).toBeInTheDocument();
  });

  it("submits relationship and message, then shows the waiting state", async () => {
    const user = userEvent.setup();
    auth.user = { id: "user-1" };
    mockRpc({});

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Claim this school" }));
    const dialog = screen.getByRole("dialog", { name: /claim ritmo vivo/i });
    expect(within(dialog).queryByRole("radio", { name: "This is me" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "I own it" })).toBeChecked();

    await user.click(within(dialog).getByRole("radio", { name: "I manage it" }));
    await user.type(within(dialog).getByLabelText(/message/i), "Front desk lead since 2019");
    await user.click(within(dialog).getByRole("button", { name: "Submit claim" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("entity_claim_submit", {
      p_kind: "school", p_id: "school-1", p_relationship: "manager", p_message: "Front desk lead since 2019",
    }));
    expect(await within(dialog).findByText("Your claim is waiting for review.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Submit claim" })).not.toBeInTheDocument();
  });

  it("shows the RPC error inline and keeps the form", async () => {
    const user = userEvent.setup();
    auth.user = { id: "user-1" };
    mockRpc({ claimSubmit: { data: null, error: { message: "You already have a pending claim" } } });

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Claim this school" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Submit claim" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("You already have a pending claim");
    expect(within(dialog).getByRole("button", { name: "Submit claim" })).toBeEnabled();
  });

  it("offers instructors only 'This is me' and 'I manage it', defaulting to self", async () => {
    const user = userEvent.setup();
    auth.user = { id: "user-1" };
    mockRpc({ detail: { ...detail, entity: { ...entity, kind: "instructor", slug: "ritmo-vivo" } } });

    renderPage("instructor");

    await user.click(await screen.findByRole("button", { name: "Claim this profile" }));
    const dialog = screen.getByRole("dialog");
    const radios = within(dialog).getAllByRole("radio").map((r) => (r as HTMLInputElement).value);
    expect(radios).toEqual(["self", "manager"]);
    expect(within(dialog).getByRole("radio", { name: "This is me" })).toBeChecked();
  });
});
