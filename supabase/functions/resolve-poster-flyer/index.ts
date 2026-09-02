// @ts-nocheck - Deno Edge Function; Vite build excludes supabase directory
const withSupabase = (
  _opts: unknown,
  handler: (req: Request, ctx: unknown) => Promise<Response>,
) => (req: Request) => handler(req, {});

declare const Deno: { env: { get(name: string): string | undefined } };



const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;
const UNAVAILABLE_MESSAGE = "Flyer source cannot be used for sharing.";

export type PosterFlyerResponse =
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "unavailable"; message: string };

export type PosterEventRecord = {
  id: string;
  status: string;
  image_url: string | null;
  poster_image_url: string | null;
};

export type ResolvePosterFlyerDependencies = {
  getEvent: (eventId: string) => Promise<PosterEventRecord | null>;
  getPublicUrl: (path: string) => string;
  uploadCache: (
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<{ error: { message?: string } | null }>;
  updatePosterUrl: (
    eventId: string,
    publicUrl: string,
  ) => Promise<{ error: { message?: string } | null }>;
  fetchImage: (url: string, init?: RequestInit) => Promise<Response>;
  log: (message: string) => void;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isIpLiteral(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.includes(":")) return true;
  return false;
}

function validateSourceUrl(urlString: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return "invalid url";
  }
  if (parsed.protocol !== "https:") return "not https";
  if (parsed.username || parsed.password) return "credentials in url";
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "localhost";
  if (isIpLiteral(hostname)) return "ip literal";
  return null;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

async function hashSourceUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createResolvePosterFlyerHandler(
  dependencies: ResolvePosterFlyerDependencies,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body: unknown;
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    let eventId = "";
    if (body !== null && typeof body === "object" && "eventId" in body) {
      const candidate = (body as { eventId?: unknown }).eventId;
      if (typeof candidate === "string") eventId = candidate.trim();
    }

    if (!eventId) {
      return json({ error: "eventId is required" }, 400);
    }

    let event: PosterEventRecord | null;
    try {
      event = await dependencies.getEvent(eventId);
    } catch (err) {
      dependencies.log(`poster flyer getEvent failed: ${String(err)}`);
      return json({ error: "Unable to prepare poster image" }, 500);
    }

    if (!event || event.status !== "approved") {
      return json({ error: "Event not found" }, 404);
    }

    if (event.poster_image_url) {
      return json({ status: "ready", url: event.poster_image_url }, 200);
    }

    if (!event.image_url) {
      return json({ status: "missing" }, 200);
    }

    const initialValidation = validateSourceUrl(event.image_url);
    if (initialValidation) {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    let currentUrl = event.image_url;
    let response: Response | null = null;

    for (let redirects = 0; redirects <= 3; redirects++) {
      if (redirects > 0) {
        const redirectValidation = validateSourceUrl(currentUrl);
        if (redirectValidation) {
          return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
        }
      }

      try {
        response = await dependencies.fetchImage(currentUrl, { redirect: "manual" });
      } catch {
        return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
        }
        if (redirects === 3) {
          return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
        }
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
        }
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    const contentTypeRaw = response.headers.get("content-type") ?? "";
    const mime = contentTypeRaw.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    let bytes: Uint8Array;
    try {
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } catch {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return json({ status: "unavailable", message: UNAVAILABLE_MESSAGE }, 422);
    }

    const hash = await hashSourceUrl(currentUrl);
    const ext = mimeToExt(mime);
    const path = `poster-cache/${event.id}/${hash}.${ext}`;

    const uploadResult = await dependencies.uploadCache(path, bytes, mime);
    if (uploadResult.error) {
      dependencies.log(`poster cache upload failed: ${uploadResult.error.message ?? "unknown"}`);
      return json({ error: "Unable to prepare poster image" }, 500);
    }

    const publicUrl = dependencies.getPublicUrl(path);

    const updateResult = await dependencies.updatePosterUrl(event.id, publicUrl);
    if (updateResult.error) {
      dependencies.log(`poster url update failed: ${updateResult.error.message ?? "unknown"}`);
      return json({ error: "Unable to prepare poster image" }, 500);
    }

    return json({ status: "ready", url: publicUrl }, 200);
  };
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): ResolvePosterFlyerDependencies {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  return {
    getEvent: async (eventId: string) => {
      const url = `${supabaseUrl}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=id,status,image_url,poster_image_url`;
      const res = await fetch(url, {
        headers: { ...authHeaders, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`getEvent failed: ${res.status}`);
      const data = (await res.json()) as PosterEventRecord[];
      return data[0] ?? null;
    },
    getPublicUrl: (path: string) => {
      const url = supabaseUrl.replace(/\/$/, "");
      return `${url}/storage/v1/object/public/event-flyers/${path}`;
    },
    uploadCache: async (path: string, bytes: Uint8Array, contentType: string) => {
      const url = `${supabaseUrl}/storage/v1/object/event-flyers/${path}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": contentType, "x-upsert": "false" },
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: { message: text || `upload failed: ${res.status}` } };
      }
      return { error: null };
    },
    updatePosterUrl: async (eventId: string, publicUrl: string) => {
      const url = `${supabaseUrl}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ poster_image_url: publicUrl }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: { message: text || `update failed: ${res.status}` } };
      }
      return { error: null };
    },
    fetchImage: (url: string, init?: RequestInit) => fetch(url, init),
    log: (message: string) => console.error(message),
  };
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req: Request) => {
    const deps = runtimeDependencies();
    const handler = createResolvePosterFlyerHandler(deps);
    return handler(req);
  }),
};
