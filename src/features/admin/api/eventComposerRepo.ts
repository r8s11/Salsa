import { supabase } from "../../../lib/supabase";
import type { AdminEventPayload } from "../../events/api/eventsRepo";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveComposerEvent(
  id: string | null,
  payload: AdminEventPayload,
  publish: boolean | null
): Promise<string> {
  const { data, error } = await supabase.rpc("save_event_with_entities", {
    p_event_id: id,
    p_payload: payload,
    p_publish: publish,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("save_event_with_entities did not return an event UUID");
  }
  return data;
}

export async function verifyComposerPublication(
  id: string
): Promise<{ id: string; slug: string | null }> {
  const { data, error } = await supabase
    .from("public_events")
    .select("id,slug")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Published event ${id} is not visible in public_events`);
  return { id: data.id, slug: data.slug };
}
