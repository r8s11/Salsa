import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
  UserRound,
  Building2,
  ShieldCheck,
  Download,
  Pencil,
  Copy,
  Send,
  EyeOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Ban,
} from "lucide-react";
import type { DatabaseEvent } from "../../features/events/model/types";
import { resolveEventModalImage } from "../EventModal/eventModalImage";
import { fromEventDateInstant, formatTimeLabel } from "../../features/events/model/eventDateTime";
import { qualityIssues, QUALITY_ISSUE_LABEL } from "../../features/admin/model/overviewMetrics";
import {
  CITY_LABEL,
  SOURCE_TYPE_LABEL,
  submitterDisplay,
  type SortDir,
  type SortKey,
} from "../../features/admin/model/eventsQuery";
import AdminStatusBadge from "./AdminStatusBadge";
import AdminQualityBadge from "./AdminQualityBadge";
import AdminActionMenu, { type ActionMenuItem } from "./AdminActionMenu";
import "./AdminEventsTable.css";

export type RowAction =
  | "edit"
  | "duplicate"
  | "publish"
  | "unpublish"
  | "reject"
  | "cancel"
  | "archive"
  | "restore"
  | "delete";

interface AdminEventsTableProps {
  events: DatabaseEvent[];
  duplicateIds: ReadonlySet<string>;
  sort: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  onAction: (action: RowAction, event: DatabaseEvent) => void;
  busy: { id: string; action: RowAction } | null;
  errorId: string | null;
  error: string | null;
}

const SOURCE_ICON: Record<DatabaseEvent["source_type"], typeof Shield> = {
  admin: Shield,
  user_submission: UserRound,
  organizer: Building2,
  moderator: ShieldCheck,
  imported: Download,
};

function titleCase(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateLine(iso: string): { date: string; time: string } {
  const { date, time } = fromEventDateInstant(iso);
  const [year, month, day] = date.split("-").map(Number);
  return {
    date: new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: formatTimeLabel(time),
  };
}

// Row action menu contents by status — this matrix is the contract.
function rowActionItems(
  event: DatabaseEvent,
  onAction: (action: RowAction, event: DatabaseEvent) => void
): ActionMenuItem[] {
  const edit: ActionMenuItem = {
    id: "edit",
    label: "Edit",
    icon: Pencil,
    onSelect: () => onAction("edit", event),
  };
  const duplicate: ActionMenuItem = {
    id: "duplicate",
    label: "Duplicate",
    icon: Copy,
    onSelect: () => onAction("duplicate", event),
  };
  const publish: ActionMenuItem = {
    id: "publish",
    label: "Publish",
    icon: Send,
    separatorBefore: true,
    onSelect: () => onAction("publish", event),
  };
  const unpublish: ActionMenuItem = {
    id: "unpublish",
    label: "Unpublish",
    icon: EyeOff,
    separatorBefore: true,
    onSelect: () => onAction("unpublish", event),
  };
  const reject: ActionMenuItem = {
    id: "reject",
    label: "Reject",
    icon: Ban,
    onSelect: () => onAction("reject", event),
  };
  const cancel: ActionMenuItem = {
    id: "cancel",
    label: "Cancel Event",
    icon: Ban,
    onSelect: () => onAction("cancel", event),
  };
  const archive: ActionMenuItem = {
    id: "archive",
    label: "Archive",
    icon: Archive,
    onSelect: () => onAction("archive", event),
  };
  const restore: ActionMenuItem = {
    id: "restore",
    label: "Restore",
    icon: ArchiveRestore,
    separatorBefore: true,
    onSelect: () => onAction("restore", event),
  };
  const del: ActionMenuItem = {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    tone: "danger",
    separatorBefore: true,
    onSelect: () => onAction("delete", event),
  };

  switch (event.status) {
    case "draft":
      return [edit, duplicate, publish, archive, del];
    case "pending":
      return [edit, duplicate, publish, reject, archive, del];
    case "approved":
      return [edit, duplicate, unpublish, cancel, archive, del];
    case "rejected":
      return [edit, duplicate, publish, archive, del];
    case "cancelled":
      return [edit, duplicate, publish, archive, del];
    case "archived":
      return [edit, duplicate, restore, del];
  }
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className="admin-events-table__sort-btn"
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <Icon size={12} />
      </button>
    </th>
  );
}

function EventCell({
  event,
  duplicateIds,
}: {
  event: DatabaseEvent;
  duplicateIds: ReadonlySet<string>;
}) {
  const issues = qualityIssues(event, duplicateIds);
  return (
    <div className="admin-events-table__event">
      <img
        src={resolveEventModalImage({
          id: event.id,
          imageUrl: event.image_url ?? undefined,
          calendarId: event.event_type,
        })}
        alt=""
        loading="lazy"
        width={48}
        height={48}
      />
      <div className="admin-events-table__event-body">
        <Link to={`/admin/events?edit=${event.id}`} className="admin-events-table__title">
          {event.title}
        </Link>
        <div className="admin-events-table__chips">
          <span className="admin-chip admin-chip--type">{titleCase(event.event_type)}</span>
          <span className="admin-chip">{CITY_LABEL[event.city]}</span>
        </div>
        <p className="admin-events-table__secondary-line">
          {event.location || "Venue not set"} · {event.host || "No organizer"}
        </p>
        {issues.length > 0 && (
          <AdminQualityBadge
            issues={issues}
            labelFor={(issue) => QUALITY_ISSUE_LABEL[issue]}
            eventTitle={event.title}
            cancellationReason={event.cancellation_reason}
          />
        )}
      </div>
    </div>
  );
}

export default function AdminEventsTable({
  events,
  duplicateIds,
  sort,
  onSortChange,
  onAction,
  busy,
  errorId,
  error,
}: AdminEventsTableProps) {
  return (
    <>
      <div className="admin-events-table__scroll">
        <table className="admin-events-table">
          <thead>
            <tr>
              <SortableHeader
                label="Event"
                sortKey="title"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableHeader
                label="Date & Time"
                sortKey="event_date"
                sort={sort}
                onSortChange={onSortChange}
              />
              <th className="admin-events-table__col--venue">Venue</th>
              <th className="admin-events-table__col--organizer">Organizer</th>
              <th className="admin-events-table__col--source">Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const isBusy = busy?.id === event.id;
              const { date, time } = formatDateLine(event.event_date);
              const SourceIcon = SOURCE_ICON[event.source_type];

              return (
                <Fragment key={event.id}>
                  <tr
                    className={
                      event.status === "archived" ? "admin-events-table__row--archived" : undefined
                    }
                    style={isBusy ? { opacity: 0.6 } : undefined}
                  >
                    <td>
                      <EventCell event={event} duplicateIds={duplicateIds} />
                    </td>
                    <td>
                      <p>{date}</p>
                      <p className="admin-events-table__muted">
                        <Clock size={12} /> {event.event_time ? time : "Time not set"}
                      </p>
                    </td>
                    <td className="admin-events-table__col--venue">
                      <p className="admin-events-table__muted">
                        <MapPin size={12} /> {event.location || "Venue not set"}
                      </p>
                    </td>
                    <td className="admin-events-table__col--organizer">
                      <p>{event.host || "No organizer"}</p>
                    </td>
                    <td
                      className="admin-events-table__col--source"
                      title={`Submitted by ${submitterDisplay(event)}`}
                    >
                      <p className="admin-events-table__muted">
                        <SourceIcon size={12} /> {SOURCE_TYPE_LABEL[event.source_type]}
                      </p>
                    </td>
                    <td>
                      <AdminStatusBadge status={event.status} />
                    </td>
                    <td>
                      <div className="admin-events-table__actions">
                        <AdminActionMenu
                          label={`Actions for ${event.title}`}
                          items={rowActionItems(event, onAction)}
                          disabled={isBusy}
                        />
                      </div>
                    </td>
                  </tr>
                  {errorId === event.id && error && (
                    <tr className="admin-events-table__error">
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

      <ul className="admin-events-cards">
        {events.map((event) => {
          const isBusy = busy?.id === event.id;
          const { date, time } = formatDateLine(event.event_date);

          return (
            <li
              key={event.id}
              className={
                event.status === "archived"
                  ? "admin-card admin-events-cards__item admin-events-table__row--archived"
                  : "admin-card admin-events-cards__item"
              }
              style={isBusy ? { opacity: 0.6 } : undefined}
            >
              <div className="admin-events-cards__head">
                <Link to={`/admin/events?edit=${event.id}`} className="admin-events-table__title">
                  {event.title}
                </Link>
                <AdminStatusBadge status={event.status} />
              </div>
              <div className="admin-events-table__chips">
                <span className="admin-chip admin-chip--type">{titleCase(event.event_type)}</span>
                <span className="admin-chip">{CITY_LABEL[event.city]}</span>
              </div>
              <AdminQualityBadge
                issues={qualityIssues(event, duplicateIds)}
                labelFor={(issue) => QUALITY_ISSUE_LABEL[issue]}
                eventTitle={event.title}
                cancellationReason={event.cancellation_reason}
              />
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Date</span>
                <span>
                  {date} · {event.event_time ? time : "Time not set"}
                </span>
              </div>
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Venue</span>
                <span>{event.location || "Venue not set"}</span>
              </div>
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Organizer</span>
                <span>{event.host || "No organizer"}</span>
              </div>
              {errorId === event.id && error && (
                <p className="admin-events-cards__error" role="alert">
                  Action failed: {error}
                </p>
              )}
              <div className="admin-events-cards__actions">
                <AdminActionMenu
                  label={`Actions for ${event.title}`}
                  items={rowActionItems(event, onAction)}
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
