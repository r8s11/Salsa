import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserPlus, Trash2, Edit3 } from "lucide-react";
import { useEventAttendees } from "../features/host/hooks/useEventAttendees";
import type { AttendeeCategory, HostAttendeeInput } from "../features/host/model/attendance";
import "../styles/admin.css";
import "./HostAttendeeListPage.css";

const CATEGORY_OPTIONS: { value: AttendeeCategory; label: string }[] = [
  { value: "guest", label: "Guest" },
  { value: "comp", label: "Comp" },
  { value: "staff", label: "Staff" },
  { value: "performer", label: "Performer" },
  { value: "instructor", label: "Instructor" },
  { value: "registered", label: "Registered" },
  { value: "walk_in", label: "Walk-in" },
];

const CATEGORY_BADGE_CLASS: Record<AttendeeCategory, string> = {
  registered: "badge--blue",
  guest: "badge--gray",
  comp: "badge--green",
  staff: "badge--yellow",
  performer: "badge--purple",
  instructor: "badge--cyan",
  walk_in: "badge--orange",
};

function formatCategory(c: AttendeeCategory): string {
  return c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ");
}

interface AddAttendeeFormProps {
  onAdd: (input: HostAttendeeInput) => Promise<unknown>;
  isAdding: boolean;
}

function AddAttendeeForm({ onAdd, isAdding }: AddAttendeeFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<AttendeeCategory>("guest");
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onAdd({
        displayName: name.trim(),
        email: email.trim() || null,
        category,
        partySize,
        notes: notes.trim() || null,
      });
      setName("");
      setEmail("");
      setCategory("guest");
      setPartySize(1);
      setNotes("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add attendee");
    }
  }

  return (
    <form className="attendee-form" onSubmit={handleSubmit}>
      <h3 className="attendee-form__title">
        <UserPlus size={16} aria-hidden="true" />
        Add Attendee
      </h3>

      <div className="attendee-form__row">
        <label className="attendee-form__field">
          <span className="attendee-form__label">Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="attendee-form__input"
            placeholder="Display name"
          />
        </label>

        <label className="attendee-form__field">
          <span className="attendee-form__label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={300}
            className="attendee-form__input"
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="attendee-form__row">
        <label className="attendee-form__field">
          <span className="attendee-form__label">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AttendeeCategory)}
            className="attendee-form__select"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="attendee-form__field">
          <span className="attendee-form__label">Party Size</span>
          <input
            type="number"
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            min={1}
            max={20}
            className="attendee-form__input"
          />
        </label>

        <label className="attendee-form__field attendee-form__field--wide">
          <span className="attendee-form__label">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="attendee-form__input"
            placeholder="Optional"
          />
        </label>
      </div>

      {error && <p className="attendee-form__error" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={isAdding || !name.trim()}
        className="admin-btn admin-btn--primary"
      >
        {isAdding ? "Adding…" : "Add Attendee"}
      </button>
    </form>
  );
}

export default function HostAttendeeListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    attendees,
    isLoading,
    error,
    refetch,
    addAttendee,
    isAdding,
    deleteAttendee,
    isDeleting,
  } = useEventAttendees(eventId);

  const totalPartySize = attendees.reduce((sum, a) => sum + a.partySize, 0);

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this attendee? This cannot be undone.")) return;
    try {
      await deleteAttendee(id);
    } catch {
      // error surfaced by hook
    }
  }

  return (
    <main className="admin-shell">
      <div className="host-attendee-list">
        <Link
          to={`/host/events/${eventId}`}
          className="host-attendee-list__back"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Event
        </Link>

        <h1 className="host-attendee-list__title">Event Attendees</h1>
        <p className="host-attendee-list__subtitle">
          {attendees.length} {attendees.length === 1 ? "entry" : "entries"}
          {totalPartySize > 0 && ` · ${totalPartySize} total headcount`}
        </p>

        <AddAttendeeForm onAdd={addAttendee} isAdding={isAdding} />

        {isLoading && (
          <p className="host-attendee-list__status" role="status">
            Loading attendees…
          </p>
        )}

        {error && (
          <div className="admin-banner admin-banner--error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() => refetch()}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && attendees.length === 0 && (
          <div className="host-attendee-list__empty">
            <p>No attendees yet. Add your first attendee above.</p>
          </div>
        )}

        {!isLoading && attendees.length > 0 && (
          <div className="attendee-table-wrap">
            <table className="attendee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Party</th>
                  <th>Email</th>
                  <th>Notes</th>
                  <th className="attendee-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.id}>
                    <td className="attendee-table__name">{attendee.displayName}</td>
                    <td>
                      <span className={`attendee-badge ${CATEGORY_BADGE_CLASS[attendee.category]}`}>
                        {formatCategory(attendee.category)}
                      </span>
                    </td>
                    <td className="attendee-table__center">{attendee.partySize}</td>
                    <td className="attendee-table__muted">{attendee.email ?? "—"}</td>
                    <td className="attendee-table__muted">{attendee.notes ?? "—"}</td>
                    <td className="attendee-table__actions">
                      <Link
                        to={`/host/events/${eventId}/attendees/${attendee.id}/edit`}
                        className="attendee-action-btn"
                        aria-label={`Edit ${attendee.displayName}`}
                      >
                        <Edit3 size={14} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        className="attendee-action-btn attendee-action-btn--danger"
                        onClick={() => handleDelete(attendee.id)}
                        disabled={isDeleting}
                        aria-label={`Remove ${attendee.displayName}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
