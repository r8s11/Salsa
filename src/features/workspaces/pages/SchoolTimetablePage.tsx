import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import AdminConfirmDialog from "../../admin/components/common/AdminConfirmDialog";
import MarginMark from "../../../components/desk/MarginMark";
import OfferingActions from "../components/OfferingActions";
import OfferingFormShell from "../components/OfferingFormShell";
import WorkspaceField from "../components/WorkspaceField";
import WorkspaceFrame from "../components/WorkspaceFrame";
import { useDanceStyleOptions } from "../hooks/useDanceStyleOptions";
import { errorMessage, useDeleteOffering, useSaveOffering, type OfferingSaver } from "../hooks/useEntityWorkspace";
import {
  CLASS_LEVEL_LABELS,
  WEEKDAY_LABELS,
  formatCents,
  type ClassLevel,
  type EntityWorkspace,
  type OfferingStatus,
  type SchoolClass,
  type SchoolClassInput,
  type Weekday,
} from "../model";
import {
  blankClassForm,
  classFormFrom,
  classInputFrom,
  formatTimeRange,
  type ClassField,
  type ClassForm,
  type FieldErrors,
} from "../offeringForm";

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const LEVELS = Object.keys(CLASS_LEVEL_LABELS) as ClassLevel[];

type Editing = { mode: "new"; weekday: Weekday } | { mode: "edit"; id: string };

export default function SchoolTimetablePage() {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind="school" id={id} section="Timetable">
      {(workspace) =>
        workspace.kind === "school" ? <TimetableBody workspace={workspace} /> : null
      }
    </WorkspaceFrame>
  );
}

function TimetableBody({ workspace }: { workspace: Extract<EntityWorkspace, { kind: "school" }> }) {
  const schoolId = workspace.entity.id;
  const classes = workspace.offerings.classes;
  const save = useSaveOffering(schoolId, "class");
  const remove = useDeleteOffering(schoolId, "class");

  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const toggleStatus = async (entry: SchoolClass) => {
    const next: OfferingStatus = entry.status === "active" ? "paused" : "active";
    const result = classInputFrom({ ...classFormFrom(entry), status: next }, entry);
    if ("errors" in result) {
      setRowError(`“${entry.title}” needs a correction before it can change: open it with Edit.`);
      return;
    }
    setRowError(null);
    setBusyId(entry.id);
    try {
      await save.mutateAsync({ offeringId: entry.id, input: result.input });
    } catch (error) {
      setRowError(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Rendered inside the dialog from remove.error.
    }
  };

  return (
    <div className="ws-body">
      {rowError && (
        <p className="ws-status ws-status--error" role="alert">
          {rowError}
        </p>
      )}

      {WEEKDAYS.map((day) => {
        const dayClasses = classes.filter((entry) => entry.weekday === day);
        const adding = editing?.mode === "new" && editing.weekday === day;
        const headingId = `ws-day-${day}`;
        return (
          <section key={day} className="desk__division ws-division" aria-labelledby={headingId}>
            <div className="ws-division-head">
              <h2 id={headingId} className="desk__division-day">
                {WEEKDAY_LABELS[day]}
              </h2>
              <span className="desk__division-date">
                {dayClasses.length === 1 ? "1 class" : `${dayClasses.length} classes`}
              </span>
              <span className="desk__division-rule" aria-hidden />
              <button
                type="button"
                className="desk__action"
                aria-label={`Add a class on ${WEEKDAY_LABELS[day]}`}
                disabled={adding}
                onClick={() => setEditing({ mode: "new", weekday: day })}
              >
                <Plus size={14} aria-hidden /> Add class
              </button>
            </div>

            {dayClasses.length === 0 && !adding && (
              <p className="desk__division-empty">No classes.</p>
            )}

            <ul className="ws-list">
              {adding && (
                <li className="ws-row ws-row--editing">
                  <ClassEditor
                    key={`new-${day}`}
                    initial={blankClassForm(day)}
                    existing={null}
                    label={`New class on ${WEEKDAY_LABELS[day]}`}
                    submitLabel="Add class"
                    save={save}
                    onClose={() => setEditing(null)}
                  />
                </li>
              )}
              {dayClasses.map((entry) =>
                editing?.mode === "edit" && editing.id === entry.id ? (
                  <li key={entry.id} className="ws-row ws-row--editing">
                    <ClassEditor
                      initial={classFormFrom(entry)}
                      existing={entry}
                      label={`Edit ${entry.title}`}
                      submitLabel="Save class"
                      save={save}
                      onClose={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <ClassRow
                    key={entry.id}
                    entry={entry}
                    disabled={busyId === entry.id}
                    onEdit={() => {
                      setRowError(null);
                      setEditing({ mode: "edit", id: entry.id });
                    }}
                    onToggleStatus={() => void toggleStatus(entry)}
                    onDelete={() => {
                      remove.reset();
                      setDeleting(entry);
                    }}
                  />
                )
              )}
            </ul>
          </section>
        );
      })}

      {deleting && (
        <AdminConfirmDialog
          title={`Delete “${deleting.title}”?`}
          body={`It leaves the ${WEEKDAY_LABELS[deleting.weekday]} timetable and the public page for good. Pause it instead to keep it for later.`}
          confirmLabel="Delete class"
          busyLabel="Deleting…"
          isBusy={remove.isPending}
          error={remove.isError ? errorMessage(remove.error) : null}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ClassRow({
  entry,
  disabled,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  entry: SchoolClass;
  disabled: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const paused = entry.status === "paused";
  const details = [
    entry.style_name,
    CLASS_LEVEL_LABELS[entry.level],
    entry.instructor_name,
    entry.room,
    entry.drop_in_cents === null ? null : `Drop-in ${formatCents(entry.drop_in_cents)}`,
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <li className={`ws-row${paused ? " ws-row--paused" : ""}`}>
      <span className="ws-row__mark">
        <MarginMark state={paused ? "standing" : "set"} />
      </span>
      <div className="ws-row__body">
        <p className="ws-row__time">{formatTimeRange(entry.start_time, entry.duration_minutes)}</p>
        <h3 className="ws-row__title">{entry.title}</h3>
        <p className="ws-row__meta">
          {details.map((detail, index) => (
            <span key={detail}>
              {index > 0 && (
                <span className="ws-row__sep" aria-hidden>
                  ·
                </span>
              )}
              {detail}
            </span>
          ))}
        </p>
        {paused && <p className="ws-row__flag">Paused — hidden from the public page</p>}
      </div>
      <OfferingActions
        name={entry.title}
        status={entry.status}
        disabled={disabled}
        onEdit={onEdit}
        onToggleStatus={onToggleStatus}
        onDelete={onDelete}
      />
    </li>
  );
}

type ClassSave = OfferingSaver<SchoolClassInput>;

function ClassEditor({
  initial,
  existing,
  label,
  submitLabel,
  save,
  onClose,
}: {
  initial: ClassForm;
  existing: SchoolClass | null;
  label: string;
  submitLabel: string;
  save: ClassSave;
  onClose: () => void;
}) {
  const styles = useDanceStyleOptions();
  const [form, setForm] = useState<ClassForm>(initial);
  const [errors, setErrors] = useState<FieldErrors<ClassField>>({});
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends ClassField>(field: K, value: ClassForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const result = classInputFrom(form, existing);
    if ("errors" in result) {
      setErrors(result.errors);
      setAttempt((count) => count + 1);
      return;
    }
    setServerError(null);
    try {
      await save.mutateAsync({ offeringId: existing?.id ?? null, input: result.input });
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  const options = styles.data ?? [];
  // An archived style on an existing class stays visible rather than silently dropping.
  const orphanStyle =
    existing?.style_term_id && !options.some((option) => option.id === existing.style_term_id)
      ? { id: existing.style_term_id, name: existing.style_name ?? "Current style" }
      : null;

  return (
    <OfferingFormShell
      label={label}
      submitLabel={submitLabel}
      pending={save.isPending}
      error={serverError}
      invalidAttempt={attempt}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <WorkspaceField label="Title" error={errors.title} wide>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Day" error={errors.weekday}>
        {(control) => (
          <select
            {...control}
            className="admin-select"
            value={form.weekday}
            onChange={(event) => set("weekday", event.target.value)}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
        )}
      </WorkspaceField>
      <WorkspaceField label="Start time" error={errors.start_time}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            type="time"
            value={form.start_time}
            onChange={(event) => set("start_time", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Duration (minutes)" error={errors.duration}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="numeric"
            value={form.duration}
            onChange={(event) => set("duration", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Level">
        {(control) => (
          <select
            {...control}
            className="admin-select"
            value={form.level}
            onChange={(event) => set("level", event.target.value as ClassLevel)}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {CLASS_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        )}
      </WorkspaceField>
      <WorkspaceField
        label="Dance style"
        hint={styles.isError ? "Dance styles didn’t load. Try again, or save without one." : undefined}
      >
        {(control) => (
          <>
            <select
              {...control}
              className="admin-select"
              value={form.style_term_id}
              disabled={styles.isPending}
              onChange={(event) => set("style_term_id", event.target.value)}
            >
              <option value="">{styles.isPending ? "Loading styles…" : "No style"}</option>
              {orphanStyle && <option value={orphanStyle.id}>{orphanStyle.name}</option>}
              {options.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
            {styles.isError && (
              <button type="button" className="desk__action" onClick={() => void styles.refetch()}>
                Reload styles
              </button>
            )}
          </>
        )}
      </WorkspaceField>
      <WorkspaceField label="Instructor" error={errors.instructor_name}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            value={form.instructor_name}
            onChange={(event) => set("instructor_name", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Room" error={errors.room}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            value={form.room}
            onChange={(event) => set("room", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField
        label="Drop-in price (USD)"
        hint="Leave blank if there is no drop-in."
        error={errors.drop_in}
      >
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="decimal"
            placeholder="20"
            value={form.drop_in}
            onChange={(event) => set("drop_in", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Status">
        {(control) => (
          <select
            {...control}
            className="admin-select"
            value={form.status}
            onChange={(event) => set("status", event.target.value as OfferingStatus)}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        )}
      </WorkspaceField>
      <WorkspaceField label="Notes" error={errors.notes} wide>
        {(control) => (
          <textarea
            {...control}
            className="admin-textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        )}
      </WorkspaceField>
    </OfferingFormShell>
  );
}
