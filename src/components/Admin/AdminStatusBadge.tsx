import { Clock, CircleX, Ban } from "lucide-react";
import type { DatabaseEvent } from "../../features/events/model/types";

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  draft: "Draft",
  pending: "Pending Approval",
  approved: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};

// Three redundant signals per badge (text + shape + tint) so colour is
// never the only carrier. Quiet states keep the CSS ::before dot/ring;
// loud states swap it for a real icon element, which survives greyscale.
const STATUS_ICON: Partial<Record<DatabaseEvent["status"], typeof Clock>> = {
  pending: Clock,
  rejected: CircleX,
  cancelled: Ban,
};

export default function AdminStatusBadge({ status }: { status: DatabaseEvent["status"] }) {
  const Icon = STATUS_ICON[status];

  return (
    <span className={`admin-status admin-status--${status}`}>
      {Icon && <Icon size={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}
