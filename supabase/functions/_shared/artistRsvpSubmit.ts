export type GuestSubmitInput = { event_id: string; name: string; email: string; role: string };
export type GuestSubmitResult = { status: "received"; event_id: string; external_url: string | null } | { status: "rate_limited"; retry_after: number } | { status: "unavailable" };
export interface ArtistRsvpSubmitDependencies {
  secret: string;
  origins: readonly string[];
  submit: (input: GuestSubmitInput, ipKey: string, emailKey: string) => Promise<GuestSubmitResult>;
}
const encoder = new TextEncoder();
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error("too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export function createArtistRsvpSubmit(deps: ArtistRsvpSubmitDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Cache-Control": "no-store", "Vary": "Origin" });
    const respond = (body: object, status: number) => Response.json(body, { status, headers });
    if (origin && !deps.origins.includes(origin)) return respond({ error: "Origin not allowed" }, 403);
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type, authorization, apikey, x-client-info");
    headers.set("Access-Control-Expose-Headers", "Retry-After");
    if (!deps.secret || !deps.origins.length) return respond({ error: "RSVP service unavailable" }, 503);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") { headers.set("Allow", "POST, OPTIONS"); return respond({ error: "Use POST" }, 405); }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return respond({ error: "Use application/json" }, 415);
    const length = request.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) { await request.body?.cancel(); return respond({ error: "Request too large" }, 413); }
    let body: unknown;
    try { body = await boundedJson(request); }
    catch (error) { return respond({ error: "Enter valid RSVP details" }, error instanceof Error && error.message === "too_large" ? 413 : 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ error: "Enter valid RSVP details" }, 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) => !["event_id", "name", "email", "role"].includes(key)) || typeof value.event_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.event_id) || typeof value.name !== "string" || typeof value.email !== "string" || typeof value.role !== "string") return respond({ error: "Enter valid RSVP details" }, 400);
    const input: GuestSubmitInput = { event_id: value.event_id, name: value.name.trim(), email: value.email.trim().toLowerCase(), role: value.role };
    if (!input.name || [...input.name].length > 120 || [...input.email].length > 254 || /[\u0000-\u001f\u007f]/.test(input.name + input.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || !["leader", "follower", "undecided"].includes(input.role)) return respond({ error: "Enter a valid name, email and dance role" }, 400);
    try {
      const key = await crypto.subtle.importKey("raw", encoder.encode(deps.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const digest = async (kind: string, text: string) => Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${kind}:${text}`))), (byte) => byte.toString(16).padStart(2, "0")).join("");
      // Ingress must be probed before release; email/event/site ceilings do not trust this header.
      const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
      const ip = forwarded && forwarded.length <= 256 ? forwarded : "unknown";
      const [ipKey, emailKey] = await Promise.all([digest("ip", ip), digest("email", input.email)]);
      const result = await deps.submit(input, ipKey, emailKey);
      if (result.status === "rate_limited") { headers.set("Retry-After", String(Math.max(1, Math.min(600, result.retry_after)))); return respond({ status: "rate_limited", retry_after: Math.max(1, Math.min(600, result.retry_after)) }, 429); }
      if (result.status === "unavailable") return respond({ status: "unavailable" }, 409);
      return respond({ status: "received", event_id: result.event_id, external_url: result.external_url }, 200);
    } catch { return respond({ error: "RSVP service unavailable. Please try again." }, 503); }
  };
}
