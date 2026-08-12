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
