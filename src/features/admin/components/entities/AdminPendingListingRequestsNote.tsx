import { Link } from "react-router-dom";
import type { ManagedKind } from "../../../workspaces/model";
import { usePendingRequestsForListing } from "../../hooks/useAdminListingRequests";

/** On a listing's admin page: how many requests about it wait on a decision, linking to them. */
export function AdminPendingListingRequestsNote({ kind, id }: { kind: ManagedKind; id: string }) {
  const { count } = usePendingRequestsForListing(kind, id);
  if (count === 0) return null;
  return (
    <p className="admin-entity-page__quiet">
      <Link to={`/admin/requests?kind=${kind}&entity=${encodeURIComponent(id)}`}>
        {count} pending {count === 1 ? "request" : "requests"}
      </Link>
    </p>
  );
}
