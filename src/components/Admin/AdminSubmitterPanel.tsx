import AdminUserAvatar from "./AdminUserAvatar";
import AdminRoleBadge from "./AdminRoleBadge";
import {
  displayNameFor,
  identityLineFor,
  type AdminUserRow,
} from "../../features/admin/model/usersQuery";

interface Submitter {
  user: AdminUserRow;
  emailConfirmedAt?: string | null;
  previousSubmissionsCount: number;
}
export default function AdminSubmitterPanel({ submitter }: { submitter: Submitter }) {
  const isGuest = submitter.user.kind === "guest";

  return (
    <div className="admin-card">
      <h3 className="admin-text-lg font-semibold mb-4">Submitted By</h3>
      <div className="flex items-start gap-4">
        <AdminUserAvatar row={submitter.user} />
        <div>
          <div className="font-semibold">{displayNameFor(submitter.user)}</div>
          <div className="text-sm text-gray-500">{identityLineFor(submitter.user)}</div>
          {isGuest ? (
            <span className="admin-chip">Magic-link only</span>
          ) : (
            <AdminRoleBadge role={submitter.user.role} />
          )}
          <div className="text-sm text-gray-500">
            {submitter.previousSubmissionsCount} previous submission
            {submitter.previousSubmissionsCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-gray-400 mt-1">{submitter.user.email}</div>
          <a
            href={`/admin/users/${isGuest ? `guest:${submitter.user.email}` : submitter.user.user_id}`}
            className="text-sm text-blue-500 hover:underline mt-2 block"
          >
            {isGuest ? "View submitter" : "View full profile"} →
          </a>
        </div>
      </div>
    </div>
  );
}
