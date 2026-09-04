import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  type EmailInviteSuccess,
  type InviteOrganizerRequest,
  inviteRedirectUrl,
  isAllowedInviteRedirect,
  normalizeDisplayName,
  normalizeEmail,
} from "../_shared/invitation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type User = { id: string; app_metadata?: Record<string, unknown> | null };
type AuthError = {
  message?: string;
  msg?: string;
  code?: string;
  error_code?: string;
};
type AuthResult<T> = { data: T; error: AuthError | null };
type TableResult = { error: { message?: string } | null };

type CallerClient = {
  auth: { getUser: () => Promise<AuthResult<{ user: User | null }>> };
};

export type ServiceClient = {
  auth: {
    admin: {
      inviteUserByEmail: (
        email: string,
        options: { redirectTo: string; data: { display_name?: string } },
      ) => Promise<AuthResult<{ user: User | null }>>;
      updateUserById: (
        id: string,
        attributes: { app_metadata: Record<string, unknown> },
      ) => Promise<AuthResult<{ user: User | null }>>;
      deleteUser: (
        id: string,
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
  from: (table: "profiles" | "audit_logs") => {
    upsert: (values: Record<string, unknown>) => Promise<TableResult>;
    insert: (values: Record<string, unknown>) => Promise<TableResult>;
    delete: () => {
      eq: (column: string, value: string) => Promise<TableResult>;
    };
  };
};

export type InviteOrganizerDependencies = {
  createCallerClient: (authorization: string) => CallerClient;
  createServiceClient: () => ServiceClient;
  redirectUrl: string;
  log: (message: string, details: Record<string, string>) => void;
};

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

function isDuplicateInviteError(authError: AuthError | null): boolean {
  if (!authError) return false;

  const duplicateCode = "email_exists";
  if (
    authError.code?.toLowerCase() === duplicateCode ||
    authError.error_code?.toLowerCase() === duplicateCode
  ) {
    return true;
  }

  const duplicateMessage =
    "a user with this email address has already been registered";
  return (
    authError.message?.toLowerCase() === duplicateMessage ||
    authError.msg?.toLowerCase() === duplicateMessage
  );
}

function runtimeDependencies(): InviteOrganizerDependencies {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase public configuration is missing");
  }

  // Optional override for the invite confirmation redirect URL. Defaults are already correct
  // per environment (`ENVIRONMENT=local|production`) via `inviteRedirectUrl()`; this env var
  // exists only for exceptional cases. It is validated below via `isAllowedInviteRedirect()`
  // and MUST exactly match one of the two hardcoded allowed URLs or the request fails with 500.
  const configuredRedirect = Deno.env.get("INVITE_REDIRECT_URL");
  const redirectUrl = configuredRedirect ?? inviteRedirectUrl(
    Deno.env.get("ENVIRONMENT") === "production" ? "production" : "local",
  );

  return {
    createCallerClient: (authorization) =>
      createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as CallerClient,
    // The service-role key is deliberately read only when the request has passed
    // the caller authentication and authorization boundary.
    createServiceClient: () => {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) {
        throw new Error("Supabase service configuration is missing");
      }
      return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as ServiceClient;
    },
    redirectUrl,
    log: (message, details) => console.error(message, details),
  };
}

async function compensate(
  service: ServiceClient,
  userId: string,
  log: InviteOrganizerDependencies["log"],
): Promise<void> {
  const [profileResult, userResult] = await Promise.allSettled([
    service.from("profiles").delete().eq("id", userId),
    service.auth.admin.deleteUser(userId),
  ]);
  if (profileResult.status !== "fulfilled" || profileResult.value.error) {
    log("invite-organizer profile compensation failed", { userId });
  }
  if (userResult.status !== "fulfilled" || userResult.value.error) {
    log("invite-organizer Auth compensation failed", { userId });
  }
}

export function createInviteOrganizerHandler(
  dependencies: InviteOrganizerDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") return error("Method not allowed", 405);

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return error("Unauthorized", 401);
    }

    let callerResult: AuthResult<{ user: User | null }>;
    try {
      callerResult = await dependencies.createCallerClient(authorization).auth
        .getUser();
    } catch {
      return error("Unauthorized", 401);
    }
    const caller = callerResult.data.user;
    if (callerResult.error || !caller) return error("Unauthorized", 401);
    if (caller.app_metadata?.role !== "admin") return error("Forbidden", 403);
    if (!isAllowedInviteRedirect(dependencies.redirectUrl)) {
      dependencies.log("invite-organizer invalid redirect configuration", {
        userId: caller.id,
      });
      return error("Invitation service is unavailable", 500);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Invalid JSON body", 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return error("A valid email address is required", 400);
    }
    const invite = body as InviteOrganizerRequest;
    const email = normalizeEmail(invite.email);
    if (!email) return error("A valid email address is required", 400);
    const displayName = invite.displayName === undefined
      ? null
      : normalizeDisplayName(invite.displayName);
    if (invite.displayName !== undefined && !displayName) {
      return error("Display name is invalid", 400);
    }

    let service: ServiceClient;
    try {
      service = dependencies.createServiceClient();
    } catch {
      dependencies.log("invite-organizer service configuration unavailable", {
        userId: caller.id,
      });
      return error("Invitation service is unavailable", 500);
    }

    let invitation: AuthResult<{ user: User | null }>;
    try {
      invitation = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: dependencies.redirectUrl,
        data: displayName ? { display_name: displayName } : {},
      });
    } catch {
      dependencies.log("invite-organizer Auth invitation failed", {
        userId: caller.id,
      });
      return error("Unable to send invitation; please try again", 500);
    }
    if (invitation.error || !invitation.data.user) {
      if (isDuplicateInviteError(invitation.error)) {
        return error("An account already exists for this email", 409);
      }
      dependencies.log("invite-organizer Auth invitation failed", {
        userId: caller.id,
      });
      return error("Unable to send invitation; please try again", 500);
    }

    const invited = invitation.data.user;
    try {
      const update = await service.auth.admin.updateUserById(invited.id, {
        app_metadata: { ...(invited.app_metadata ?? {}), role: "organizer" },
      });
      if (update.error) throw new Error("Could not assign organizer role");

      const profile = await service.from("profiles").upsert({
        id: invited.id,
        display_name: displayName,
        role: "organizer",
        status: "active",
      });
      if (!profile || profile.error) {
        throw new Error("Could not provision organizer profile");
      }

      const audit = await service.from("audit_logs").insert({
        actor_id: caller.id,
        action: "user.invited",
        entity_type: "profile",
        entity_id: invited.id,
        metadata: { email, role: "organizer" },
      });
      if (!audit || audit.error) {
        throw new Error("Could not write invitation audit record");
      }
    } catch {
      dependencies.log("invite-organizer provisioning failed", {
        userId: invited.id,
      });
      await compensate(service, invited.id, dependencies.log);
      return error("Unable to send invitation; please try again", 500);
    }

    const response: EmailInviteSuccess = {
      delivery: "email_invitation",
      userId: invited.id,
      email,
    };
    return json(response, 200);
  };
}

if (import.meta.main) {
  serve((request) =>
    createInviteOrganizerHandler(runtimeDependencies())(request)
  );
}
