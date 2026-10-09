import { useParams } from "react-router-dom";
import OrderedOfferings, { type OrderedFieldsContext } from "../components/OrderedOfferings";
import WorkspaceField from "../components/WorkspaceField";
import WorkspaceFrame from "../components/WorkspaceFrame";
import { useDeleteOffering, useSaveOffering } from "../hooks/useEntityWorkspace";
import { formatCents, type EntityWorkspace, type OfferingStatus, type PrivateOffer } from "../model";
import {
  BLANK_PRIVATE_FORM,
  privateFormFrom,
  privateInputFrom,
  type PrivateForm,
} from "../offeringForm";

export default function SchoolPrivatesPage() {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind="school" id={id} section="Privates">
      {(workspace) =>
        workspace.kind === "school" ? <PrivatesBody workspace={workspace} /> : null
      }
    </WorkspaceFrame>
  );
}

function PrivatesBody({ workspace }: { workspace: Extract<EntityWorkspace, { kind: "school" }> }) {
  const schoolId = workspace.entity.id;
  const save = useSaveOffering(schoolId, "private");
  const remover = useDeleteOffering(schoolId, "private");

  return (
    <OrderedOfferings
      noun="private lesson"
      emptyText="No private lessons yet. Add the lessons you offer and what they cost."
      items={workspace.offerings.privates}
      titleOf={(offer) => offer.title}
      summaryOf={(offer) =>
        [
          formatCents(offer.price_cents),
          `${offer.duration_minutes} min`,
          offer.instructor_name,
          offer.notes,
        ].filter((part): part is string => Boolean(part))
      }
      blankForm={BLANK_PRIVATE_FORM}
      formFrom={privateFormFrom}
      toInput={privateInputFrom}
      inputOf={(offer: PrivateOffer, patch: { status?: OfferingStatus; position?: number }) => ({
        title: offer.title,
        duration_minutes: offer.duration_minutes,
        price_cents: offer.price_cents,
        instructor_id: offer.instructor_id,
        instructor_name: offer.instructor_name,
        notes: offer.notes,
        status: patch.status ?? offer.status,
        position: patch.position ?? offer.position,
      })}
      save={save}
      remover={remover}
      renderFields={(context) => <PrivateFields {...context} />}
    />
  );
}

function PrivateFields({ form, errors, set }: OrderedFieldsContext<PrivateForm>) {
  return (
    <>
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
      <WorkspaceField label="Price (USD)" error={errors.price}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="decimal"
            placeholder="85"
            value={form.price}
            onChange={(event) => set("price", event.target.value)}
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
    </>
  );
}
