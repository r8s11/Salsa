import { supabase } from "../../../lib/supabase";

export interface SendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends an email via the Resend Edge Function.
 *
 * The Resend API key is NOT exposed to the client — it lives in the
 * RESEND_API_KEY secret attached to the `send-email` Edge Function.
 *
 * Before this works:
 *   1. Get your real Resend API key (starts with `re_...`).
 *   2. Replace the placeholder:
 *
 *        echo "RESEND_API_KEY=re_xxxxxxxxx" > /tmp/resend.env
 *        npx supabase functions secrets set RESEND_API_KEY --env-file /tmp/resend.env
 *
 *      (Run this from the repo root with your real key in place of re_xxxxxxxxx.)
 *   3. Deploy the function:
 *
 *        npx supabase functions deploy send-email
 *
 *   4. In production (supabase.com), set the secret in the dashboard:
 *      Project Settings → Functions → Secrets → RESEND_API_KEY
 */
export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke<SendEmailResult>("send-email", {
    body: payload,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data ?? { success: false, error: "No response from email function" };
}
