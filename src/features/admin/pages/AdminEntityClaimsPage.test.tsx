import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEntityClaimsPage from "./AdminEntityClaimsPage";
import type { AdminEntityClaim } from "../../workspaces/model";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

function claim(overrides: Partial<AdminEntityClaim> = {}): AdminEntityClaim {
  return {
    id: "claim-1",
    kind: "school",
    entity_id: "school-1",
    entity_name: "Ritmo Vivo Dance",
    entity_slug: "ritmo-vivo",
    entity_city: "boston",
    entity_status: "active",
    user_id: "user-1",
    email: "ana@example.com",
    display_name: "Ana Reyes",
    relationship: "owner",
    message: "I run the front desk.",
    status: "pending",
    review_note: null,
    reviewed_at: null,
    created_at: "2026-10-01T15:00:00.000Z",
    active_owner_count: 0,
    ...overrides,
  };
}

let claims: AdminEntityClaim[] = [];
let reviewResult: { member_role: "owner" | "manager" } = { member_role: "owner" };

function installRpc() {
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "admin_entity_claims") return { data: claims, error: null };
    if (fn === "admin_review_entity_claim") {
      const target = claims.find((c) => c.id === args.p_claim_id);
      if (target) {
        claims = claims.map((c) =>
          c.id === target.id
            ? { ...c, status: args.p_approve ? "approved" : "rejected", review_note: (args.p_note as string | null) ?? null }
            : c,
        );
      }
      return { data: reviewResult, error: null };
    }
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminEntityClaimsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminEntityClaimsPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    reviewResult = { member_role: "owner" };
    claims = [
      claim(),
      claim({
        id: "claim-2",
        kind: "venue",
        entity_id: "venue-1",
        entity_name: "Havana Room",
        entity_slug: "havana-room",
        entity_city: null,
        email: "luis@example.com",
        display_name: null,
        relationship: "manager",
        message: null,
      }),
    ];
    installRpc();
  });

  it("lists pending claims with the listing, claimant and links", async () => {
    renderPage();

    const school = await screen.findByRole("heading", { name: "Ritmo Vivo Dance" });
    expect(within(school).getByRole("link")).toHaveAttribute("href", "/s/ritmo-vivo");
    expect(screen.getByText("Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("I run the front desk.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin record for Ritmo Vivo Dance" })).toHaveAttribute(
      "href",
      "/admin/schools/school-1",
    );
    expect(screen.getByRole("link", { name: "Admin record for Havana Room" })).toHaveAttribute(
      "href",
      "/admin/venues/venue-1",
    );
    expect(rpc).toHaveBeenCalledWith("admin_entity_claims", { p_status: null });
  });

  it("approves without a dialog and the row leaves the pending galley", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Approve Ana Reyes's claim on Ritmo Vivo Dance" }));

    expect(rpc).toHaveBeenCalledWith("admin_review_entity_claim", {
      p_claim_id: "claim-1",
      p_approve: true,
      p_note: null,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Ritmo Vivo Dance" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Havana Room" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Approved Ana Reyes for Ritmo Vivo Dance. They are now an owner.");
  });

  it("rejects through a dialog and passes the optional note", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reject Ana Reyes's claim on Ritmo Vivo Dance" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Note (optional)"), "Could not verify");
    await user.click(within(dialog).getByRole("button", { name: "Reject claim" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_entity_claim", {
        p_claim_id: "claim-1",
        p_approve: false,
        p_note: "Could not verify",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Ritmo Vivo Dance" })).not.toBeInTheDocument(),
    );
  });

  it("rejects with a null note when none is typed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reject luis@example.com's claim on Havana Room" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reject claim" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_entity_claim", {
        p_claim_id: "claim-2",
        p_approve: false,
        p_note: null,
      }),
    );
  });

  it("warns when the listing already has an owner", async () => {
    claims = [claim({ active_owner_count: 1 })];
    renderPage();

    expect(
      await screen.findByText("Already has an owner — approving makes them a manager"),
    ).toBeInTheDocument();
  });

  it("does not warn when the listing has no owner", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Ritmo Vivo Dance" });
    expect(screen.queryByText(/Already has an owner/)).not.toBeInTheDocument();
  });

  it("shows decided claims on their own tab", async () => {
    const user = userEvent.setup();
    claims = [claim({ status: "rejected", review_note: "Duplicate request", reviewed_at: "2026-10-02T12:00:00.000Z" })];
    renderPage();

    expect(await screen.findByText(/Galley is clear/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Rejected/ }));

    expect(await screen.findByRole("heading", { name: "Ritmo Vivo Dance" })).toBeInTheDocument();
    expect(screen.getByText("Duplicate request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });

  it("keeps the row and shows the database message when approval fails", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Ritmo Vivo Dance" });
    rpc.mockImplementation(async (fn: string) =>
      fn === "admin_review_entity_claim"
        ? { data: null, error: { message: "This claim was already decided.", code: "23514" } }
        : { data: claims, error: null },
    );

    await user.click(screen.getByRole("button", { name: "Approve Ana Reyes's claim on Ritmo Vivo Dance" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This claim was already decided.");
    expect(screen.getByRole("heading", { name: "Ritmo Vivo Dance" })).toBeInTheDocument();
  });

  it("offers a retry when the claims fail to load", async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load listing claims.");

    installRpc();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Ritmo Vivo Dance" })).toBeInTheDocument();
  });
});
