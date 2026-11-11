import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import MyClaimsPage from "./MyClaimsPage";
import type { EntityClaim } from "../model";
import { MY_ENTITY_MEMBERSHIPS_KEY } from "../hooks/useMyEntityMemberships";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
const claim = (overrides: Partial<EntityClaim> = {}): EntityClaim => ({ id: "c1", kind: "school", entity_id: "school-1", name: "Ritmo", slug: "ritmo", relationship: "owner", status: "pending", review_note: null, created_at: "2026-11-01T00:00:00Z", reviewed_at: null, listing_status: "active", workspace_role: null, ...overrides });
let claims: EntityClaim[];
beforeEach(() => {
 claims = [];
 rpc.mockReset();
 rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "my_entity_claims" ? claims : [], error: null }));
});
function show(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
 return render(<QueryClientProvider client={client}><MemoryRouter><MyClaimsPage /></MemoryRouter></QueryClientProvider>);
}
it("groups returned claims and renders literal long decision notes", async () => {
 const note = "<b>x</b>" + "z".repeat(1992);
 claims = [claim(), claim({ id: "c2", entity_id: "s2", name: "Casa", slug: "casa", status: "rejected", review_note: note }), claim({ id: "c3", name: "Withdrawn school", status: "withdrawn", review_note: "Never display" })];
 show();
 expect(screen.getByRole("status")).toBeInTheDocument();
 expect(await screen.findByRole("heading", { name: "Decided" })).toBeInTheDocument();
 expect(screen.getByRole("heading", { name: "Waiting for review" })).toBeInTheDocument();
 expect(screen.getByText(note)).toBeInTheDocument();
 expect(screen.queryByText("Never display")).not.toBeInTheDocument();
 expect(screen.getAllByRole("listitem")).toHaveLength(3);
 expect(screen.getByRole("link", { name: "Casa" })).toHaveAttribute("href", "/s/casa");
 expect(screen.getByRole("link", { name: "View listing to claim again" })).toHaveAttribute("href", "/s/casa");
 expect(document.body.textContent).not.toMatch(/email|within|business day|hours/i);
});
it("waits for refreshed membership before offering workspace access", async () => {
 claims = [claim({ status: "approved", workspace_role: "owner" })];
 let release!: (value: unknown) => void;
 rpc.mockImplementation((name: string) => name === "my_entity_claims" ? Promise.resolve({ data: claims, error: null }) : new Promise((resolve) => { release = resolve; }));
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 client.setQueryData([MY_ENTITY_MEMBERSHIPS_KEY, "user-1"], []);
 show(client);
 await waitFor(() => expect(release).toBeDefined());
 expect(screen.queryByRole("link", { name: "Open workspace" })).not.toBeInTheDocument();
 release({ data: [{ kind: "school", id: "school-1", member_role: "owner" }], error: null });
 expect(await screen.findByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/host/schools/school-1");
 expect(client.getQueryData([MY_ENTITY_MEMBERSHIPS_KEY, "user-1"])).toEqual([{ kind: "school", id: "school-1", member_role: "owner" }]);
});
it("shows an empty state with discovery action", async () => {
 show();
 expect(await screen.findByText("You haven't claimed any listings yet.")).toBeInTheDocument();
 expect(screen.getByRole("link", { name: "Browse listings" })).toHaveAttribute("href", "/discover");
});
it.each(["my_entity_claims", "my_entity_memberships"])("retries a failed %s refresh instead of showing stale actions", async (failed) => {
 const user = userEvent.setup();
 rpc.mockImplementation((name: string) => Promise.resolve({ data: null, error: name === failed ? { message: "Unavailable" } : null }));
 show();
 const alert = await screen.findByRole("alert");
 expect(alert).toHaveTextContent("We couldn't load your claims.");
 claims = [claim()];
 rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "my_entity_claims" ? claims : [], error: null }));
 await user.click(within(alert).getByRole("button", { name: "Try again" }));
 expect(await screen.findByRole("link", { name: "Ritmo" })).toBeInTheDocument();
});
