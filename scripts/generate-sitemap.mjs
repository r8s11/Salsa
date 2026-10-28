import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_ORIGIN,
  buildRouteTable,
  fetchApprovedEvents,
  fetchPublicEntities,
  isIndexable,
  loadBuildEnv,
  routeMeta,
  supabaseConfig,
} from "./public-routes.mjs";

export function buildSitemapXml(events, entities = []) {
  const urls = buildRouteTable(routeMeta, events, entities)
    .filter(isIndexable)
    .map((route) => {
      const updatedAt = route.event?.updated_at;
      const lastmod = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? `<lastmod>${new Date(updatedAt).toISOString()}</lastmod>` : "";
      return `  <url><loc>${CANONICAL_ORIGIN}${route.path}</loc>${lastmod}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

async function main() {
  loadBuildEnv();

  let events = [];
  let entities = [];
  try {
    const config = supabaseConfig();
    if (config) [events, entities] = await Promise.all([fetchApprovedEvents(config, "id,slug,updated_at"), fetchPublicEntities(config)]);
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
