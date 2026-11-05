// The one definition of "public route" for the build: sitemap.xml and the
// prerendered HTML both come from buildRouteTable(), so a URL can never be in
// one and missing from the other. Stable routes live in
// src/shared/seo/routeMeta.json; dynamic routes come from the same public
// Supabase contracts the app reads (the public_events projection and the
// public_entity_directory RPC), through the publishable key only.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CANONICAL_ORIGIN = "https://www.salsasegura.com";

export const routeMeta = JSON.parse(readFileSync(resolve("src/shared/seo/routeMeta.json"), "utf8"));

/** Public entity kinds: URL prefix (mirrors ENTITY_PATHS in src/features/entities/model.ts) and display label. */
export const ENTITY_KINDS = {
  series: { prefix: "series", label: "Series" },
  organizer: { prefix: "o", label: "Organizer" },
  venue: { prefix: "v", label: "Venue" },
  school: { prefix: "s", label: "School" },
  instructor: { prefix: "i", label: "Instructor" },
  dj: { prefix: "dj", label: "DJ" },
  city: { prefix: "cities", label: "City" },
  style: { prefix: "styles", label: "Dance style" },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_KEYS = ["calendar", "about", "contact", "submit", "lessons"];
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];
const EVENT_PAGE_SIZE = 200;
const ENTITY_PAGE_SIZE = 100;
const MAX_EVENTS = 20_000;
const MAX_ENTITIES_PER_KIND = 5_000;

export const isSafeSlug = (value) => typeof value === "string" && SLUG.test(value);

/** Canonical event path: the slug when it is URL-safe, else the UUID. Null for rows that cannot be routed. */
export function eventPath(event) {
  if (typeof event?.id !== "string" || !UUID.test(event.id)) return null;
  return `/events/${isSafeSlug(event.slug) ? event.slug : event.id}`;
}

export function entityPath(entity) {
  const kind = typeof entity?.kind === "string" && Object.hasOwn(ENTITY_KINDS, entity.kind) ? ENTITY_KINDS[entity.kind] : null;
  return kind && isSafeSlug(entity.slug) ? `/${kind.prefix}/${entity.slug}` : null;
}

/** Stable routes in sitemap order. `type` selects the page renderer; `robots` is only set when not indexable. */
export function publicRoutes(meta) {
  return [
    { ...meta.home, type: "home" },
    ...PAGE_KEYS.map((key) => ({ ...meta[key], type: key === "calendar" ? "calendar" : "page" })),
    ...meta.prerenderedMetros.map(({ slug, name }) => ({
      path: `/events/${slug}`,
      type: "metro",
      metro: slug,
      name,
      title: meta.metroHome.title.replace("{city}", name),
      description: meta.metroHome.description.replace("{city}", name),
    })),
    ...meta.directories.map((directory) => ({ ...directory, type: "directory" })),
  ];
}

export const isIndexable = (route) => !/noindex/i.test(route.robots ?? "");

/**
 * Every public route, deduplicated by path. Stable routes win over dynamic
 * ones (the app's router resolves a metro name before an event slug), and the
 * first record wins among dynamic ones.
 */
export function buildRouteTable(meta, events = [], entities = []) {
  const routes = new Map(publicRoutes(meta).map((route) => [route.path, route]));
  for (const event of events) {
    const path = eventPath(event);
    if (path && !routes.has(path)) routes.set(path, { path, type: "event", event });
  }
  for (const entity of entities) {
    const path = entityPath(entity);
    if (path && !routes.has(path)) routes.set(path, { path, type: "entity", entity });
  }
  return [...routes.values()];
}

export function loadBuildEnv() {
  for (const envFile of ENV_FILES) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
}

/** Null when Supabase is not configured at all; a half-configured build is an error, not a quiet skip. */
export function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY, or neither.");
  return { url, key };
}

export async function supabaseJson(config, label, pathname, { params, body } = {}) {
  const url = new URL(pathname, config.url);
  if (params) url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      ...(body && { "content-type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function fetchAllPages(label, pageSize, maxRows, fetchPage) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset);
    if (!Array.isArray(page)) throw new Error(`${label} returned an invalid response.`);
    rows.push(...page);
    if (rows.length > maxRows) throw new Error(`${label} returned more than the ${maxRows}-row build limit.`);
    if (page.length < pageSize) return rows;
  }
}

/** Approved events from the public_events projection, in a stable order so pages never skip or repeat rows. */
export function fetchApprovedEvents(config, select) {
  return fetchAllPages("Event query", EVENT_PAGE_SIZE, MAX_EVENTS, (offset) =>
    supabaseJson(config, "Event query", "/rest/v1/public_events", {
      params: {
        select,
        status: "eq.approved",
        order: "event_date.asc,id.asc",
        limit: String(EVENT_PAGE_SIZE),
        offset: String(offset),
      },
    }),
  );
}

/** Every active public entity (all kinds except events) from the public_entity_directory RPC. */
export async function fetchPublicEntities(config) {
  const entities = [];
  for (const kind of Object.keys(ENTITY_KINDS)) {
    entities.push(
      ...(await fetchAllPages(`Entity directory (${kind})`, ENTITY_PAGE_SIZE, MAX_ENTITIES_PER_KIND, (offset) =>
        supabaseJson(config, `Entity directory (${kind})`, "/rest/v1/rpc/public_entity_directory", {
          body: { p_kind: kind, p_limit: ENTITY_PAGE_SIZE, p_offset: offset },
        }),
      )),
    );
  }
  return entities;
}
