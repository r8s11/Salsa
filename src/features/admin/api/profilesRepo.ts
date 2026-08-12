import { supabase } from "../../../lib/supabase";
import type { AccountStatus, AdminUserRow, UserRole } from "../model/usersQuery";

export async function fetchProfileCount(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchUserDirectory(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_user_directory");
  if (error) throw new Error(error.message);
  return (data as AdminUserRow[]) ?? [];
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function setUserStatus(
  userId: string,
  status: AccountStatus,
  reason?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
