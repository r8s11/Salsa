import { ROLE_LABEL, displayNameFor, type AdminUserRow, type UserRole } from "./usersQuery";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function reasonSuffix(metadata: Record<string, unknown> | null): string {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.trim() !== "" ? ` — ${reason}` : "";
}

// Human copy per action — the single source of audit-timeline vocabulary,
// mirroring how displayNameFor/identityLineFor centralize identity copy.
export function auditLogLabelFor(entry: AuditLogRow): string {
  const metadata = entry.metadata ?? {};
  switch (entry.action) {
    case "user.role_changed": {
      const toRole = metadata.to_role as UserRole | undefined;
      return `Role changed to ${toRole ? ROLE_LABEL[toRole] : "Unknown"}`;
    }
    case "user.flagged":
      return `Account flagged${reasonSuffix(metadata)}`;
    case "user.unflagged":
      return "Flag removed";
    case "user.suspended":
      return `Account suspended${reasonSuffix(metadata)}`;
    case "user.banned":
      return `Account banned${reasonSuffix(metadata)}`;
    case "user.restored":
      return "Access restored";
    case "submission.created":
      return "Submission received";
    case "submission.review_started":
      return "Review started";
    case "submission.edited":
      return `${(metadata.fields as string[])?.join(", ") ?? "Fields"} corrected`;
    case "submission.approved":
      return "Approved";
    case "submission.rejected":
      return `Rejected — ${metadata.rejection_reason ?? "Unknown"}`;
    case "submission.marked_duplicate":
      return "Marked as duplicate";
    case "submission.reopened":
      return "Reopened";
    case "submission.withdrawn":
      return "Withdrawn by submitter";
    case "venue.created":
      return "Venue created";
    case "venue.updated":
      return `Venue updated${(metadata.fields as string[])?.length ? ` — ${(metadata.fields as string[]).join(", ")}` : ""}`;
    case "venue.archived":
      return "Venue archived";
    case "venue.restored":
      return "Venue restored";
    case "venue.deleted":
      return "Venue deleted";
    case "venue.merged":
      return `Venue merged into ${metadata.kept_name ?? "another venue"}`;
    default:
      return entry.action;
  }
}

// Resolves an audit_logs.actor_id against the already-loaded directory —
// every admin who could perform an action is themselves a directory row.
export function actorLabelFor(actorId: string | null, users: AdminUserRow[]): string {
  if (!actorId) return "System";
  const actor = users.find((user) => user.user_id === actorId);
  if (!actor) return "Unknown admin";
  return actor.username ? `@${actor.username}` : displayNameFor(actor);
}

// entries must already be newest-first (the repo query orders by
// created_at desc) — this returns the first one matching any of the
// given actions, i.e. the most recent occurrence.
export function latestActionEntry(entries: AuditLogRow[], actions: string[]): AuditLogRow | null {
  return entries.find((entry) => actions.includes(entry.action)) ?? null;
}
