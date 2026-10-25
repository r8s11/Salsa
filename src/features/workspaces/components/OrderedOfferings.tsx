import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import AdminConfirmDialog from "../../admin/components/common/AdminConfirmDialog";
import MarginMark from "../../../components/desk/MarginMark";
import {
  errorMessage,
  type OfferingRemover,
  type OfferingSaver,
} from "../hooks/useEntityWorkspace";
import type { OfferingStatus } from "../model";
import type { FieldErrors } from "../offeringForm";
import OfferingActions from "./OfferingActions";
import OfferingFormShell from "./OfferingFormShell";

type OrderedItem = { id: string; position: number; status: OfferingStatus };

export type OrderedFieldsContext<Form extends Record<string, string>> = {
  form: Form;
  errors: FieldErrors<keyof Form & string>;
  set: <K extends keyof Form & string>(field: K, value: Form[K]) => void;
};

type OrderedOfferingsProps<Item extends OrderedItem, Form extends Record<string, string>, Input> = {
  /** Singular, lower-case: "private lesson", "price plan". */
  noun: string;
  emptyText: string;
  items: Item[];
  titleOf: (item: Item) => string;
  /** The agate line under the title. */
  summaryOf: (item: Item) => string[];
  blankForm: Form;
  formFrom: (item: Item) => Form;
  toInput: (
    form: Form,
    existing: Item | null
  ) => { input: Input } | { errors: FieldErrors<keyof Form & string> };
  /** The payload that re-saves an item unchanged apart from `patch`. */
  inputOf: (item: Item, patch: { status?: OfferingStatus; position?: number }) => Input;
  save: OfferingSaver<Input>;
  remover: OfferingRemover;
  renderFields: (context: OrderedFieldsContext<Form>) => ReactNode;
};

type Editing = { mode: "new" } | { mode: "edit"; id: string };

/**
 * An ordered list of school offerings (privates, price plans): add, edit and
 * delete in place, pause or resume, and move up or down to set the order the
 * public page shows. Order is the `position` column; a move renumbers only the
 * rows whose position no longer matches their place.
 */
export default function OrderedOfferings<
  Item extends OrderedItem,
  Form extends Record<string, string>,
  Input,
>({
  noun,
  emptyText,
  items,
  titleOf,
  summaryOf,
  blankForm,
  formFrom,
  toInput,
  inputOf,
  save,
  remover,
  renderFields,
}: OrderedOfferingsProps<Item, Form, Input>) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const run = async (work: () => Promise<unknown>) => {
    setRowError(null);
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setRowError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = (item: Item) =>
    run(() =>
      save.mutateAsync({
        offeringId: item.id,
        input: inputOf(item, { status: item.status === "active" ? "paused" : "active" }),
      })
    );

  const move = (index: number, delta: -1 | 1) =>
    run(async () => {
      const reordered = [...items];
      [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
      for (const [position, item] of reordered.entries()) {
        if (item.position === position) continue;
        await save.mutateAsync({ offeringId: item.id, input: inputOf(item, { position }) });
      }
    });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remover.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Rendered inside the dialog from remover.error.
    }
  };

  const adding = editing?.mode === "new";

  return (
    <div className="ws-body ws-body--measure">
      <div className="ws-toolbar">
        <p className="ws-note">
          {items.length === 0
            ? emptyText
            : `${items.length} ${items.length === 1 ? noun : `${noun}s`}, in the order dancers see them.`}
        </p>
        <button
          type="button"
          className="desk__action desk__action--primary"
          disabled={adding}
          onClick={() => setEditing({ mode: "new" })}
        >
          <Plus size={14} aria-hidden /> Add {noun}
        </button>
      </div>

      {rowError && (
        <p className="ws-status ws-status--error" role="alert">
          {rowError}
        </p>
      )}

      <ol className="ws-list" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)}s`}>
        {adding && (
          <li className="ws-row ws-row--editing">
            <ItemEditor
              label={`New ${noun}`}
              submitLabel={`Add ${noun}`}
              initial={blankForm}
              existing={null}
              toInput={toInput}
              save={save}
              renderFields={renderFields}
              onClose={() => setEditing(null)}
            />
          </li>
        )}
        {items.map((item, index) =>
          editing?.mode === "edit" && editing.id === item.id ? (
            <li key={item.id} className="ws-row ws-row--editing">
              <ItemEditor
                label={`Edit ${titleOf(item)}`}
                submitLabel={`Save ${noun}`}
                initial={formFrom(item)}
                existing={item}
                toInput={toInput}
                save={save}
                renderFields={renderFields}
                onClose={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={item.id}
              className={`ws-row${item.status === "paused" ? " ws-row--paused" : ""}`}
            >
              <span className="ws-row__mark">
                <MarginMark state={item.status === "paused" ? "standing" : "set"} />
              </span>
              <div className="ws-row__body">
                <h3 className="ws-row__title">{titleOf(item)}</h3>
                <p className="ws-row__meta">
                  {summaryOf(item).map((part, partIndex) => (
                    <span key={`${partIndex}-${part}`}>
                      {partIndex > 0 && (
                        <span className="ws-row__sep" aria-hidden>
                          ·
                        </span>
                      )}
                      {part}
                    </span>
                  ))}
                </p>
                {item.status === "paused" && (
                  <p className="ws-row__flag">Paused — hidden from the public page</p>
                )}
              </div>
              <OfferingActions
                name={titleOf(item)}
                status={item.status}
                disabled={busy}
                onEdit={() => {
                  setRowError(null);
                  setEditing({ mode: "edit", id: item.id });
                }}
                onToggleStatus={() => void toggleStatus(item)}
                onDelete={() => {
                  remover.reset();
                  setDeleting(item);
                }}
                move={{
                  canUp: index > 0,
                  canDown: index < items.length - 1,
                  onUp: () => void move(index, -1),
                  onDown: () => void move(index, 1),
                }}
              />
            </li>
          )
        )}
      </ol>

      {deleting && (
        <AdminConfirmDialog
          title={`Delete “${titleOf(deleting)}”?`}
          body={`It leaves the public page for good. Pause it instead to keep it for later.`}
          confirmLabel={`Delete ${noun}`}
          busyLabel="Deleting…"
          isBusy={remover.isPending}
          error={remover.isError ? errorMessage(remover.error) : null}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function ItemEditor<Item extends OrderedItem, Form extends Record<string, string>, Input>({
  label,
  submitLabel,
  initial,
  existing,
  toInput,
  save,
  renderFields,
  onClose,
}: {
  label: string;
  submitLabel: string;
  initial: Form;
  existing: Item | null;
  toInput: OrderedOfferingsProps<Item, Form, Input>["toInput"];
  save: OfferingSaver<Input>;
  renderFields: OrderedOfferingsProps<Item, Form, Input>["renderFields"];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<FieldErrors<keyof Form & string>>({});
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof Form & string>(field: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const result = toInput(form, existing);
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
      {renderFields({ form, errors, set })}
    </OfferingFormShell>
  );
}
