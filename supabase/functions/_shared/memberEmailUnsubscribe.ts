import { escapeHtml } from "./emailLayout.ts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createMemberEmailUnsubscribe(
  unsubscribe: (token: string) => Promise<boolean>,
) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
    };
    const page = (text: string, status = 200) =>
      new Response(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly digest</title><main>' +
          text + "</main></html>",
        { status, headers },
      );
    if (!["GET", "POST"].includes(request.method)) {
      return page("Method not allowed", 405);
    }
    const url = new URL(request.url), token = url.searchParams.get("t") ?? "";
    if (!UUID.test(token)) return page("Invalid unsubscribe link.", 400);
    if (request.method === "GET") {
      return page(
        '<h1>Unsubscribe from the weekly digest?</h1><p>Account, security and submission emails are unaffected.</p><form method="post" action="' +
          escapeHtml(url.pathname + "?t=" + token) +
          '"><button name="confirm" value="unsubscribe">Unsubscribe</button></form>',
      );
    }
    try {
      const reader = request.body?.getReader();
      let body = "";
      let bytes = 0;
      const decoder = new TextDecoder();
      if (reader) {
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.length;
            if (bytes > 1024) {
              await reader.cancel();
              return page("Request too large.", 413);
            }
            body += decoder.decode(chunk.value, { stream: true });
          }
          body += decoder.decode();
        } finally {
          reader.releaseLock();
        }
      }
      const form = new URLSearchParams(body);
      if (
        form.get("confirm") !== "unsubscribe" &&
        form.get("List-Unsubscribe") !== "One-Click"
      ) return page("Confirm unsubscribe using the form.", 400);
      if (!await unsubscribe(token)) {
        return page("Invalid unsubscribe link.", 400);
      }
      return page("<h1>You're unsubscribed from the weekly digest.</h1>");
    } catch {
      return page(
        "Unsubscribe is temporarily unavailable. Please try again.",
        503,
      );
    }
  };
}
