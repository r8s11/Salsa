import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createMemberEmailUnsubscribe } from "../_shared/memberEmailUnsubscribe.ts";
if (import.meta.main) {
  Deno.serve(async (request) => {
    const handler = createMemberEmailUnsubscribe(async (token) => {
      const url = Deno.env.get("SUPABASE_URL"),
        key = Deno.env.get("SUPABASE_ANON_KEY");
      if (!url || !key) throw Error("Unsubscribe unavailable");
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.rpc("member_email_unsubscribe", {
        p_token: token,
      });
      if (error) throw Error("Unsubscribe unavailable");
      return data === true;
    });
    return await handler(request);
  });
}
