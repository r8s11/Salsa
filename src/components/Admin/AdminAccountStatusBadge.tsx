import { Flag, PauseCircle, Ban } from "lucide-react";
import { ACCOUNT_STATUS_LABEL, type AccountStatus } from "../../features/admin/model/usersQuery";

// Escalation is carried by four distinct visual mechanisms (dot, icon,
// icon, inversion) rather than by hue alone, so the state reads correctly
// in greyscale. `active` has no icon — it keeps the quiet ::before dot,
// same mechanism as the approved/draft/archived event statuses.
const STATUS_ICON: Partial<Record<AccountStatus, typeof Flag>> = {
  flagged: Flag,
  suspended: PauseCircle,
  banned: Ban,
};

export default function AdminAccountStatusBadge({
  status,
  reason,
}: {
  status: AccountStatus;
  reason?: string | null;
}) {
  const Icon = STATUS_ICON[status];

  return (
    <span className={`admin-status admin-status--account-${status}`} title={reason || undefined}>
      {Icon && <Icon size={12} />}
      {ACCOUNT_STATUS_LABEL[status]}
      {reason && <span className="admin-visually-hidden">Reason: {reason}</span>}
    </span>
  );
}
