import { supabase } from "../../../lib/supabase";
import type { ActivityAuditLog } from "../model/auditActivityQuery";

// ---------------------------------------------------------------------------
// Raw row as returned by the admin_audit_log RPC (before client enrichment)
// ---------------------------------------------------------------------------

interface AuditRpcRow {
  id: string;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// fetchActivityLogs — paginated, filterable list
// ---------------------------------------------------------------------------

export interface ActivityFiltersForRpc {
  limit: number;
  offset: number;
  q: string | null;
  category: string[] | null; // ActivityCategory[] cast to text[]
  action: string[] | null;
  actor_id: string | null;
  entity_type: string | null;
  from: string | null; // ISO timestamptz
  to: string | null;
}

export interface ActivityPageResult {
  entries: ActivityAuditLog[];
  total: number;
}

/**
 * Fetches a page of audit entries from the admin_audit_log RPC.
 * The RPC applies all server-side filters so the client never loads the full table.
 */
export async function fetchActivityLogs(
  params: ActivityFiltersForRpc
): Promise<ActivityPageResult> {
  const { data, error } = await supabase.rpc("admin_audit_log", {
    p_limit: params.limit,
    p_offset: params.offset,
    p_q: params.q,
    p_category: params.category,
    p_action: params.action,
    p_actor_id: params.actor_id,
    p_entity_type: params.entity_type,
    p_from: params.from,
    p_to: params.to,
  });

  if (error) throw new Error(error.message);
  const rows = (data as AuditRpcRow[]) ?? [];

  // The RPC returns only the page of rows; total count is not included.
  // We return entries.length as a lower-bound; the page component computes
  // total from the directory query or a separate count call if needed.
  return {
    entries: rows.map((row): ActivityAuditLog => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_display_name: row.actor_display_name,
      actor_username: row.actor_username,
      actor_avatar_url: row.actor_avatar_url,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: row.metadata,
      created_at: row.created_at,
    })),
    total: rows.length,
  };
}

// ---------------------------------------------------------------------------
// fetchActivityLog — single entry by id
// ---------------------------------------------------------------------------

export async function fetchActivityLog(id: string): Promise<ActivityAuditLog | null> {
  const { data, error } = await supabase.rpc("admin_audit_log_detail", { p_id: id });

  if (error) throw new Error(error.message);
  const row = data?.[0] as AuditRpcRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_display_name: row.actor_display_name,
    actor_username: row.actor_username,
    actor_avatar_url: row.actor_avatar_url,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}
