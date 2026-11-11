import { publicEntityPath, workspacePath, type EntityClaim } from "./model";

export type ClaimInboxAction = { kind: "open_workspace" | "view_listing"; label: string; to: string };
export type ClaimInboxItem = {
  claim: EntityClaim;
  section: "open" | "decided";
  stateLabel: "Waiting for review" | "Approved" | "Not approved" | "Withdrawn" | "Listing archived";
  summary: string;
  note: string | null;
  action: ClaimInboxAction | null;
};

/** RPC order is newest first. Newer live claims suppress obsolete actions. */
export function buildClaimInbox(claims: EntityClaim[]): ClaimInboxItem[] {
  const superseded = new Set<string>();
  return claims.map((claim) => {
    const key = `${claim.kind}:${claim.entity_id}`;
    const blocked = superseded.has(key);
    if (claim.status === "pending" || (claim.status === "approved" && claim.workspace_role !== null)) superseded.add(key);
    const item: ClaimInboxItem = {
      claim, section: claim.status === "pending" ? "open" : "decided",
      stateLabel: "Waiting for review", summary: "Our team is reviewing this claim. You don't need to do anything yet.",
      note: claim.status === "approved" || claim.status === "rejected" ? claim.review_note?.trim() || null : null,
      action: null,
    };
    if (claim.status === "approved") {
      item.stateLabel = "Approved";
      item.summary = claim.workspace_role !== null ? `You can now manage ${claim.name}.` : `Your access to ${claim.name} has changed since this was approved.`;
      item.action = claim.workspace_role !== null
        ? { kind: "open_workspace", label: "Open workspace", to: workspacePath(claim.kind, claim.entity_id) }
        : { kind: "view_listing", label: "View listing to claim again", to: publicEntityPath(claim.kind, claim.slug) };
    } else if (claim.status === "rejected") {
      item.stateLabel = "Not approved";
      item.summary = "This claim wasn't approved.";
      item.action = { kind: "view_listing", label: "View listing to claim again", to: publicEntityPath(claim.kind, claim.slug) };
    } else if (claim.status === "withdrawn") {
      item.stateLabel = "Withdrawn";
      item.summary = "This claim was withdrawn.";
    }
    if (blocked) item.action = null;
    if (claim.listing_status === "archived") {
      item.stateLabel = "Listing archived";
      item.summary = `${claim.name} is no longer listed.`;
      item.action = null;
    }
    return item;
  });
}
