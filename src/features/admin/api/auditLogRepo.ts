import { supabase } from "../../../lib/supabase";
import type { AuditLogRow } from "../model/auditLog";

export async function fetchUserAuditLog(entityId: string, limit = 50): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AuditLogRow[]) ?? [];
}
