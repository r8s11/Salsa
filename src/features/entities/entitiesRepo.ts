import { supabase } from "../../lib/supabase";
import { entityHref, type EntityDetail, type PublicEntityKind, type PublicEntityRef, type PublicEventEntities } from "./model";

export { entityHref };
export type { EventSummary, PublicEntityKind, PublicEntityRef, PublicEventEntities } from "./model";

export type EntityDirectoryParams = {
  kind?: PublicEntityKind;
  query?: string;
  city?: string;
  limit?: number;
  offset?: number;
};

function safePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(50, Math.max(1, Math.trunc(value ?? 50)));
}

function safeOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

export async function fetchEntityDetail(kind: PublicEntityKind, slug: string): Promise<EntityDetail | null> {
  const { data, error } = await supabase.rpc("public_entity_detail", {
    p_kind: kind,
    p_slug: slug,
  });
  if (error) throw new Error(error.message);
  return data as EntityDetail | null;
}

export async function fetchEntityDirectory(params: EntityDirectoryParams): Promise<PublicEntityRef[]> {
  const { data, error } = await supabase.rpc("public_entity_directory", {
    p_kind: params.kind ?? null,
    p_query: params.query?.trim() ?? "",
    p_city: params.city || null,
    p_limit: safePageSize(params.limit),
    p_offset: safeOffset(params.offset),
  });
  if (error) throw new Error(error.message);
  return (data as PublicEntityRef[] | null) ?? [];
}

export async function fetchEventEntities(eventId: string): Promise<PublicEventEntities | null> {
  const { data, error } = await supabase.rpc("public_event_entities", { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return data as PublicEventEntities | null;
}
