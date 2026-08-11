import { Clock, MapPin, Pencil, Check, Ban, Trash2 } from "lucide-react";
import { Fragment } from "react";
import type { DatabaseEvent, City } from "../../features/events/model/types";
import { fromEventDateInstant } from "../../features/events/model/eventDateTime";
import AdminStatusBadge from "./AdminStatusBadge";
import "./AdminEventsTable.css";

interface AdminEventsTableProps {
  events: DatabaseEvent[];
  onEdit: (event: DatabaseEvent) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  busy: { id: string; action: "approve" | "reject" | "delete" } | null;
  errorId: string | null;
  error: string | null;
}

const CITY_LABEL: Record<City, string> = {
  boston: "Boston",
  "new-york-city": "New York City",
};

const ACTION_LABEL: Record<"approve" | "reject" | "delete", string> = {
  approve: "Approving…",
  reject: "Rejecting…",
  delete: "Deleting…",
};

function titleCase(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateLine(iso: string): { date: string; time: string } {
  const { date, time } = fromEventDateInstant(iso);
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return {
    date: new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function EventActions({
  event,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  isBusy,
  busyAction,
  labelled,
}: {
  event: DatabaseEvent;
  onEdit: (event: DatabaseEvent) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  isBusy: boolean;
  busyAction: "approve" | "reject" | "delete" | undefined;
  labelled: boolean;
}) {
  if (labelled && isBusy && busyAction) {
    return <span className="admin-events-table__busy-label">{ACTION_LABEL[busyAction]}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={labelled ? "admin-btn admin-btn--secondary" : "admin-icon-btn"}
        aria-label="Edit event"
        title="Edit event"
        onClick={() => onEdit(event)}
        disabled={isBusy}
      >
        <Pencil size={labelled ? 16 : 18} />
        {labelled && "Edit"}
      </button>
      {event.status !== "approved" && (
        <button
          type="button"
          className={labelled ? "admin-btn admin-btn--secondary" : "admin-icon-btn"}
          aria-label="Approve event"
          title="Approve event"
          onClick={() => onApprove(event.id)}
          disabled={isBusy}
        >
          <Check size={labelled ? 16 : 18} />
          {labelled && "Approve"}
        </button>
      )}
      {event.status !== "rejected" && (
        <button
          type="button"
          className={labelled ? "admin-btn admin-btn--secondary" : "admin-icon-btn"}
          aria-label="Reject event"
          title="Reject event"
          onClick={() => onReject(event.id)}
          disabled={isBusy}
        >
          <Ban size={labelled ? 16 : 18} />
          {labelled && "Reject"}
        </button>
      )}
      <button
        type="button"
        className={labelled ? "admin-btn admin-btn--secondary" : "admin-icon-btn admin-icon-btn--danger"}
        aria-label="Delete event"
        title="Delete event"
        onClick={() => onDelete(event.id)}
        disabled={isBusy}
      >
        <Trash2 size={labelled ? 16 : 18} />
        {labelled && "Delete"}
      </button>
    </>
  );
}

export default function AdminEventsTable({
  events,
  onEdit,
  onApprove,
  onReject,
  onDelete,
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
              <th>Event</th>
              <th>Date &amp; Time</th>
              <th>Venue</th>
              <th>Submitted by</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const isBusy = busy?.id === event.id;
              const { date, time } = formatDateLine(event.event_date);
              const submitterLabel = event.submitter_name || event.submitter_email || "?";

              return (
                <Fragment key={event.id}>
                  <tr style={isBusy ? { opacity: 0.6 } : undefined}>
                    <td>
                      <div className="admin-events-table__event">
                        <img
                          src={event.image_url || `https://picsum.photos/seed/${event.id}/96/96`}
                          alt=""
                          loading="lazy"
                          width={48}
                          height={48}
                        />
                        <div>
                          <p className="admin-events-table__title">{event.title}</p>
                          <div className="admin-events-table__chips">
                            <span className="admin-chip admin-chip--type">{titleCase(event.event_type)}</span>
                            <span className="admin-chip">{CITY_LABEL[event.city]}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p>{date}</p>
                      <p className="admin-events-table__muted">
                        <Clock size={12} /> {time}
                      </p>
                    </td>
                    <td>
                      <p>{event.location || "—"}</p>
                      <p className="admin-events-table__muted">
                        <MapPin size={12} /> {CITY_LABEL[event.city]}
                      </p>
                    </td>
                    <td>
                      <div className="admin-events-table__submitter">
                        <span className="admin-events-table__avatar">{initials(submitterLabel)}</span>
                        <span className="admin-events-table__truncate">{submitterLabel}</span>
                      </div>
                    </td>
                    <td>
                      <AdminStatusBadge status={event.status} />
                    </td>
                    <td>
                      <div className="admin-events-table__actions">
                        <EventActions
                          event={event}
                          onEdit={onEdit}
                          onApprove={onApprove}
                          onReject={onReject}
                          onDelete={onDelete}
                          isBusy={isBusy}
                          busyAction={isBusy ? busy?.action : undefined}
                          labelled={false}
                        />
                      </div>
                    </td>
                  </tr>
                  {errorId === event.id && error && (
                    <tr className="admin-events-table__error">
                      <td colSpan={6} role="alert">
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
          const submitterLabel = event.submitter_name || event.submitter_email || "?";

          return (
            <li key={event.id} className="admin-card admin-events-cards__item" style={isBusy ? { opacity: 0.6 } : undefined}>
              <div className="admin-events-cards__head">
                <p className="admin-events-table__title">{event.title}</p>
                <AdminStatusBadge status={event.status} />
              </div>
              <div className="admin-events-table__chips">
                <span className="admin-chip admin-chip--type">{titleCase(event.event_type)}</span>
                <span className="admin-chip">{CITY_LABEL[event.city]}</span>
              </div>
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Date</span>
                <span>
                  {date}, {time}
                </span>
              </div>
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Venue</span>
                <span>{event.location || "—"}</span>
              </div>
              <div className="admin-events-cards__row">
                <span className="admin-events-cards__label">Submitted by</span>
                <span>{submitterLabel}</span>
              </div>
              {errorId === event.id && error && (
                <p className="admin-events-cards__error" role="alert">
                  Action failed: {error}
                </p>
              )}
              <div className="admin-events-cards__actions">
                <EventActions
                  event={event}
                  onEdit={onEdit}
                  onApprove={onApprove}
                  onReject={onReject}
                  onDelete={onDelete}
                  isBusy={isBusy}
                  busyAction={isBusy ? busy?.action : undefined}
                  labelled
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
