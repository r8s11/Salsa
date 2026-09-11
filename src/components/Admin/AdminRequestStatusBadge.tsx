import type { RequestStatus } from "../../features/admin/model/organizerRequestsQuery";
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_ICON,
} from "../../features/admin/model/organizerRequestsQuery";

// Reuses the `.admin-status` base rule from styles/admin.css.
// The request-specific modifiers are prefixed `--request-` so they can't
// collide with the event-status `--pending`/`--approved`/`--rejected`
// modifiers or the account-status `--account-` ones.
export default function AdminRequestStatusBadge({ status }: { status: RequestStatus }) {
  const Icon = REQUEST_STATUS_ICON[status];

  return (
    <span className={`admin-status admin-status--request-${status}`}>
      {Icon && <Icon size={12} />}
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}
