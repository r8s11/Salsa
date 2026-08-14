import type { TaxonomyStatus } from "../../features/admin/model/taxonomy";

const labels: Record<TaxonomyStatus, string> = { active: "Active", needs_review: "Needs Review", archived: "Archived" };

export default function AdminTaxonomyStatusBadge({ status }: { status: TaxonomyStatus }) {
  return <span className={`admin-status-badge admin-status-badge--${status}`}>{labels[status]}</span>;
}
