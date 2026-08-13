import { Clock, CircleCheck, CircleX } from "lucide-react";
import type { ComponentType } from "react";
import type { AccountStatus, UserRole } from "./usersQuery";
import type { ActionMenuItem } from "../../../components/Admin/AdminActionMenu";

/**
 * The request-level status vocabulary — distinct from both the event-status
 * vocabulary (`approved`/`pending`/...) and the account-status vocabulary.
 * Prefixed in the CSS class name as `request-pending` / `request-approved`
 * / `request-rejected` so it never collides with `.admin-status--pending` etc.
 */
export type RequestStatus = "pending" | "approved" | "rejected";

export type OrganizerType =
  | "promoter"
  | "dance-studio"
  | "dj"
  | "venue"
  | "dance-company"
  | "festival"
  | "independent"
  | "other";

export type RejectionReasonCode =
  | "insufficient_information"
  | "unable_to_verify_organizer"
  | "account_activity_concerns"
  | "duplicate_organizer_brand"
  | "not_currently_eligible"
  | "other";

/**
 * A fully-enriched organizer request row — the shape the admin RPC
 * returns (one row per request, joined with the applicant profile + the
 * existing organizer row when `proposed_organizer_id` is set).
 * Mirrors the `AdminUserRow` enrichment pattern from `admin_user_directory()`.
 */
export interface OrganizerRequestRow {
  /** organizer_requests.id */
  id: string;
  /** The applicant's profile / guest identity (same shape AdminUserRow uses) */
  applicant_id: string; // profiles.id
  applicant_kind: "profile" | "guest";
  applicant_user_id: string | null; // null for guests
  applicant_email: string;
  applicant_display_name: string | null;
  applicant_username: string | null;
  applicant_avatar_url: string | null;
  applicant_role: UserRole | null;
  applicant_status: AccountStatus;
  applicant_status_reason: string | null;
  applicant_created_at: string; // member since / first activity
  applicant_email_confirmed_at: string | null;
  applicant_contributions: number; // events submitted (by this user)
  applicant_approved_count: number; // events approved
  applicant_pending_count: number; // events pending review

  /** The organizer brand being requested */
  proposed_organizer_id: string | null; // null = new brand
  proposed_name: string | null;
  organizer_type: OrganizerType | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  primary_city: string | null;

  /** The applicant's own explanation */
  request_message: string | null;

  status: RequestStatus;
  reviewed_by: string | null; // profiles.id of the admin
  reviewed_at: string | null;
  rejection_reason_code: RejectionReasonCode | null;
  rejection_message: string | null;

  created_at: string;
  updated_at: string;
}

export type RequestView = "pending" | "approved" | "rejected" | "all";

export interface RequestFilters {
  q: string;
  type: OrganizerType[];
  accountStatus: AccountStatus[];
  from: string | null; // yyyy-mm-dd, against created_at
  to: string | null;
}

export interface RequestSort {
  key: "requested" | "name" | "brand";
  dir: "asc" | "desc";
}

export type SortDir = "asc" | "desc";

// ---- Labels (mirrors ROLE_LABEL / ACCOUNT_STATUS_LABEL vocabulary) ----

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const REQUEST_STATUS_ICON: Record<RequestStatus, ComponentType<{ size?: number }>> = {
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
};

export const ORGANIZER_TYPE_LABEL: Record<OrganizerType, string> = {
  promoter: "Promoter",
  "dance-studio": "Dance Studio",
  dj: "DJ",
  venue: "Venue",
  "dance-company": "Dance Company",
  festival: "Festival / Event Brand",
  independent: "Independent Organizer",
  other: "Other",
};

// The brief's §4 rejection reason taxonomy, as machine values + labels.
// Kept here (not in the dialog) so the model is the single source of truth.
export const REJECTION_REASON_LABEL: Record<RejectionReasonCode, string> = {
  insufficient_information: "Insufficient Information",
  unable_to_verify_organizer: "Unable to Verify Organizer",
  account_activity_concerns: "Account Activity Concerns",
  duplicate_organizer_brand: "Duplicate Organizer / Brand",
  not_currently_eligible: "Not Currently Eligible",
  other: "Other",
};

export const REQUEST_VIEWS: { view: RequestView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "approved", label: "Approved" },
  { view: "rejected", label: "Rejected" },
  { view: "all", label: "All Requests" },
];

export const REQUEST_SORT_OPTIONS: { value: string; key: "requested" | "name" | "brand"; dir: SortDir; label: string }[] = [
  { value: "requested-desc", key: "requested", dir: "desc", label: "Newest" },
  { value: "requested-asc", key: "requested", dir: "asc", label: "Oldest" },
  { value: "name-asc", key: "name", dir: "asc", label: "Applicant Name" },
  { value: "brand-asc", key: "brand", dir: "asc", label: "Brand Name" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// ---- Request action matrix ----

export type RequestRowAction = "view" | "approve" | "reject" | "revoke";

/**
 * Returns the row-action / header-menu items for a single organizer request,
 * keyed on the request status and the applicant's account status — identical
 * shape to Phase 5/6's `rowActionItems` in `eventsQuery.ts` / `usersQuery.ts`.
 *
 * Quick-approve (no confirmation dialog) is only offered for *pending* requests
 * from *active* accounts — the 90% case the brief optimizes for. Flagged /
 * suspended / banned applicants always go through the confirmation step so the
 * approver must acknowledge the moderation concern.
 */
export function requestActionItems(
  request: OrganizerRequestRow,
  onAction: (action: RequestRowAction, request: OrganizerRequestRow) => void
): ActionMenuItem[] {
  const view: ActionMenuItem = {
    id: "view",
    label: "View",
    onSelect: () => onAction("view", request),
  };

  const revoke: ActionMenuItem = {
    id: "revoke",
    label: "Revoke Organizer Access",
    separatorBefore: true,
    tone: "danger",
    onSelect: () => onAction("revoke", request),
  };

  // Pending — decide.
  const approve: ActionMenuItem = {
    id: "approve",
    label: "Approve",
    separatorBefore: true,
    onSelect: () => onAction("approve", request),
  };
  const reject: ActionMenuItem = {
    id: "reject",
    label: "Reject",
    onSelect: () => onAction("reject", request),
  };

  switch (request.status) {
    case "pending":
      // Flagged/suspended/banned accounts always confirm (warning is surfaced
      // inside the approval dialog body — see §8 of the design doc).
      if (request.applicant_status !== "active") {
        return [view, reject, approve];
      }
      return [view, reject, approve];
    case "approved":
      return [view, revoke];
    case "rejected":
      return [view];
  }
}

// ---- View / filter / sort application (client-side, same shape as Phase 5/6) ----

export function applyRequestView(requests: OrganizerRequestRow[], view: RequestView): OrganizerRequestRow[] {
  switch (view) {
    case "pending":
      return requests.filter((r) => r.status === "pending");
    case "approved":
      return requests.filter((r) => r.status === "approved");
    case "rejected":
      return requests.filter((r) => r.status === "rejected");
    case "all":
      return requests;
  }
}

export function applyRequestFilters(requests: OrganizerRequestRow[], filters: RequestFilters): OrganizerRequestRow[] {
  const q = filters.q.trim().toLowerCase();
  return requests.filter((request) => {
    if (q) {
      const haystack = [
        request.applicant_display_name,
        request.applicant_username,
        request.applicant_email,
        request.proposed_name,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.type.length > 0 && (request.organizer_type === null || !filters.type.includes(request.organizer_type)))
      return false;
    if (filters.accountStatus.length > 0 && !filters.accountStatus.includes(request.applicant_status)) return false;
    if (filters.from || filters.to) {
      const d = request.created_at.slice(0, 10);
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
    }
    return true;
  });
}

export function applyRequestSort(
  requests: OrganizerRequestRow[],
  key: "requested" | "name" | "brand",
  dir: SortDir
): OrganizerRequestRow[] {
  const indexed = requests.map((request, index) => ({ request, index }));
  indexed.sort((a, b) => {
    const cmp =
      key === "requested"
        ? Date.parse(a.request.created_at) - Date.parse(b.request.created_at)
        : key === "name"
          ? (a.request.applicant_display_name ?? "").localeCompare(
              b.request.applicant_display_name ?? "",
              undefined,
              { sensitivity: "base" }
            )
          : (a.request.proposed_name ?? "").localeCompare(b.request.proposed_name ?? "", undefined, {
              sensitivity: "base",
            });
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.index - b.index;
  });
  return indexed.map(({ request }) => request);
}

export function requestViewCounts(requests: OrganizerRequestRow[]): Record<RequestView, number> {
  const counts = {} as Record<RequestView, number>;
  (["pending", "approved", "rejected", "all"] as RequestView[]).forEach((view) => {
    counts[view] = applyRequestView(requests, view).length;
  });
  return counts;
}
