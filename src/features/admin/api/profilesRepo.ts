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

export interface CreateUserParams {
  email: string;
  display_name?: string;
  role?: UserRole;
}

/**
 * The row returned by admin_invite_user. `temp_password` is generated inside the
 * RPC, returned exactly once, and never stored in plaintext — the admin has to
 * hand it to the new account holder out of band. There is no invite email: the
 * app is statically hosted and the Supabase project has no custom SMTP.
 */
export interface InvitedUser {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  temp_password: string;
}

export async function createUser(userData: CreateUserParams): Promise<InvitedUser> {
  const { data, error } = await supabase.rpc("admin_invite_user", {
    p_email: userData.email,
    p_display_name: userData.display_name || null,
    p_role: userData.role || "user",
  });
  if (error) throw new Error(error.message);
  // admin_invite_user is RETURNS TABLE, so PostgREST yields a single-row array.
  const row = (data as InvitedUser[] | null)?.[0];
  if (!row) throw new Error("The account was not created. Please try again.");
  return row;
}
