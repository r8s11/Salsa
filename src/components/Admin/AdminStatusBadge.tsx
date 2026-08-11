import type { DatabaseEvent } from "../../features/events/model/types";

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

export default function AdminStatusBadge({ status }: { status: DatabaseEvent["status"] }) {
  return <span className={`admin-status admin-status--${status}`}>{STATUS_LABEL[status]}</span>;
}
