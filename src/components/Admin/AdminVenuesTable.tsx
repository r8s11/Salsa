import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, MapPin } from "lucide-react";
import type {
  VenueRow,
  VenueSort,
  SortDir,
  VenueAction,
} from "../../features/admin/model/venuesQuery";
import { venueActionItems, venueDisplayAddress } from "../../features/admin/model/venuesQuery";
import AdminVenueStatusBadge from "./AdminVenueStatusBadge";
import AdminActionMenu from "./AdminActionMenu";
import AdminQualityBadge from "./AdminQualityBadge";
import { VENUE_QUALITY_ISSUE_LABEL } from "../../features/admin/model/venuesQuery";
import "./AdminVenuesTable.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: string;
  sort: VenueSort;
  onSortChange: (key: string) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className="admin-venues-table__sort-btn"
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <Icon size={12} />
      </button>
    </th>
  );
}

interface AdminVenuesTableProps {
  venues: VenueRow[];
  sort: VenueSort;
  onSortChange: (key: string) => void;
  onAction: (action: VenueAction, venue: VenueRow) => void;
  busy: { id: string; action: VenueAction } | null;
  errorId: string | null;
  error: string | null;
}

export default function AdminVenuesTable({
  venues,
  sort,
  onSortChange,
  onAction,
  busy,
  errorId,
  error,
}: AdminVenuesTableProps) {
  return (
    <>
      <div className="admin-venues-table__scroll">
        <table className="admin-venues-table">
          <thead>
            <tr>
              <SortableHeader
                label="Venue"
                sortKey="name"
                sort={sort}
                onSortChange={onSortChange}
              />
              <th className="admin-venues-table__col--city">City</th>
              <th className="admin-venues-table__col--address">Address</th>
              <th className="admin-venues-table__col--upcoming">Upcoming Events</th>
              <th className="admin-venues-table__col--status">Status</th>
              <th className="admin-venues-table__col--updated">Updated</th>
              <th className="admin-venues-table__col--actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((venue) => {
              const isBusy = busy?.id === venue.id;
              const qualityIssues = venue.quality_issues;
              return (
                <Fragment key={venue.id}>
                  <tr style={isBusy ? { opacity: 0.6 } : undefined}>
                    <td>
                      <Link to={`/admin/venues/${venue.id}`} className="admin-venues-table__title">
                        {venue.name}
                      </Link>
                      {qualityIssues && qualityIssues.length > 0 && (
                        <AdminQualityBadge
                          issues={qualityIssues}
                          labelFor={(issue) => VENUE_QUALITY_ISSUE_LABEL[issue]}
                          eventTitle={venue.name}
                        />
                      )}
                    </td>
                    <td className="admin-venues-table__col--city">{venue.city ?? "—"}</td>
                    <td className="admin-venues-table__col--address">
                      {venueDisplayAddress(venue) || "—"}
                    </td>
                    <td className="admin-venues-table__col--upcoming">
                      {venue.upcoming_count > 0 ? (
                        <span>
                          {venue.upcoming_count} upcoming{" "}
                          {venue.upcoming_count === 1 ? "event" : "events"}
                        </span>
                      ) : (
                        <span className="admin-venues-table__muted">No upcoming events</span>
                      )}
                    </td>
                    <td className="admin-venues-table__col--status">
                      <AdminVenueStatusBadge status={venue.status} />
                    </td>
                    <td className="admin-venues-table__col--updated">
                      {formatDate(venue.updated_at)}
                    </td>
                    <td className="admin-venues-table__col--actions">
                      <AdminActionMenu
                        label={`Actions for ${venue.name}`}
                        items={venueActionItems(venue, onAction)}
                        disabled={isBusy}
                      />
                    </td>
                  </tr>
                  {errorId === venue.id && error && (
                    <tr className="admin-venues-table__error">
                      <td colSpan={7} role="alert">
                        Action failed: {error}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list — same dual-layout pattern as AdminOrganizerRequestsTable */}
      <ul className="admin-venues-cards">
        {venues.map((venue) => {
          const isBusy = busy?.id === venue.id;
          const qualityIssues = venue.quality_issues;
          return (
            <li
              key={venue.id}
              className="admin-card admin-venues-cards__item"
              style={isBusy ? { opacity: 0.6 } : undefined}
            >
              <div className="admin-venues-cards__head">
                <MapPin size={18} className="admin-venues-cards__icon" />
                <div className="admin-venues-cards__head-body">
                  <Link to={`/admin/venues/${venue.id}`} className="admin-venues-table__title">
                    {venue.name}
                  </Link>
                  <p className="admin-venues-table__identity">
                    {venueDisplayAddress(venue) || "No address"}
                  </p>
                </div>
                <AdminVenueStatusBadge status={venue.status} />
              </div>
              {qualityIssues && qualityIssues.length > 0 && (
                <div className="admin-venues-cards__row">
                  <span className="admin-venues-cards__label">Quality</span>
                  <AdminQualityBadge
                    issues={qualityIssues}
                    labelFor={(issue) => VENUE_QUALITY_ISSUE_LABEL[issue]}
                    eventTitle={venue.name}
                  />
                </div>
              )}
              <div className="admin-venues-cards__row">
                <span className="admin-venues-cards__label">Upcoming</span>
                <span>
                  {venue.upcoming_count} event{venue.upcoming_count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="admin-venues-cards__row">
                <span className="admin-venues-cards__label">Updated</span>
                <span>{formatDate(venue.updated_at)}</span>
              </div>
              {errorId === venue.id && error && (
                <p className="admin-venues-cards__error" role="alert">
                  Action failed: {error}
                </p>
              )}
              <div className="admin-venues-cards__actions">
                <AdminActionMenu
                  label={`Actions for ${venue.name}`}
                  items={venueActionItems(venue, onAction)}
                  disabled={isBusy}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Re-export for the page's type usage.
export type { VenueAction, VenueSort, SortDir };
