/// <reference types="npm:@types/node" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { json } from "https://esm.sh/@supabase/functions-js@0.5.0/src/utilities.ts";

interface EmailRequest {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return json(
      { error: "RESEND_API_KEY environment variable is not set" },
      500,
    );
  }

  let body: EmailRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { from, to, subject, html, replyTo } = body;
  if (!from || !to || !subject || !html) {
    return json(
      { error: "Missing required fields: from, to, subject, html" },
      400,
    );
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ success: true, id: data?.id }, 200);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("Resend error:", err);
    return json({ error: message }, 500);
  }
});

/*
  Required setup — DO THIS BEFORE DEPLOYING:

  1. In your Resend dashboard, create an API key and copy it.
  2. Set it as a local secret so your placeholder below is replaced with the real key:

       npx supabase functions secrets set RESEND_API_KEY --env-file <(.envrc; or echo 'RESEND_API_KEY=re_your_real_key_here')

     Or interactively:
       npx supabase functions secrets set RESEND_API_KEY --project-ref <your-ref>

  3. Replace the placeholder below by running (from the repo root):

       echo "RESEND_API_KEY=re_xxxxxxxxx" > /tmp/resend.env
       npx supabase functions secrets set RESEND_API_KEY --env-file /tmp/resend.env

  ⚠️  Do NOT hardcode your real Resend key in this file. The key lives in
       the RESEND_API_KEY secret and is read at runtime via Deno.env.get().
*/
