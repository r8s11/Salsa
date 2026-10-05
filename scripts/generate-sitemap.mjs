import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL_ORIGIN = "https://www.salsasegura.com";
const PUBLIC_URLS = [
  "/",
  "/calendar",
  "/about",
  "/contact",
  "/events/boston",
  "/events/new-york-city",
  "/discover",
  "/series",
  "/organizers",
  "/venues",
  "/schools",
  "/instructors",
  "/cities",
  "/styles",
];

export function buildSitemapXml(events, entities = []) {
  const urls = new Map(PUBLIC_URLS.map((path) => [
    path, `  <url><loc>${CANONICAL_ORIGIN}${path}</loc></url>`,
  ]));
  for (const event of events) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) {
      continue;
    }
    const lastmod = event.updated_at && Number.isFinite(Date.parse(event.updated_at))
      ? `<lastmod>${new Date(event.updated_at).toISOString()}</lastmod>`
      : "";
    const path = `/events/${event.slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(event.slug) ? event.slug : event.id}`;
    urls.set(path, `  <url><loc>${CANONICAL_ORIGIN}${path}</loc>${lastmod}</url>`);
  }
  const routes = { event: "events", series: "series", organizer: "o", venue: "v",
    school: "s", instructor: "i", city: "cities", style: "styles" };
  for (const entity of entities) {
    const route = routes[entity.kind];
    if (!route || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entity.slug ?? "")) continue;
    const path = `/${route}/${entity.slug}`;
    if (!urls.has(path)) urls.set(path, `  <url><loc>${CANONICAL_ORIGIN}${path}</loc></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.values()].join("\n")}\n</urlset>\n`;
}

async function fetchApprovedEvents() {
  const projectUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!projectUrl || !publishableKey) {
    throw new Error("Sitemap generation requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY.");
  }

  const events = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL("/rest/v1/public_events", projectUrl);
    url.searchParams.set("select", "id,slug,updated_at");
    url.searchParams.set("status", "eq.approved");
    const response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${publishableKey}`,
        range: `${offset}-${offset + 999}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Sitemap event query failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Sitemap event query returned an invalid response.");
    events.push(...page);
    if (page.length < 1000) return events;
  }
}

async function fetchPublicEntities() {
  const entities = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(new URL("/rest/v1/rpc/public_entity_directory", process.env.VITE_SUPABASE_URL), {
      method: "POST",
      headers: {
        apikey: process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
        authorization: `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_limit: 100, p_offset: offset }),
    });
    if (!response.ok) throw new Error(`Sitemap entity query failed (${response.status}): ${await response.text()}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Sitemap entity query returned an invalid response.");
    entities.push(...page);
    if (page.length < 100) return entities;
  }
}
async function main() {
  for (const envFile of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }

  const hasProjectUrl = Boolean(process.env.VITE_SUPABASE_URL);
  const hasPublishableKey = Boolean(process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY);
  if (!hasProjectUrl && !hasPublishableKey) return;

  let events = [];
  let entities = [];
  try {
    [events, entities] = await Promise.all([fetchApprovedEvents(), fetchPublicEntities()]);
  } catch (error) {
    console.warn(
      `Sitemap dynamic URLs omitted; using stable routes only: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const output = resolve("dist/sitemap.xml");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, buildSitemapXml(events, entities), "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
