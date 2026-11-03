import { app } from "@azure/functions";
import aliases from "../lib/metroAliases.json" with { type: "json" };
import { injectMeta, noindexShell, parseItineraryPath } from "../lib/itineraryMeta.mjs";

const DEFAULT_ORIGIN = "https://www.salsasegura.com";
const headers = { "Content-Type": "text/html; charset=utf-8" };

/** Dependencies are injectable for direct handler tests; only the public projection is read. */
export function createItineraryPage({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  let shellPromise;
  const siteUrl = new URL(env.ITINERARY_SITE_ORIGIN || DEFAULT_ORIGIN);
  if (!["http:", "https:"].includes(siteUrl.protocol)) throw new Error("ITINERARY_SITE_ORIGIN must be an HTTP(S) origin");
  const origin = siteUrl.origin;

  function getShell() {
    if (!shellPromise) {
      shellPromise = fetchImpl(`${origin}/index.html`, { redirect: "error" }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load itinerary HTML shell");
        return response.text();
      }).catch((error) => {
        shellPromise = undefined;
        throw error;
      });
    }
    return shellPromise;
  }

  return async function itineraryPageHandler(request, context) {
    let shell;
    const unavailable = (status) => ({
      status,
      headers: { ...headers, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, follow" },
      body: noindexShell(shell, {
        title: status === 404 ? "Itinerary not found | Salsa Segura" : "Itinerary temporarily unavailable | Salsa Segura",
        description: status === 404 ? "This itinerary is not available." : "Please try again shortly.",
        url: `${origin}/`,
      }),
    });

    try {
      shell = await getShell();
    } catch {
      context?.error?.("Unable to fetch itinerary HTML shell");
      return {
        status: 503,
        headers: { ...headers, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, follow" },
        body: '<!doctype html><html><head><meta name="robots" content="noindex, follow"><title>Temporarily unavailable</title></head><body>Please try again shortly.</body></html>',
      };
    }

    let path;
    try {
      // Azure supplies the original rewritten URL. SWA CLI can retain it only in request.url.
      const original = request.headers.get("x-ms-original-url") ?? request.url;
      path = parseItineraryPath(new URL(original, origin).pathname, aliases);
    } catch {
      return unavailable(404);
    }
    if (!path) return unavailable(404);

    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error("Missing Supabase runtime settings");
      const endpoint = new URL("rest/v1/public_itineraries", `${env.SUPABASE_URL.replace(/\/+$/, "")}/`);
      endpoint.search = new URLSearchParams({
        city: `eq.${path.city}`,
        week_start: `eq.${path.weekStart}`,
        select: "title,description,cover_image_url,city,week_start",
      }).toString();
      const result = await fetchImpl(endpoint.toString(), {
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
        cache: "no-store",
        redirect: "error",
      });
      if (!result.ok) throw new Error("Published itinerary lookup failed");
      const rows = await result.json();
      if (!Array.isArray(rows) || rows.length > 1) throw new Error("Invalid published itinerary response");
      if (rows.length === 0) return unavailable(404);
      const row = rows[0];
      if (!row || row.city !== path.city || row.week_start !== path.weekStart ||
          typeof row.title !== "string" || (row.description !== null && typeof row.description !== "string") ||
          (row.cover_image_url !== null && typeof row.cover_image_url !== "string")) {
        throw new Error("Invalid published itinerary metadata");
      }
      return {
        status: 200,
        headers: { ...headers, "Cache-Control": "no-cache" },
        body: injectMeta(shell, {
          title: row.title,
          description: row.description ?? `Your dance itinerary for the week of ${path.weekStart}.`,
          url: `${origin}/itineraries/${encodeURIComponent(path.city)}/${path.weekStart}`,
          image: row.cover_image_url,
        }),
      };
    } catch {
      context?.error?.("Unable to read published itinerary metadata");
      return unavailable(503);
    }
  };
}

export const itineraryPage = createItineraryPage();

app.http("itinerary-page", {
  route: "itinerary-page",
  methods: ["GET", "HEAD"],
  authLevel: "anonymous",
  handler: itineraryPage,
});
