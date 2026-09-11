import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

export type DeletionBlocker = "role" | "event_history" | "organizer" | "operational_history" | "storage" | "unknown";
export type BlockedDeletion = { outcome: "blocked"; blocker: DeletionBlocker };
export type DeletionEligibility = { outcome: "eligible" } | BlockedDeletion;
export type DeleteAccountResult = { outcome: "deleted" } | BlockedDeletion;
type DeletionResponse = DeletionEligibility | DeleteAccountResult;
type Action = "eligibility" | "delete";


function isDeletionBlocker(value: unknown): value is DeletionBlocker {
  return (
    value === "role" ||
    value === "event_history" ||
    value === "organizer" ||
    value === "operational_history" ||
    value === "storage" ||
    value === "unknown"
  );
}

function parseDeletionResponse(value: unknown): DeletionResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("outcome" in value)) return null;
  const { outcome } = value;
  if (outcome === "eligible" || outcome === "deleted") return { outcome };
  if (outcome === "blocked" && "blocker" in value && isDeletionBlocker(value.blocker)) {
    return { outcome: "blocked", blocker: value.blocker };
  }
  return null;
}

async function invokeDeletionAction(action: Action): Promise<DeletionResponse> {
  const { data, error } = await supabase.functions.invoke<unknown>("delete-account", {
    body: { action },
  });

  const response = parseDeletionResponse(data);
  if (response) return response;

  if (error instanceof FunctionsHttpError) {
    try {
      const blocked = parseDeletionResponse(await error.context.json());
      if (blocked?.outcome === "blocked") return blocked;
    } catch {
      // The server did not return a usable public error body.
    }
  }

  throw new Error("We couldn't check whether account deletion is available. Please try again.");
}

export async function checkAccountDeletionEligibility(): Promise<DeletionEligibility> {
  const response = await invokeDeletionAction("eligibility");
  if (response.outcome === "eligible" || response.outcome === "blocked") return response;
  throw new Error("We couldn't check whether account deletion is available. Please try again.");
}

export async function deleteCurrentAccount(): Promise<DeleteAccountResult> {
  const response = await invokeDeletionAction("delete");
  if (response.outcome === "deleted" || response.outcome === "blocked") return response;
  throw new Error("We couldn't delete your account. Please try again.");
}
