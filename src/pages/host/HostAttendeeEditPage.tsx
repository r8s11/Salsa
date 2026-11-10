import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEventAttendees } from "../../features/host/hooks/useEventAttendees";
import {
  ATTENDEE_CATEGORY_OPTIONS,
  ATTENDEE_LIMITS,
  clampPartySize,
  type AttendeeCategory,
  type HostAttendee,
  type HostAttendeeInput,
} from "../../features/host/model/attendance";
import "../../styles/admin.css";
import "./HostAttendeeListPage.css";
import "./HostAttendeeEditPage.css";

interface EditAttendeeFormProps {
  attendee: HostAttendee;
  rosterPath: string;
  isSaving: boolean;
  onSave: (
    updates: Pick<HostAttendeeInput, "displayName" | "email" | "category" | "partySize" | "notes">
  ) => Promise<unknown>;
}

function EditAttendeeForm({ attendee, rosterPath, isSaving, onSave }: EditAttendeeFormProps) {
  const [name, setName] = useState(attendee.displayName);
  const [email, setEmail] = useState(attendee.email ?? "");
  const [category, setCategory] = useState<AttendeeCategory>(attendee.category);
  const [partySize, setPartySize] = useState(attendee.partySize);
  const [notes, setNotes] = useState(attendee.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    setError(null);
    try {
      await onSave({
        displayName: name.trim(),
        email: email.trim() || null,
        category,
        partySize,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendee");
    }
  }

  return (
    <form className="attendee-form" onSubmit={handleSubmit} aria-label="Edit attendee">
      <div className="attendee-form__row">
        <label className="attendee-form__field">
          <span className="attendee-form__label">Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={ATTENDEE_LIMITS.nameMax}
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
            maxLength={ATTENDEE_LIMITS.emailMax}
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
            {ATTENDEE_CATEGORY_OPTIONS.map((opt) => (
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
            onChange={(e) => setPartySize(clampPartySize(Number(e.target.value)))}
            min={ATTENDEE_LIMITS.partySizeMin}
            max={ATTENDEE_LIMITS.partySizeMax}
            className="attendee-form__input"
          />
        </label>

        <label className="attendee-form__field attendee-form__field--wide">
          <span className="attendee-form__label">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={ATTENDEE_LIMITS.notesMax}
            className="attendee-form__input"
            placeholder="Optional"
          />
        </label>
      </div>

      {error && (
        <p className="attendee-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="host-attendee-edit__actions">
        <Link to={rosterPath} className="admin-btn admin-btn--secondary">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="admin-btn admin-btn--primary"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default function HostAttendeeEditPage() {
  const { eventId, attendeeId } = useParams<{ eventId: string; attendeeId: string }>();
  const navigate = useNavigate();
  const { attendees, isLoading, error, refetch, updateAttendee, isUpdating } =
    useEventAttendees(eventId);

  const rosterPath = `/host/events/${eventId}/attendees`;
  // The roster is queried per event, so an id from another event (or one the caller
  // cannot read) is simply absent. The eventId check guards against cached rows.
  const attendee = attendees.find((a) => a.id === attendeeId && a.eventId === eventId);

  return (
    <div className="admin-shell">
      <div className="host-attendee-edit">
        <Link to={rosterPath} className="host-attendee-edit__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Attendees
        </Link>

        <h1 className="host-attendee-edit__title">Edit Attendee</h1>

        {isLoading && (
          <p className="host-attendee-edit__status" role="status">
            Loading attendee…
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

        {!isLoading && !error && !attendee && (
          <div className="host-attendee-edit__not-found">
            <h2>Attendee not found</h2>
            <p>
              This attendee is not on this event&apos;s roster, or you do not have access to it.
            </p>
            <Link to={rosterPath} className="admin-btn admin-btn--secondary">
              Back to roster
            </Link>
          </div>
        )}

        {!isLoading && !error && attendee && (
          <EditAttendeeForm
            key={attendee.id}
            attendee={attendee}
            rosterPath={rosterPath}
            isSaving={isUpdating}
            onSave={async (updates) => {
              await updateAttendee({ attendeeId: attendee.id, updates });
              navigate(rosterPath);
            }}
          />
        )}
      </div>
    </div>
  );
}
