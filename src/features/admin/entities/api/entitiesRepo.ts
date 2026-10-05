import { supabase } from "../../../../lib/supabase";
import type { AdminEntityRow, EntityKind, EntityStatus } from "../model";

export interface EntityDirectoryParams {
  kind: EntityKind;
  query?: string;
  status?: EntityStatus | null;
}

export async function fetchAdminEntityDirectory({ kind, query = "", status = null }: EntityDirectoryParams): Promise<AdminEntityRow[]> {
  const { data, error } = await supabase.rpc("admin_entity_directory", {
    p_kind: kind,
    p_query: query,
    p_status: status,
  });
  if (error) throw new Error(`Failed to load ${kind} directory: ${error.message}`);
  return (data ?? []) as unknown as AdminEntityRow[];
}

export async function fetchAdminEntityDetail(kind: EntityKind, id: string): Promise<AdminEntityRow | null> {
  const { data, error } = await supabase.rpc("admin_entity_detail", { p_kind: kind, p_id: id });
  if (error) throw new Error(`Failed to load ${kind}: ${error.message}`);
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as unknown as AdminEntityRow | null;
}

export async function saveAdminEntity(kind: EntityKind, id: string | null, payload: Record<string, unknown>): Promise<AdminEntityRow> {
  const { data, error } = await supabase.rpc("admin_entity_save", {
    p_kind: kind,
    p_id: id,
    p_payload: payload,
  });
  if (error) throw new Error(`Failed to save ${kind}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error(`The ${kind} save did not return a record.`);
  return row as unknown as AdminEntityRow;
}

export async function mergeAdminEntities(kind: EntityKind, keepId: string, mergeId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_entity_merge", {
    p_kind: kind,
    p_keep_id: keepId,
    p_merge_id: mergeId,
    p_confirm: true,
  });
  if (error) throw new Error(`Failed to merge ${kind} records: ${error.message}`);
}

export async function archiveAdminEntity(kind: EntityKind, id: string): Promise<AdminEntityRow> {
  const { data, error } = await supabase.rpc("admin_entity_save", {
    p_kind: kind,
    p_id: id,
    p_payload: { status: "archived" },
  });
  if (error) throw new Error(`Failed to archive ${kind}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error(`The ${kind} archive did not return a record.`);
  return row as unknown as AdminEntityRow;
}
