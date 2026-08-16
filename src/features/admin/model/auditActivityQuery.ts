import { ROLE_LABEL, type UserRole } from "./usersQuery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityAuditLog {
  id: string;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ActivityCategory =
  | "events"
  | "submissions"
  | "users"
  | "organizers"
  | "venues"
  | "taxonomy"
  | "settings"
  | "security";

export type ActivityView =
  | "all"
  | "today"
  | "user-management"
  | "event-changes"
  | "moderation"
  | "organizer-decisions"
  | "settings-changes"
  | "security-actions";

export type ActivitySortKey = "newest" | "oldest";
export type SortDir = "asc" | "desc";

export interface ActivityFilters {
  q: string;
  from: string | null; // yyyy-mm-dd, inclusive
  to: string | null;
  category: ActivityCategory[];
  action: string[];
  actor: string | null; // entity_id of the actor (UUID) — resolved from directory
  targetType: string[];
}

// ---------------------------------------------------------------------------
// Labels & vocabulary
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  events: "Events",
  submissions: "Submissions",
  users: "Users",
  organizers: "Organizers",
  venues: "Venues",
  taxonomy: "Taxonomy",
  settings: "Settings",
  security: "Security",
};

export const ACTIVITY_VIEWS: { view: ActivityView; label: string }[] = [
  { view: "all", label: "All Activity" },
  { view: "today", label: "Today" },
  { view: "user-management", label: "User Management" },
  { view: "event-changes", label: "Event Changes" },
  { view: "moderation", label: "Moderation" },
  { view: "organizer-decisions", label: "Organizer Decisions" },
  { view: "settings-changes", label: "Settings Changes" },
  { view: "security-actions", label: "Security Actions" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Category derivation
// ---------------------------------------------------------------------------

const ACTION_SECURITY_SET = new Set([
  "user.banned",
  "user.suspended",
  "user.role_changed",
  "platform_settings.access_policy_changed",
]);

/**
 * Derives the Activity category from an audit entry.
 * Mirrors the SQL `category_of()` function — keep both in sync.
 * Security-sensitive actions always take priority so bans/suspensions/
 * role-changes/access-policy changes are always categorized as "security"
 * regardless of entity_type.
 */
export function categoryOf(entry: ActivityAuditLog): ActivityCategory {
  const { entity_type, action } = entry;
  if (ACTION_SECURITY_SET.has(action)) return "security";
  if (entity_type === "platform_settings") return "settings";
  if (entity_type === "event") return "events";
  if (entity_type === "event_submission") return "submissions";
  if (entity_type === "profile" || entity_type === "organizer") return "users";
  if (entity_type === "venue") return "venues";
  if (entity_type === "taxonomy_term") return "taxonomy";
  return "events";
}

// ---------------------------------------------------------------------------
// Action sensitivity
// ---------------------------------------------------------------------------

const SENSITIVE_ACTIONS = new Set([
  "user.banned",
  "user.suspended",
  "user.role_changed",
  "platform_settings.access_policy_changed",
]);

/** Actions that need extra visual emphasis (left border + bolder label). */
export function isSensitiveAction(action: string): boolean {
  return SENSITIVE_ACTIONS.has(action);
}

// ---------------------------------------------------------------------------
// Human-readable action labels
// ---------------------------------------------------------------------------

/**
 * Maps a raw audit action key to plain-English UI copy.
 * This is the single source of the audit-timeline vocabulary shown in
 * the Activity list and detail pages.
 */
export function activityActionLabel(
  entry: ActivityAuditLog
): string {
  const metadata = entry.metadata ?? {};
  const { action } = entry;

  switch (action) {
    // ---- Events ----
    case "event.created":
      return "Event created";
    case "event.approved":
      return "Event published";
    case "event.rejected":
      return "Event rejected";
    case "event.status_changed": {
      const toStatus = metadata.to_status as string | undefined;
      return toStatus
        ? `Event status changed to ${toStatus}`
        : "Event status changed";
    }
    case "event.updated":
      return "Event updated";
    case "event.deleted":
      return "Event deleted";
    case "event.archived":
      return "Event archived";
    case "event.restored":
      return "Event restored";

    // ---- Submissions ----
    case "submission.created":
      return "Submission received";
    case "submission.review_started":
      return "Review started";
    case "submission.edited": {
      const fields = metadata.fields as string[] | undefined;
      if (fields && fields.length > 0) {
        return `Submission corrected — ${fields.join(", ")}`;
      }
      return "Submission corrected";
    }
    case "submission.approved":
      return "Submission approved";
    case "submission.rejected": {
      const reason = metadata.rejection_reason as string | undefined;
      return reason ? `Submission rejected — ${reason}` : "Submission rejected";
    }
    case "submission.marked_duplicate":
      return "Marked as duplicate";
    case "submission.reopened":
      return "Reopened";
    case "submission.withdrawn":
      return "Withdrawn by submitter";

    // ---- Users ----
    case "user.role_changed": {
      const toRole = metadata.to_role as UserRole | undefined;
      return toRole ? `Role changed to ${ROLE_LABEL[toRole]}` : "Role changed";
    }
    case "user.flagged":
      return "Account flagged";
    case "user.unflagged":
      return "Flag removed";
    case "user.suspended":
      return "Account suspended";
    case "user.banned":
      return "Account banned";
    case "user.restored":
      return "Access restored";

    // ---- Venues ----
    case "venue.created":
      return "Venue created";
    case "venue.updated":
      return "Venue updated";
    case "venue.archived":
      return "Venue archived";
    case "venue.restored":
      return "Venue restored";
    case "venue.deleted":
      return "Venue deleted";
    case "venue.merged": {
      const keptName = metadata.kept_name as string | undefined;
      return keptName ? `Venue merged into ${keptName}` : "Venue merged";
    }

    // ---- Taxonomy ----
    case "taxonomy_term.created":
      return "Taxonomy term created";
    case "taxonomy_term.merged":
      return "Taxonomy term merged";
    case "taxonomy_term.archived":
      return "Taxonomy term archived";

    // ---- Platform settings ----
    case "platform_settings.updated":
      return "Platform settings updated";
    case "platform_settings.access_policy_changed":
      return "Submission access policy changed";

    // ---- Organizer ----
    case "organizer.created":
      return "Organizer record created";
    case "organizer.revoked":
      return "Organizer access revoked";

    default:
      return action;
  }
}

// ---------------------------------------------------------------------------
// Actor / target resolution
// ---------------------------------------------------------------------------

/** Human-readable label for the actor (or "System" for null). */
export function activityActorLabel(entry: ActivityAuditLog): string {
  if (!entry.actor_id) return "SalsaSegura System";
  // Prefer display name when present (more human-readable than username),
  // then fall back to username.
  if (entry.actor_display_name) return entry.actor_display_name;
  if (entry.actor_username) return `@${entry.actor_username}`;
  return "Unknown admin";
}

/**
 * Resolves a human-readable target label from the entry + optional joined data.
 * Falls back to safe metadata strings when the joined record is gone.
 */
export function activityTargetLabel(
  entry: ActivityAuditLog,
  targetDisplayName?: string | null
): string {
  const metadata = entry.metadata ?? {};

  // Prefer an explicitly resolved display name passed by the caller.
  if (targetDisplayName) return targetDisplayName;

  // Fall back to metadata fields that triggers commonly populate.
  if (metadata.title) return metadata.title as string;
  if (metadata.kept_name) return metadata.kept_name as string;
  if (metadata.display_name) return metadata.display_name as string;
  if (metadata.username) return `@${metadata.username as string}`;
  if (entry.entity_id) return `#${entry.entity_id}`;

  // Generic fallback by entity type.
  const typeMap: Record<string, string> = {
    event: "Event record",
    event_submission: "Submission",
    profile: "User account",
    venue: "Venue",
    taxonomy_term: "Taxonomy term",
    organizer: "Organizer",
    platform_settings: "Platform settings",
  };
  return typeMap[entry.entity_type] ?? entry.entity_type;
}

// ---------------------------------------------------------------------------
// Date formatting (mirrors AdminOrganizerRequestsTable's formatDate)
// ---------------------------------------------------------------------------

export function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Preset application
// ---------------------------------------------------------------------------

/** Maps a preset view to the raw filters it applies. */
export function filtersForView(
  view: ActivityView
): { category: ActivityCategory[]; action: string[]; entity_type: string[] } {
  switch (view) {
    case "all":
      return { category: [], action: [], entity_type: [] };
    case "today":
      return { category: [], action: [], entity_type: [] }; // date filter only
    case "user-management":
      return { category: ["users"], action: [], entity_type: ["profile", "organizer"] };
    case "event-changes":
      return { category: ["events"], action: [], entity_type: ["event"] };
    case "moderation":
      return { category: ["submissions"], action: [], entity_type: ["event_submission"] };
    case "organizer-decisions":
      return {
        category: ["organizers", "users"],
        action: [],
        entity_type: ["organizer"],
      };
    case "settings-changes":
      return { category: ["settings"], action: [], entity_type: ["platform_settings"] };
    case "security-actions":
      return {
        category: ["security", "users"],
        action: [
          "user.banned",
          "user.suspended",
          "user.role_changed",
          "platform_settings.access_policy_changed",
        ],
        entity_type: [],
      };
  }
}

// ---------------------------------------------------------------------------
// Client-side filtering (applied to server-returned page or full set)
// ---------------------------------------------------------------------------

export function applyActivityFilters(
  entries: ActivityAuditLog[],
  filters: ActivityFilters,
  view: ActivityView,
  fromMs: number | null,
  toMs: number | null
): ActivityAuditLog[] {
  const q = filters.q.trim().toLowerCase();
  const viewFilters = filtersForView(view);

  return entries.filter((entry) => {
    // --- Search ---
    if (q) {
      const haystack = [
        entry.actor_display_name,
        entry.actor_username,
        entry.action,
        entry.entity_type,
        entry.entity_id,
        entry.metadata ? JSON.stringify(entry.metadata) : "",
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // --- Date range (from URL/search params) ---
    if (fromMs !== null && Date.parse(entry.created_at) < fromMs) return false;
    if (toMs !== null && Date.parse(entry.created_at) > toMs) return false;

    // --- Today preset (overrides date range) ---
    if (view === "today") {
      const entryMs = Date.parse(entry.created_at);
      const dayStart = new Date().setHours(0, 0, 0, 0);
      if (entryMs < dayStart) return false;
    }

    // --- Category / action / target-type (from preset or drawer) ---
    const category = categoryOf(entry);
    if (viewFilters.category.length > 0 && !viewFilters.category.includes(category))
      return false;
    if (viewFilters.action.length > 0 && !viewFilters.action.includes(entry.action))
      return false;
    if (viewFilters.entity_type.length > 0 && !viewFilters.entity_type.includes(entry.entity_type))
      return false;

    // --- Drawer filters (only active when view is "all") ---
    if (view === "all" || view === "today") {
      if (filters.category.length > 0 && !filters.category.includes(category)) return false;
      if (filters.action.length > 0 && !filters.action.includes(entry.action)) return false;
      if (filters.targetType.length > 0 && !filters.targetType.includes(entry.entity_type))
        return false;
      if (filters.actor && entry.actor_id !== filters.actor) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Preset counts — computed client-side from the full filtered set
// ---------------------------------------------------------------------------

export type ActivityCountMap = {
  all: number;
  today: number;
  "user-management": number;
  "event-changes": number;
  moderation: number;
  "organizer-decisions": number;
  "settings-changes": number;
  "security-actions": number;
};

export function activityViewCounts(
  entries: ActivityAuditLog[],
  baseFilters: ActivityFilters
): ActivityCountMap {
  const counts = {} as ActivityCountMap;
  (ACTIVITY_VIEWS as { view: ActivityView }[]).forEach(({ view }) => {
    const viewFilters = filtersForView(view);
    const q = baseFilters.q.trim().toLowerCase();
    counts[view] = entries.filter((entry) => {
      if (q) {
        const haystack = [
          entry.actor_display_name,
          entry.actor_username,
          entry.action,
          entry.entity_type,
          entry.entity_id,
          entry.metadata ? JSON.stringify(entry.metadata) : "",
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (viewFilters.category.length > 0) {
        const cat = categoryOf(entry);
        if (!viewFilters.category.includes(cat)) return false;
      }
      if (viewFilters.action.length > 0 && !viewFilters.action.includes(entry.action))
        return false;
      if (
        viewFilters.entity_type.length > 0 &&
        !viewFilters.entity_type.includes(entry.entity_type)
      )
        return false;
      if (view === "today") {
        const entryMs = Date.parse(entry.created_at);
        const dayStart = new Date().setHours(0, 0, 0, 0);
        if (entryMs < dayStart) return false;
      }
      return true;
    }).length;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function parseSortUrlParam(value: string | null): ActivitySortKey | null {
  if (!value) return null;
  if (value === "newest" || value === "oldest") return value;
  return null;
}

export function toSortUrlParam(sort: ActivitySortKey): string {
  return sort;
}
