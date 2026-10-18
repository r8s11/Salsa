import AdminUserAvatar from "../users/AdminUserAvatar";
import AdminRoleBadge from "../users/AdminRoleBadge";
import {
  displayNameFor,
  identityLineFor,
  type AdminUserRow,
} from "../../model/usersQuery";

interface Submitter {
  user: AdminUserRow;
  emailConfirmedAt?: string | null;
  previousSubmissionsCount: number;
}
export default function AdminSubmitterPanel({ submitter }: { submitter: Submitter }) {
  const isGuest = submitter.user.kind === "guest";

  return (
    <div className="admin-card">
      <h3
        className="admin-text-lg"
        style={{ fontWeight: 600, marginBottom: "var(--space-md)" }}
      >
        Submitted By
      </h3>
      <div style={{ display: "flex", alignItems: "start", gap: "var(--space-md)" }}>
        <AdminUserAvatar row={submitter.user} />
        <div>
          <div style={{ fontWeight: 600 }}>{displayNameFor(submitter.user)}</div>
          <div className="admin-text-sm" style={{ color: "var(--admin-text-secondary)" }}>
            {identityLineFor(submitter.user)}
          </div>
          {isGuest ? (
            <span className="admin-chip">Magic-link only</span>
          ) : (
            <AdminRoleBadge role={submitter.user.role} />
          )}
          <div className="admin-text-sm" style={{ color: "var(--admin-text-secondary)" }}>
            {submitter.previousSubmissionsCount} previous submission
            {submitter.previousSubmissionsCount !== 1 ? "s" : ""}
          </div>
          <div
            className="admin-text-xs"
            style={{ color: "var(--admin-text-subtle)", marginTop: "var(--space-xs)" }}
          >
            {submitter.user.email}
          </div>
          <a
            href={`/admin/users/${isGuest ? `guest:${submitter.user.email}` : submitter.user.user_id}`}
            className="admin-text-sm"
            style={{
              color: "var(--admin-brand)",
              textDecoration: "underline",
              marginTop: "var(--space-sm)",
              display: "block",
            }}
          >
            {isGuest ? "View submitter" : "View full profile"} →
          </a>
        </div>
      </div>
    </div>
  );
}
