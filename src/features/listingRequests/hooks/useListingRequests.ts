import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManagedKind } from "../../workspaces/model";
import {
  fetchEventLinkCandidates,
  fetchMyListingRequests,
  submitEventLinkRequest,
  submitMissingListing,
  submitProfileChangeRequest,
  withdrawListingRequest,
  type MissingListingInput,
} from "../api/listingRequestsRepo";
import type { EventLinkKind } from "../model";

export const MY_LISTING_REQUESTS_KEY = "my-listing-requests";
export const EVENT_LINK_CANDIDATES_KEY = "listing-request-event-candidates";

/** The caller's own requests, newest first. */
export function useMyListingRequests() {
  return useQuery({
    queryKey: [MY_LISTING_REQUESTS_KEY],
    queryFn: fetchMyListingRequests,
    staleTime: 30_000,
  });
}

function useRefreshMyRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [MY_LISTING_REQUESTS_KEY] });
}

export function useSubmitMissingListing() {
  const refresh = useRefreshMyRequests();
  return useMutation({ mutationFn: (input: MissingListingInput) => submitMissingListing(input), onSuccess: refresh });
}

export function useSubmitEventLinkRequest() {
  const refresh = useRefreshMyRequests();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: EventLinkKind; entityId: string; eventId: string; note: string }) =>
      submitEventLinkRequest(input.kind, input.entityId, input.eventId, input.note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EVENT_LINK_CANDIDATES_KEY] });
      return refresh();
    },
  });
}

export function useSubmitProfileChangeRequest() {
  const refresh = useRefreshMyRequests();
  return useMutation({
    mutationFn: (input: { kind: ManagedKind; entityId: string; requestedName: string; requestedCity: string; note: string }) =>
      submitProfileChangeRequest(input.kind, input.entityId, input),
    onSuccess: refresh,
  });
}

export function useWithdrawListingRequest() {
  const refresh = useRefreshMyRequests();
  return useMutation({ mutationFn: (id: string) => withdrawListingRequest(id), onSuccess: refresh });
}

/** Event search for a link request; waits for two typed characters. */
export function useEventLinkCandidates(kind: EventLinkKind, entityId: string, query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: [EVENT_LINK_CANDIDATES_KEY, kind, entityId, term],
    queryFn: () => fetchEventLinkCandidates(kind, entityId, term),
    enabled: term.length >= 2,
    retry: false,
    staleTime: 30_000,
  });
}
