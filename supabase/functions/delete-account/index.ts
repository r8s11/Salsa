import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type DeletionBlocker = "role" | "event_history" | "organizer" | "operational_history" | "storage" | "unknown";
type Action = "eligibility" | "delete";
type User = { id: string; email?: string | null; app_metadata?: Record<string, unknown> | null };
type AuthResult<T> = { data: T; error: { message?: string } | null };

type CallerClient = {
  auth: { getUser: () => Promise<AuthResult<{ user: User | null }>> };
};

export type ServiceClient = {
  auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message?: string } | null }> } };
  rpc: (
    functionName: "account_deletion_blocker",
    args: { target_user_id: string; target_email: string | null }
  ) => Promise<{ data: string | null; error: { message?: string } | null }>;
};

export type AccountDeletionDependencies = {
  createCallerClient: (authorization: string) => CallerClient;
  createServiceClient: () => ServiceClient;
  findBlocker: (service: ServiceClient, caller: User) => Promise<DeletionBlocker | null>;
  log: (message: string) => void;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

/**
 * The service-only RPC is the authority for every persisted dependency,
 * including Storage's non-public schema. Unknown replies fail closed.
 */
export async function findAccountDeletionBlocker(
  service: ServiceClient,
  caller: User
): Promise<DeletionBlocker | null> {
  try {
    const { data, error } = await service.rpc("account_deletion_blocker", {
      target_user_id: caller.id,
      target_email: caller.email ?? null,
    });
    return error || (data !== null && !isDeletionBlocker(data)) ? "unknown" : data;
  } catch {
    return "unknown";
  }
}

function runtimeDependencies(): AccountDeletionDependencies {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("Supabase public configuration is missing");

  return {
    createCallerClient: (authorization) =>
      createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as CallerClient,
    createServiceClient: () => {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) throw new Error("Supabase service configuration is missing");
      return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as ServiceClient;
    },
    findBlocker: findAccountDeletionBlocker,
    log: (message) => console.error(message),
  };
}

async function actionFor(request: Request): Promise<Action | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || !("action" in body)) return null;
    const { action } = body;
    return action === "eligibility" || action === "delete" ? action : null;
  } catch {
    return null;
  }
}

export function createDeleteAccountHandler(dependencies: AccountDeletionDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Unauthorized" }, 401);

    let callerResult: AuthResult<{ user: User | null }>;
    try {
      callerResult = await dependencies.createCallerClient(authorization).auth.getUser();
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const caller = callerResult.data.user;
    if (callerResult.error || !caller) return json({ error: "Unauthorized" }, 401);

    const action = await actionFor(request);
    if (!action) return json({ error: "Invalid request" }, 400);

    // Only the absence of a trusted scalar role is the regular-user role.
    if (caller.app_metadata?.role !== undefined && caller.app_metadata?.role !== null) {
      return json({ outcome: "blocked", blocker: "role" }, 409);
    }

    let service: ServiceClient;
    try {
      service = dependencies.createServiceClient();
    } catch {
      dependencies.log("delete-account service configuration unavailable");
      return json({ error: "Account deletion is unavailable right now. Please try again." }, 503);
    }

    let blocker: DeletionBlocker | null;
    try {
      blocker = await dependencies.findBlocker(service, caller);
    } catch {
      dependencies.log("delete-account dependency inspection failed");
      return json({ outcome: "blocked", blocker: "unknown" }, 409);
    }
    if (blocker) return json({ outcome: "blocked", blocker }, 409);
    if (action === "eligibility") return json({ outcome: "eligible" });

    try {
      const { error: deletionError } = await service.auth.admin.deleteUser(caller.id);
      if (deletionError) {
        dependencies.log("delete-account Auth deletion failed");
        return json({ error: "Account deletion could not be completed. Please try again." }, 503);
      }
    } catch {
      dependencies.log("delete-account Auth deletion failed");
      return json({ error: "Account deletion could not be completed. Please try again." }, 503);
    }

    return json({ outcome: "deleted" });
  };
}

if (import.meta.main) {
  serve((request) => createDeleteAccountHandler(runtimeDependencies())(request));
}
