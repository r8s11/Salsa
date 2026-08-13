import { Clock, Search, Info, CheckCircle, CircleX, Undo2 } from "lucide-react";

type SubmissionStatus = 'pending' | 'in_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn';

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  needs_information: "Needs Information",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_ICON: Record<SubmissionStatus, typeof Clock> = {
  pending: Clock,
  in_review: Search,
  needs_information: Info,
  approved: CheckCircle,
  rejected: CircleX,
  withdrawn: Undo2,
};

export default function AdminSubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const Icon = STATUS_ICON[status];

  return (
    <span className={`admin-status admin-status--submission-${status}`}>
      {Icon && <Icon size={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}
