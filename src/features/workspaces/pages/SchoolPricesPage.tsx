import { useParams } from "react-router-dom";
import OrderedOfferings, { type OrderedFieldsContext } from "../components/OrderedOfferings";
import WorkspaceField from "../components/WorkspaceField";
import WorkspaceFrame from "../components/WorkspaceFrame";
import { useDeleteOffering, useSaveOffering } from "../hooks/useEntityWorkspace";
import {
  PLAN_TYPE_LABELS,
  formatCents,
  type EntityWorkspace,
  type OfferingStatus,
  type PlanType,
  type PricePlan,
} from "../model";
import { BLANK_PLAN_FORM, planFormFrom, planInputFrom, type PlanForm } from "../offeringForm";

const PLAN_TYPES = Object.keys(PLAN_TYPE_LABELS) as PlanType[];

export default function SchoolPricesPage() {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind="school" id={id} section="Prices">
      {(workspace) => (workspace.kind === "school" ? <PricesBody workspace={workspace} /> : null)}
    </WorkspaceFrame>
  );
}

function PricesBody({ workspace }: { workspace: Extract<EntityWorkspace, { kind: "school" }> }) {
  const schoolId = workspace.entity.id;
  const save = useSaveOffering(schoolId, "plan");
  const remover = useDeleteOffering(schoolId, "plan");

  return (
    <OrderedOfferings
      noun="price plan"
      emptyText="No price plans yet. Add drop-ins, class packs and memberships."
      items={workspace.offerings.plans}
      titleOf={(plan) => plan.name}
      summaryOf={(plan) =>
        [
          formatCents(plan.price_cents),
          PLAN_TYPE_LABELS[plan.plan_type],
          plan.class_count === null
            ? null
            : `${plan.class_count} ${plan.class_count === 1 ? "class" : "classes"}`,
          plan.valid_days === null ? null : `valid ${plan.valid_days} days`,
          plan.notes,
        ].filter((part): part is string => Boolean(part))
      }
      blankForm={BLANK_PLAN_FORM}
      formFrom={planFormFrom}
      toInput={planInputFrom}
      inputOf={(plan: PricePlan, patch: { status?: OfferingStatus; position?: number }) => ({
        name: plan.name,
        plan_type: plan.plan_type,
        price_cents: plan.price_cents,
        class_count: plan.class_count,
        valid_days: plan.valid_days,
        notes: plan.notes,
        status: patch.status ?? plan.status,
        position: patch.position ?? plan.position,
      })}
      save={save}
      remover={remover}
      renderFields={(context) => <PlanFields {...context} />}
    />
  );
}

function PlanFields({ form, errors, set }: OrderedFieldsContext<PlanForm>) {
  return (
    <>
      <WorkspaceField label="Name" error={errors.name} wide>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Type">
        {(control) => (
          <select
            {...control}
            className="admin-select"
            value={form.plan_type}
            onChange={(event) => set("plan_type", event.target.value as PlanType)}
          >
            {PLAN_TYPES.map((type) => (
              <option key={type} value={type}>
                {PLAN_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </WorkspaceField>
      <WorkspaceField label="Price (USD)" error={errors.price}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="decimal"
            placeholder="120"
            value={form.price}
            onChange={(event) => set("price", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Number of classes" hint="Leave blank if it isn’t counted." error={errors.class_count}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="numeric"
            value={form.class_count}
            onChange={(event) => set("class_count", event.target.value)}
          />
        )}
      </WorkspaceField>
      <WorkspaceField label="Valid for (days)" hint="Leave blank if it doesn’t expire." error={errors.valid_days}>
        {(control) => (
          <input
            {...control}
            className="admin-input"
            inputMode="numeric"
            value={form.valid_days}
            onChange={(event) => set("valid_days", event.target.value)}
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
