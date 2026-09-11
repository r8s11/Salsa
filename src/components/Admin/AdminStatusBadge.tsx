import { Ban, CircleX, Clock } from "lucide-react";
import type { DatabaseEvent } from "../../features/events/model/types";
import type { SubmissionStatus } from "../../features/admin/model/submissions";

type AdminStatus = DatabaseEvent["status"] | SubmissionStatus;

const STATUS_LABEL: Record<AdminStatus, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  in_review: "In Review",
  needs_information: "Needs Information",
  approved: "Published",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_ICON: Partial<Record<AdminStatus, typeof Clock>> = {
  pending: Clock,
  in_review: Clock,
  needs_information: Clock,
  rejected: CircleX,
  withdrawn: CircleX,
  cancelled: Ban,
};

export default function AdminStatusBadge({ status }: { status: AdminStatus }) {
  const Icon = STATUS_ICON[status];

  return (
    <span className={`admin-status admin-status--${status}`}>
      {Icon && <Icon size={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}
