import { Clock, CircleCheck, CircleX } from "lucide-react";
import type { ActionMenuItem } from "../../../components/Admin/AdminActionMenu";

/**
 * The request-level status vocabulary — distinct from both the event-status
 * and organizer-request vocabularies.
 */
export type FounderRequestStatus = "pending" | "approved" | "rejected";

/**
 * Rejection reason taxonomy — mirrors the DB CHECK constraint exactly.
 * Keep in sync with the DB CHECK constraint in 20260831000001_founder_access_requests.sql.
 */
export type FounderRejectionReasonCode =
  | "insufficient_information"
  | "unable_to_verify_organizer"
  | "account_activity_concerns"
  | "duplicate_organizer_brand"
  | "not_currently_eligible"
  | "other";

/**
 * A fully-enriched founder access request row — the shape the admin RPC returns.
 * Mirrors the DB schema from 20260831000001_founder_access_requests.sql.
 */
export interface FounderAccessRequestRow {
  id: string;
  applicant_name: string;
  email: string;
  normalized_email: string;
  organization_name: string;
  normalized_org_name: string;
  instagram: string | null;
  normalized_instagram: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  description: string | null;
  message: string | null;
  status: FounderRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason_code: string | null;
  rejection_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * View filter for the admin queue.
 */
export type FounderRequestView = "pending" | "approved" | "rejected" | "all";

/**
 * Filter state for the admin queue.
 */
export interface FounderRequestFilters {
  status: FounderRequestStatus | "all";
  search: string;
}

/**
 * Sort configuration for the admin queue.
 */
export interface FounderRequestSort {
  key: "requested" | "name" | "brand";
  dir: "asc" | "desc";
}

export type SortDir = "asc" | "desc";

/**
 * Row action types for the action menu.
 */
export type FounderRequestRowAction = "view" | "approve" | "reject";

/**
 * Status label mapping.
 */
export const FOUNDER_REQUEST_STATUS_LABEL: Record<FounderRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * Status icon mapping.
 */
export const FOUNDER_REQUEST_STATUS_ICON: Record<FounderRequestStatus, typeof Clock> = {
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
};

/**
 * Rejection reason label mapping (matches DB CHECK constraint).
 */
export const FOUNDER_REJECTION_REASON_LABEL: Record<FounderRejectionReasonCode, string> = {
  insufficient_information: "Insufficient information",
  unable_to_verify_organizer: "Unable to verify organizer",
  account_activity_concerns: "Account activity concerns",
  duplicate_organizer_brand: "Duplicate organizer brand",
  not_currently_eligible: "Not currently eligible",
  other: "Other",
};

/**
 * View options for the filter UI.
 */
export const FOUNDER_REQUEST_VIEWS: { view: FounderRequestView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "approved", label: "Approved" },
  { view: "rejected", label: "Rejected" },
  { view: "all", label: "All" },
];

/**
 * Sort options for the admin queue.
 */
export const FOUNDER_REQUEST_SORT_OPTIONS: {
  key: FounderRequestSort["key"];
  label: string;
}[] = [
  { key: "requested", label: "Date submitted" },
  { key: "name", label: "Applicant name" },
  { key: "brand", label: "Organization name" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Returns the action menu items for a single founder request.
 */
export function founderRequestActionItems(
  request: FounderAccessRequestRow,
  onAction: (action: FounderRequestRowAction, request: FounderAccessRequestRow) => void
): ActionMenuItem[] {
  const items: ActionMenuItem[] = [
    {
      id: "view",
      label: "View Details",
      onSelect: () => onAction("view", request),
    },
  ];

  // Only admins see approve/reject actions
  // The component will check isAdmin before adding these
  if (request.status === "pending") {
    items.push(
      {
        id: "approve",
        label: "Approve",
        onSelect: () => onAction("approve", request),
        tone: "default",
      },
      {
        id: "reject",
        label: "Reject",
        onSelect: () => onAction("reject", request),
        tone: "danger",
      }
    );
  }

  return items;
}

/**
 * Client-side view filter.
 */
export function applyFounderRequestView(
  requests: FounderAccessRequestRow[],
  view: FounderRequestView
): FounderAccessRequestRow[] {
  if (view === "all") return requests;
  return requests.filter((r) => r.status === view);
}

/**
 * Client-side filters (search + status).
 */
export function applyFounderRequestFilters(
  requests: FounderAccessRequestRow[],
  filters: FounderRequestFilters
): FounderAccessRequestRow[] {
  return requests.filter((r) => {
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [
        r.applicant_name,
        r.email,
        r.organization_name,
        r.city,
        r.region,
        r.description ?? "",
        r.message ?? "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Client-side sort.
 */
export function applyFounderRequestSort(
  requests: FounderAccessRequestRow[],
  sort: FounderRequestSort
): FounderAccessRequestRow[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    switch (sort.key) {
      case "requested":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case "name":
        aVal = a.applicant_name.toLowerCase();
        bVal = b.applicant_name.toLowerCase();
        break;
      case "brand":
        aVal = a.organization_name.toLowerCase();
        bVal = b.organization_name.toLowerCase();
        break;
      default:
        return 0;
    }
    return aVal < bVal ? -dir : aVal > bVal ? dir : 0;
  });
}

/**
 * View counts for filter badges.
 */
export function founderRequestViewCounts(
  requests: FounderAccessRequestRow[]
): Record<FounderRequestView, number> {
  return {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  };
}

/**
 * Payload for the review RPC.
 */
export interface ReviewFounderRequestPayload {
  requestId: string;
  decision: "approve" | "reject";
  reasonCode?: string;
  message?: string;
}

/**
 * Response from the review RPC.
 */
export interface ReviewFounderRequestResponse {
  success: boolean;
  status: "approved" | "rejected";
}

/**
 * Status badge component mapping (reuses AdminStatusBadge).
 */
export function getFounderRequestStatusBadge(status: FounderRequestStatus): {
  label: string;
  variant: "default" | "success" | "destructive" | "warning";
} {
  switch (status) {
    case "pending":
      return { label: "Pending", variant: "warning" };
    case "approved":
      return { label: "Approved", variant: "success" };
    case "rejected":
      return { label: "Rejected", variant: "destructive" };
  }
}