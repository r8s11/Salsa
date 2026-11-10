import { supabase } from "../../../lib/supabase";
import { WorkspaceAccessError } from "../../workspaces/api/workspacesRepo";
import type { ManagedKind } from "../../workspaces/model";
import type { AdminListingRequest, EventLinkCandidate, EventLinkKind, ListingRequest, ListingRequestStatus } from "../model";

/** RPC errors keep the server's message; 42501 becomes `WorkspaceAccessError`, as in workspacesRepo. */
export async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "42501") throw new WorkspaceAccessError(error.message);
    throw new Error(error.message);
  }
  return data as T;
}

export type MissingListingInput = {
  kind: ManagedKind;
  name: string;
  city: string;
  website: string;
  instagram: string;
  details: string;
  checkedExisting: boolean;
};

export function submitMissingListing(input: MissingListingInput): Promise<string> {
  return call<string>("listing_request_submit_missing", {
    p_kind: input.kind,
    p_name: input.name,
    p_city: input.city,
    p_website: input.website,
    p_instagram: input.instagram,
    p_details: input.details,
    p_checked_existing: input.checkedExisting,
  });
}

export function submitEventLinkRequest(kind: EventLinkKind, entityId: string, eventId: string, note: string): Promise<string> {
  return call<string>("listing_request_submit_event_link", { p_kind: kind, p_entity_id: entityId, p_event_id: eventId, p_note: note });
}

export function submitProfileChangeRequest(
  kind: ManagedKind,
  entityId: string,
  input: { requestedName: string; requestedCity: string; note: string },
): Promise<string> {
  return call<string>("listing_request_submit_profile_change", {
    p_kind: kind,
    p_entity_id: entityId,
    p_requested_name: input.requestedName,
    p_requested_city: input.requestedCity,
    p_note: input.note,
  });
}

/** Approved events not yet on that Artist/DJ, matched by title. */
export function fetchEventLinkCandidates(kind: EventLinkKind, entityId: string, query: string): Promise<EventLinkCandidate[]> {
  return call<EventLinkCandidate[]>("listing_request_event_candidates", { p_kind: kind, p_entity_id: entityId, p_query: query });
}

export function fetchMyListingRequests(): Promise<ListingRequest[]> {
  return call<ListingRequest[]>("my_listing_requests");
}

export function withdrawListingRequest(id: string): Promise<void> {
  return call<void>("listing_request_withdraw", { p_request_id: id });
}

/** `null` lists every request regardless of status; `scope` narrows to one listing. */
export function fetchAdminListingRequests(
  status: ListingRequestStatus | null,
  scope?: { kind: ManagedKind; id: string },
): Promise<AdminListingRequest[]> {
  return call<AdminListingRequest[]>("admin_listing_requests", {
    p_status: status,
    p_entity_kind: scope?.kind ?? null,
    p_entity_id: scope?.id ?? null,
  });
}

export function fetchPendingListingRequestCount(): Promise<number> {
  return call<number>("admin_pending_listing_request_count");
}

export async function reviewListingRequest(
  id: string,
  approve: boolean,
  note: string | null,
  resultingEntityId: string | null,
): Promise<void> {
  await call<unknown>("admin_review_listing_request", {
    p_request_id: id,
    p_approve: approve,
    p_note: note,
    p_resulting_entity_id: resultingEntityId,
  });
}
