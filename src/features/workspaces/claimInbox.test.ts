import { describe, expect, it } from "vitest";
import { buildClaimInbox } from "./claimInbox";
import { publicEntityPath, type EntityClaim } from "./model";

function claim(overrides: Partial<EntityClaim> = {}): EntityClaim {
  return { id: "claim-1", kind: "school", entity_id: "school-1", name: "Ritmo Vivo", slug: "ritmo-vivo", relationship: "owner", status: "pending", review_note: null, created_at: "2026-11-01T00:00:00Z", reviewed_at: null, listing_status: "active", workspace_role: null, ...overrides };
}
describe("buildClaimInbox", () => {
  it("keeps pending claims open without action or notes", () => {
    const [item] = buildClaimInbox([claim({ review_note: "Not a decision" })]);
    expect(item).toMatchObject({ section: "open", stateLabel: "Waiting for review", action: null, note: null });
    expect(item.summary).not.toMatch(/email|day|hour|within/i);
  });
  it("opens the actual workspace only with access", () => {
    expect(buildClaimInbox([claim({ status: "approved", workspace_role: "owner" })])[0].action).toEqual({ kind: "open_workspace", label: "Open workspace", to: "/host/schools/school-1" });
    const [removed] = buildClaimInbox([claim({ status: "approved" })]);
    expect(removed.action).toMatchObject({ kind: "view_listing", to: "/s/ritmo-vivo" });
    expect(removed.summary).toMatch(/access.*changed/i);
  });
  it("trims decision notes and permits rejected claimants to try again", () => {
    const [item] = buildClaimInbox([claim({ status: "rejected", review_note: "  Please verify ownership  " })]);
    expect(item.note).toBe("Please verify ownership");
    expect(item.action).toEqual({ kind: "view_listing", label: "View listing to claim again", to: "/s/ritmo-vivo" });
    expect(buildClaimInbox([claim({ status: "rejected", review_note: "  " })])[0].note).toBeNull();
    expect(buildClaimInbox([claim({ status: "approved", workspace_role: "owner", review_note: "Approved note" })])[0].note).toBe("Approved note");
  });
  it.each(["pending", "approved"] as const)("suppresses old rejection actions behind newer %s claims", (status) => {
    const items = buildClaimInbox([claim({ id: "new", status, workspace_role: status === "approved" ? "owner" : null }), claim({ status: "rejected" })]);
    expect(items[1].action).toBeNull();
    expect(items.map(({ claim: c }) => c.id)).toEqual(["new", "claim-1"]);
  });
  it.each(["pending", "approved", "rejected"] as const)("blocks all actions for archived %s claims", (status) => {
    expect(buildClaimInbox([claim({ status, workspace_role: "owner", listing_status: "archived" })])[0]).toMatchObject({ stateLabel: "Listing archived", action: null });
  });
  it("does not show notes for withdrawn claims", () => {
    expect(buildClaimInbox([claim({ status: "withdrawn", review_note: "Hidden" })])[0]).toMatchObject({ stateLabel: "Withdrawn", note: null, action: null, section: "decided" });
  });
  it("does not suppress actions for different listings or removed approvals", () => {
    expect(buildClaimInbox([claim({ entity_id: "another" }), claim({ status: "rejected" })])[1].action).not.toBeNull();
    expect(buildClaimInbox([claim({ status: "approved" }), claim({ status: "rejected" })])[1].action).not.toBeNull();
  });
  it("uses public artist and DJ paths", () => {
    expect(publicEntityPath("instructor", "ana")).toBe("/i/ana");
    expect(publicEntityPath("dj", "ana")).toBe("/dj/ana");
    expect(publicEntityPath("venue", "casa")).toBe("/v/casa");
  });
});
