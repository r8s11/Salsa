import { FunctionsHttpError } from "@supabase/supabase-js";
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

export type InviteDelivery = "email_invitation" | "temporary_password";

export interface CreateUserParams {
  email: string;
  display_name?: string;
  role?: UserRole;
  delivery?: InviteDelivery;
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

/**
 * Result of `invite-organizer`. The Edge Function only ever confirms the
 * identifiers it created — `display_name`/`status`/`created_at` are filled
 * in client-side because nothing else in the response is a credential or
 * secret. There is no temporary password in this branch: the recipient sets
 * their own password by accepting the email invite.
 */
export type CreatedAccount =
  | {
      delivery: "email_invitation";
      id: string;
      email: string;
      role: "organizer";
      display_name: string | null;
      status: "active";
      created_at: string;
    }
  | ({ delivery: "temporary_password" } & InvitedUser);

interface InviteOrganizerFunctionResponse {
  delivery: "email_invitation";
  userId: string;
  email: string;
}

/**
 * Invites an organizer by email through the `invite-organizer` Edge
 * Function. The function authenticates the caller and provisions the
 * profile/role server-side; the client sends only the recipient's email and
 * optional display name — no role, redirect, or token fields.
 */
export async function inviteOrganizerByEmail(
  email: string,
  displayName?: string
): Promise<CreatedAccount> {
  const { data, error } = await supabase.functions.invoke<InviteOrganizerFunctionResponse>(
    "invite-organizer",
    { body: { email, displayName } }
  );
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string } | null;
        if (body?.error) message = body.error;
      } catch {
        // Response body wasn't JSON; fall back to the generic message.
      }
    }
    throw new Error(message);
  }
  if (!data) throw new Error("The invitation was not sent. Please try again.");
  return {
    delivery: "email_invitation",
    id: data.userId,
    email: data.email,
    role: "organizer",
    display_name: displayName?.trim() || null,
    status: "active",
    created_at: new Date().toISOString(),
  };
}

/**
 * Delivery-aware account creation used by the Admin "create user" flow.
 * Organizer accounts default to a real email invitation; every other role
 * (and Organizer with an explicit temporary-password fallback) keeps using
 * `admin_invite_user`, unchanged.
 */
export async function createUserAccount(userData: CreateUserParams): Promise<CreatedAccount> {
  const wantsEmailInvite = userData.role === "organizer" && userData.delivery !== "temporary_password";
  if (wantsEmailInvite) {
    return inviteOrganizerByEmail(userData.email, userData.display_name);
  }
  const invited = await createUser(userData);
  return { delivery: "temporary_password", ...invited };
}
