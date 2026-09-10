import type { VenueStatus } from "../../features/admin/model/venuesQuery";
import { VENUE_STATUS_LABEL, VENUE_STATUS_ICON } from "../../features/admin/model/venuesQuery";

interface AdminVenueStatusBadgeProps {
  status: VenueStatus;
  className?: string;
}

export default function AdminVenueStatusBadge({ status, className }: AdminVenueStatusBadgeProps) {
  const Icon = VENUE_STATUS_ICON[status];
  return (
    <span
      className={`admin-status admin-status--venue-${status}${className ? ` ${className}` : ""}`}
      aria-label={VENUE_STATUS_LABEL[status]}
      title={VENUE_STATUS_LABEL[status]}
    >
      <Icon size={12} aria-hidden="true" />
      <span className="admin-status__label">{VENUE_STATUS_LABEL[status]}</span>
    </span>
  );
}
