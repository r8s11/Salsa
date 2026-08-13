import { Clock, CircleCheck, CircleX } from "lucide-react";
import type { ComponentType } from "react";
import type { ActionMenuItem } from "../../../components/Admin/AdminActionMenu";

/**
 * Venue lifecycle status — only three values (brief §4).
 * Distinct from event status and organizer-request status.
 * CSS class prefix: `venue-active` / `venue-review` / `venue-archived`
 * (lives as modifier on .admin-status, never colliding with .admin-status--pending etc.)
 */
export type VenueStatus = "active" | "needs_review" | "archived";

export interface VenueRow {
  id: string;
  name: string;
  slug: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  status: VenueStatus;
  upcoming_count: number;
  quality_issues: VenueQualityIssue[];
  updated_at: string;
  created_at: string;
}

/**
 * Extended venue row for the detail page — includes quality flags
 * and aggregate stats computed by the admin_venue_detail RPC.
 */
export interface VenueDetailRow extends VenueRow {
  quality_issues: VenueQualityIssue[];
}

export type VenueQualityIssue =
  | "missing_address"
  | "missing_coordinates"
  | "possible_duplicate"
  | "no_timezone"
  | "invalid_website";

export type VenueView = "all" | "active" | "upcoming" | "needs_review" | "archived";

export interface VenueFilters {
  q: string;
  city: string[];
  state: string[];
  status: VenueStatus[];
  has_upcoming: boolean | null;
}

export interface VenueSort {
  key: "name" | "city" | "upcoming" | "updated";
  dir: "asc" | "desc";
}

export type SortDir = "asc" | "desc";

// ---- Labels (mirrors REQUEST_STATUS_LABEL / ACCOUNT_STATUS_LABEL vocabulary) ----

export const VENUE_STATUS_LABEL: Record<VenueStatus, string> = {
  active: "Active",
  needs_review: "Needs Review",
  archived: "Archived",
};

export const VENUE_STATUS_ICON: Record<VenueStatus, ComponentType<{ size?: number }>> = {
  active: CircleCheck,
  needs_review: Clock,
  archived: CircleX,
};

export const VENUE_QUALITY_ISSUE_LABEL: Record<VenueQualityIssue, string> = {
  missing_address: "Missing address",
  missing_coordinates: "Missing coordinates",
  possible_duplicate: "Possible duplicate",
  no_timezone: "No timezone",
  invalid_website: "Invalid website",
};

export const VENUE_VIEWS: { view: VenueView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "active", label: "Active" },
  { view: "upcoming", label: "With Upcoming Events" },
  { view: "needs_review", label: "Needs Review" },
  { view: "archived", label: "Archived" },
];

export const VENUE_SORT_OPTIONS: { value: string; key: VenueSort["key"]; dir: SortDir; label: string }[] = [
  { value: "name-asc", key: "name", dir: "asc", label: "Name A–Z" },
  { value: "name-desc", key: "name", dir: "desc", label: "Name Z–A" },
  { value: "city-asc", key: "city", dir: "asc", label: "City A–Z" },
  { value: "upcoming-desc", key: "upcoming", dir: "desc", label: "Most Upcoming Events" },
  { value: "updated-desc", key: "updated", dir: "desc", label: "Recently Updated" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "MX", label: "Mexico" },
  { value: "ES", label: "Spain" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands" },
  { value: "BR", label: "Brazil" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "IT", label: "Italy" },
  { value: "PR", label: "Puerto Rico" },
] as const;

// ---- Form ----

export interface VenueForm {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  country: string;
  website: string;
  instagram: string;
  phone: string;
  timezone: string; // read-only, inferred; "Override" link allows editing
}

export function buildEmptyVenueForm(): VenueForm {
  return {
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state_region: "",
    postal_code: "",
    country: "US",
    website: "",
    instagram: "",
    phone: "",
    timezone: "",
  };
}

export function buildVenueFormFromRow(row: VenueDetailRow): VenueForm {
  return {
    name: row.name,
    address_line1: row.address_line1 ?? "",
    address_line2: row.address_line2 ?? "",
    city: row.city ?? "",
    state_region: row.state_region ?? "",
    postal_code: row.postal_code ?? "",
    country: row.country ?? "US",
    website: row.website ?? "",
    instagram: row.instagram ?? "",
    phone: row.phone ?? "",
    timezone: row.timezone ?? "",
  };
}

export function venueFormToPayload(form: VenueForm): Partial<VenueRow> {
  return {
    name: form.name.trim(),
    address_line1: form.address_line1.trim() || null,
    address_line2: form.address_line2.trim() || null,
    city: form.city.trim() || null,
    state_region: form.state_region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country: form.country || null,
    website: form.website.trim() || null,
    instagram: form.instagram.trim() || null,
    phone: form.phone.trim() || null,
    timezone: form.timezone.trim() || null,
  };
}

export function validateVenueForm(form: VenueForm): string | null {
  if (!form.name.trim()) return "Venue name is required.";
  if (!form.address_line1.trim()) return "Address is required.";
  if (!form.city.trim()) return "City is required.";
  if (!form.state_region.trim()) return "State / region is required.";
  if (!form.country.trim()) return "Country is required.";
  if (form.website && !/^https?:\/\/\S+$/.test(form.website)) {
    return "Website must be a valid HTTP or HTTPS URL.";
  }
  return null;
}

export function venueDisplayAddress(row: VenueRow): string {
  const parts = [row.address_line1, row.address_line2, row.city, row.state_region, row.postal_code, row.country]
    .filter((part) => part != null && part.trim() !== "");
  return parts.join(", ");
}

export function venueQualityIssues(row: VenueDetailRow | null): VenueQualityIssue[] {
  if (!row) return [];
  const issues: VenueQualityIssue[] = [];
  if (!row.address_line1?.trim()) issues.push("missing_address");
  if (row.latitude == null || row.longitude == null) issues.push("missing_coordinates");
  if (row.quality_issues?.includes("possible_duplicate")) issues.push("possible_duplicate");
  if (!row.timezone?.trim()) issues.push("no_timezone");
  if (row.website && !/^https?:\/\/\S+$/.test(row.website)) issues.push("invalid_website");
  return issues;
}

// ---- Action matrix ----

export type VenueAction = "view" | "edit" | "archive" | "restore" | "delete" | "merge";

/**
 * Returns the row-action menu items for a single venue.
 * Mirrors requestActionItems() in organizerRequestsQuery.ts.
 *
 * Archive is always available for active / needs_review venues.
 * Delete is only available when safe (no upcoming events) — the page
 * enforces this via AdminConfirmDialog's guard message.
 * Merge is only available for active/needs_review venues.
 */
export function venueActionItems(
  venue: VenueRow,
  onAction: (action: VenueAction, venue: VenueRow) => void
): ActionMenuItem[] {
  const view: ActionMenuItem = {
    id: "view",
    label: "View",
    onSelect: () => onAction("view", venue),
  };
  const edit: ActionMenuItem = {
    id: "edit",
    label: "Edit",
    onSelect: () => onAction("edit", venue),
  };
  const archive: ActionMenuItem = {
    id: "archive",
    label: "Archive",
    separatorBefore: true,
    onSelect: () => onAction("archive", venue),
  };
  const merge: ActionMenuItem = {
    id: "merge",
    label: "Merge with another venue",
    separatorBefore: true,
    tone: "danger",
    onSelect: () => onAction("merge", venue),
  };

  switch (venue.status) {
    case "active":
    case "needs_review":
      return [view, edit, merge, archive];
    case "archived": {
      const restore: ActionMenuItem = {
        id: "restore",
        label: "Restore to Active",
        separatorBefore: true,
        onSelect: () => onAction("restore", venue),
      };
      return [view, edit, restore];
    }
  }
}

// ---- View / filter / sort application (client-side, same shape as Phase 8) ----

export function applyVenueView(venues: VenueRow[], view: VenueView): VenueRow[] {
  switch (view) {
    case "all":
      return venues;
    case "active":
      return venues.filter((v) => v.status === "active");
    case "upcoming":
      return venues.filter((v) => v.status !== "archived" && v.upcoming_count > 0);
    case "needs_review":
      return venues.filter((v) => v.status === "needs_review");
    case "archived":
      return venues.filter((v) => v.status === "archived");
  }
}

export function applyVenueFilters(venues: VenueRow[], filters: VenueFilters): VenueRow[] {
  const q = filters.q.trim().toLowerCase();
  return venues.filter((venue) => {
    if (q) {
      const haystack = [venue.name, venue.address_line1, venue.city, venue.postal_code]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.city.length > 0 && (venue.city == null || !filters.city.includes(venue.city)))
      return false;
    if (filters.state.length > 0 && (venue.state_region == null || !filters.state.includes(venue.state_region)))
      return false;
    if (filters.status.length > 0 && !filters.status.includes(venue.status)) return false;
    if (filters.has_upcoming === true && venue.upcoming_count === 0) return false;
    if (filters.has_upcoming === false && venue.upcoming_count > 0) return false;
    return true;
  });
}

export function applyVenueSort(
  venues: VenueRow[],
  key: VenueSort["key"],
  dir: SortDir
): VenueRow[] {
  const indexed = venues.map((venue, index) => ({ venue, index }));
  indexed.sort((a, b) => {
    let cmp: number;
    if (key === "upcoming") {
      cmp = a.venue.upcoming_count - b.venue.upcoming_count;
    } else if (key === "updated") {
      cmp = Date.parse(a.venue.updated_at) - Date.parse(b.venue.updated_at);
    } else {
      cmp = (a.venue[key] ?? "").localeCompare(b.venue[key] ?? "", undefined, {
        sensitivity: "base",
      });
    }
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.index - b.index;
  });
  return indexed.map(({ venue }) => venue);
}

export function venueViewCounts(venues: VenueRow[]): Record<VenueView, number> {
  const counts = {} as Record<VenueView, number>;
  (["all", "active", "upcoming", "needs_review", "archived"] as VenueView[]).forEach((view) => {
    counts[view] = applyVenueView(venues, view).length;
  });
  return counts;
}

export function parseSortUrlParam(value: string | null): VenueSort | null {
  if (!value) return null;
  const [key, dir] = value.split("-") as [VenueSort["key"]?, SortDir?];
  if (!key || !dir || dir !== "asc" && dir !== "desc") return null;
  if (!["name", "city", "upcoming", "updated"].includes(key)) return null;
  return { key, dir };
}

export function toSortUrlParam(sort: VenueSort): string {
  return `${sort.key}-${sort.dir}`;
}