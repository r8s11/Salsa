export type AccountKind = "profile" | "guest";
export type UserRole = "user" | "moderator" | "organizer" | "admin";
export type AccountStatus = "active" | "flagged" | "suspended" | "banned";

export interface AdminUserRow {
  kind: AccountKind;
  id: string; // profiles.id, or "guest:<lowercased email>"
  user_id: string | null; // null for guests
  email: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: UserRole | null; // null for guests
  status: AccountStatus;
  status_reason: string | null;
  created_at: string;
  last_active_at: string;
  contributions: number;
  pending_count: number;
}

export type UserView =
  | "all"
  | "registered"
  | "organizers"
  | "moderators"
  | "flagged"
  | "suspended"
  | "banned"
  | "guests";
export type UserSortKey = "joined" | "name" | "contributions" | "active";
export type SortDir = "asc" | "desc";

export interface UserFilters {
  q: string;
  role: UserRole[];
  status: AccountStatus[];
  kind: AccountKind | null;
  from: string | null; // yyyy-mm-dd, inclusive, against created_at calendar date
  to: string | null;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "User",
  moderator: "Moderator",
  organizer: "Organizer",
  admin: "Admin",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  flagged: "Flagged",
  suspended: "Suspended",
  banned: "Banned",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  profile: "Registered",
  guest: "Magic-link only",
};

export const USER_VIEWS: { view: UserView; label: string }[] = [
  { view: "all", label: "All Users" },
  { view: "registered", label: "Registered" },
  { view: "organizers", label: "Organizers" },
  { view: "moderators", label: "Moderators" },
  { view: "flagged", label: "Flagged" },
  { view: "suspended", label: "Suspended" },
  { view: "banned", label: "Banned" },
  { view: "guests", label: "Magic-Link Submitters" },
];

export const DEFAULT_USER_SORT: { key: UserSortKey; dir: SortDir } = {
  key: "joined",
  dir: "desc",
};

const VIEW_PREDICATES: Record<UserView, (row: AdminUserRow) => boolean> = {
  all: () => true,
  registered: (row) => row.kind === "profile",
  organizers: (row) => row.role === "organizer",
  moderators: (row) => row.role === "moderator",
  flagged: (row) => row.status === "flagged",
  suspended: (row) => row.status === "suspended",
  banned: (row) => row.status === "banned",
  guests: (row) => row.kind === "guest",
};

export function displayNameFor(row: AdminUserRow): string {
  if (row.kind === "guest") return row.display_name ?? "Guest Submitter";
  return row.display_name?.trim() || "Unnamed account";
}

export function identityLineFor(row: AdminUserRow): string {
  if (row.kind === "guest") return "No public profile";
  if (row.username) return "@" + row.username;
  return "No username set";
}

export function initialsFor(row: AdminUserRow): string {
  if (row.kind === "guest") return "";
  return displayNameFor(row).charAt(0).toUpperCase();
}

export function applyUserView(rows: AdminUserRow[], view: UserView): AdminUserRow[] {
  const predicate = VIEW_PREDICATES[view];
  return rows.filter(predicate);
}

export function applyUserFilters(rows: AdminUserRow[], filters: UserFilters): AdminUserRow[] {
  const q = filters.q.trim().toLowerCase();

  return rows.filter((row) => {
    if (q) {
      const haystack = [row.display_name, row.username, row.email]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.role.length > 0 && (row.role === null || !filters.role.includes(row.role)))
      return false;

    if (filters.status.length > 0 && !filters.status.includes(row.status)) return false;

    if (filters.kind && row.kind !== filters.kind) return false;

    if (filters.from || filters.to) {
      const createdDate = row.created_at.slice(0, 10);
      if (filters.from && createdDate < filters.from) return false;
      if (filters.to && createdDate > filters.to) return false;
    }

    return true;
  });
}

export function applyUserSort(
  rows: AdminUserRow[],
  key: UserSortKey,
  dir: SortDir
): AdminUserRow[] {
  const indexed = rows.map((row, index) => ({ row, index }));

  indexed.sort((a, b) => {
    const cmp =
      key === "name"
        ? displayNameFor(a.row).localeCompare(displayNameFor(b.row), undefined, {
            sensitivity: "base",
          })
        : key === "contributions"
          ? a.row.contributions - b.row.contributions
          : key === "active"
            ? Date.parse(a.row.last_active_at) - Date.parse(b.row.last_active_at)
            : Date.parse(a.row.created_at) - Date.parse(b.row.created_at);

    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.index - b.index;
  });

  return indexed.map(({ row }) => row);
}

export function userViewCounts(rows: AdminUserRow[]): Record<UserView, number> {
  const counts = {} as Record<UserView, number>;
  (Object.keys(VIEW_PREDICATES) as UserView[]).forEach((view) => {
    const predicate = VIEW_PREDICATES[view];
    counts[view] = rows.filter(predicate).length;
  });
  return counts;
}
