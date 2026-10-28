// Build-time prerender of every public route in the sitemap. Each route gets
// dist/<path>/index.html: the built shell with that route's own title,
// description, canonical, robots and social tags, plus real page content
// inside #app. Static hosts (Azure Static Web Apps, nginx `try_files $uri
// $uri/index.html`) serve these route indexes before the SPA fallback, so
// crawlers and link-preview bots read the route's own HTML without JavaScript.
// With JavaScript, React's createRoot replaces the contents of #app, so the
// static markup is only what loads first.
//
// The homepage is prerendered too. It remains the SPA fallback; private and
// unknown paths contain no private data in their static response and resolve
// through the existing client router. The <noscript> guide is kept on every
// route, minus the intro that #app supplies.
//
// Content comes from the same public Supabase contracts as the app (the
// public_events projection, public_entity_directory and public_entity_detail)
// via the publishable key, fetched once per build. The pages are a snapshot:
// an event added, edited or removed after the build appears only after the
// next build, until the app loads and fetches live data. Rebuild on a
// schedule (or on event approval) to bound that staleness. If Supabase is
// configured and any fetch fails, the build fails; without any configuration
// only the stable routes are prerendered.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_ORIGIN,
  ENTITY_KINDS,
  buildRouteTable,
  entityPath,
  eventPath,
  fetchApprovedEvents,
  fetchPublicEntities,
  loadBuildEnv,
  routeMeta,
  supabaseConfig,
  supabaseJson,
} from "./public-routes.mjs";

const TIME_ZONE = "America/New_York";
const LIST_LIMIT = 50;
const PAST_LIMIT = 10;
const DETAIL_CONCURRENCY = 8;
const DESCRIPTION_LIMIT = 300;
const EVENT_FIELDS = [
  "id", "slug", "title", "description", "event_type", "event_types", "event_date", "location", "address", "city", "host",
  "price_type", "price_amount", "rsvp_link", "image_url", "image_urls", "poster_image_url", "public_entities",
].join(",");
const EVENT_TYPE_LABELS = { social: "Social", class: "Class", workshop: "Workshop", live_music: "Live Music", concert: "Concert" };

const shortWhen = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
const fullWhen = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" });
const asOfDay = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "long", day: "numeric", year: "numeric" });

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** JSON for an inline <script>: no character in the output can close the tag or start a comment. */
const jsonLd = (value) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** Only http(s) URLs may become links or image sources; user-supplied javascript:/data: values are dropped. */
function httpUrl(value) {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

const paragraphs = (value) =>
  text(value)
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");

function metaDescription(value, fallback) {
  const flat = text(value).replace(/\s+/g, " ");
  if (!flat) return fallback;
  return flat.length <= DESCRIPTION_LIMIT ? flat : `${flat.slice(0, DESCRIPTION_LIMIT).replace(/\s+\S*$/, "")}…`;
}

const hasDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const usableEvent = (event) => Boolean(eventPath(event) && text(event.title) && hasDate(event.event_date));
const byName = (a, b) => text(a.name).localeCompare(text(b.name));
const link = (href, label) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
const section = (heading, items) => (items.length ? `<h2>${escapeHtml(heading)}</h2><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : "");

function eventItem(event) {
  const place = text(event.location) ? ` · ${escapeHtml(text(event.location))}` : "";
  return `${link(eventPath(event), event.title)} · <time datetime="${escapeHtml(event.event_date)}">${escapeHtml(shortWhen.format(new Date(event.event_date)))}</time>${place}`;
}

const eventItems = (events, limit = LIST_LIMIT) => events.filter(usableEvent).slice(0, limit).map(eventItem);

/** A linked name when the reference is routable, plain text otherwise. */
function refLink(ref) {
  if (!text(ref?.name)) return "";
  const path = entityPath(ref);
  return path ? link(path, ref.name) : escapeHtml(ref.name);
}

const refLinks = (refs) => (Array.isArray(refs) ? refs : []).map(refLink).filter(Boolean).join(", ");

function locationLine(entity) {
  return [text(entity.address), text(entity.city).replace(/-/g, " "), text(entity.state_region), text(entity.country)].filter(Boolean).join(", ");
}

const pageMain = (heading, ...parts) =>
  `<main style="max-width: 960px; margin: 0 auto; padding: 32px"><h1>${escapeHtml(heading)}</h1>${parts.join("")}</main>`;

const asOfNote = (data) => (data.loaded ? `<p>Details as of ${escapeHtml(asOfDay.format(data.builtAt))}. Current details load when JavaScript is enabled.</p>` : "");

function exploreLinks(data) {
  const metros = routeMeta.prerenderedMetros.map((metro) => link(`/events/${metro.slug}`, `${metro.name} salsa & bachata events`));
  return section("Explore", [link("/calendar", "Dance event calendar"), ...metros, link("/discover", "Discover dance communities")]);
}

function upcomingEvents(data, filter = () => true) {
  return data.events.filter((event) => usableEvent(event) && Date.parse(event.event_date) >= data.builtAt.getTime() && filter(event));
}

function eventStructuredData(event, path) {
  const images = [...new Set((event.image_urls?.length ? event.image_urls : [event.image_url]).map(httpUrl).filter(Boolean))].slice(0, 5);
  const rsvp = httpUrl(event.rsvp_link);
  const knownPrice = event.price_type === "free" || (event.price_type === "paid" && typeof event.price_amount === "number");
  const venue = text(event.location);
  const organizer = event.public_entities?.organizer;
  const organizerUrl = entityPath(organizer);
  return {
    "@context": "https://schema.org",
    "@type": "DanceEvent",
    name: event.title,
    ...(text(event.description) && { description: text(event.description) }),
    startDate: event.event_date,
    url: `${CANONICAL_ORIGIN}${path}`,
    ...(images.length && { image: images }),
    eventStatus: "https://schema.org/EventScheduled",
    ...(venue && {
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: venue,
        ...(text(event.address) && { address: { "@type": "PostalAddress", streetAddress: text(event.address) } }),
      },
    }),
    ...(text(organizer?.name) && {
      organizer: { "@type": "Organization", name: organizer.name, ...(organizerUrl && { url: `${CANONICAL_ORIGIN}${organizerUrl}` }) },
    }),
    ...(rsvp && knownPrice && {
      offers: { "@type": "Offer", url: rsvp, price: event.price_type === "free" ? 0 : event.price_amount, priceCurrency: "USD" },
    }),
  };
}

function eventPage(event, data) {
  if (!usableEvent(event)) throw new Error(`Prerender: event ${event.id} has no title or a missing/invalid event_date.`);
  const path = eventPath(event);
  const related = event.public_entities ?? {};
  const when = new Date(event.event_date);
  const venue = text(related.venue?.name) ? refLink(related.venue) : escapeHtml(text(event.location));
  const host = text(related.organizer?.name) ? refLink(related.organizer) : escapeHtml(text(event.host));
  const types = [...new Set(event.event_types?.length ? event.event_types : [event.event_type])].filter((type) => Object.hasOwn(EVENT_TYPE_LABELS, type)).map((type) => EVENT_TYPE_LABELS[type]);
  const price =
    event.price_type === "free" ? "Free"
    : event.price_type === "paid" && typeof event.price_amount === "number"
      ? `$${Number.isInteger(event.price_amount) ? event.price_amount : event.price_amount.toFixed(2)}`
      : "";
  const rsvp = httpUrl(event.rsvp_link);
  const facts = [
    ["When", `<time datetime="${escapeHtml(event.event_date)}">${escapeHtml(fullWhen.format(when))}</time>`],
    ["Type", escapeHtml(types.join(", "))],
    ["Where", [venue, escapeHtml(text(event.address))].filter(Boolean).join(", ")],
    ["City", refLink(related.city)],
    ["Hosted by", host],
    ["Price", escapeHtml(price)],
    ["Series", refLink(related.series)],
    ["Schools", refLinks(related.schools?.length ? related.schools : [related.school])],
    ["Instructors", refLinks(related.instructors)],
    ["DJs", refLinks(related.djs)],
    ["Dance styles", refLinks(related.styles)],
  ].filter(([, value]) => value);
  const backLink = `<p>${link("/calendar", "Back to the dance calendar")}</p>`;
  return {
    path,
    title: event.title,
    description: metaDescription(
      event.description,
      `${event.title}, ${shortWhen.format(when)}${text(event.location) ? ` at ${text(event.location)}` : ""}. Salsa, bachata, and Latin dance on Salsa Segura.`,
    ),
    image: [event.image_url, event.poster_image_url].map(httpUrl).find(Boolean),
    eventJsonLd: jsonLd(eventStructuredData(event, path)),
    body: pageMain(
      event.title,
      `<ul>${facts.map(([label, value]) => `<li>${label}: ${value}</li>`).join("")}</ul>`,
      paragraphs(event.description),
      rsvp ? `<p><a href="${escapeHtml(rsvp)}" rel="nofollow noopener noreferrer">RSVP or get tickets</a></p>` : "",
      asOfNote(data),
      backLink,
    ),
  };
}

function entityPage(route, detail, data) {
  const { entity, upcoming, past, related } = detail;
  const kind = ENTITY_KINDS[entity.kind];
  const website = httpUrl(entity.website);
  const where = locationLine(entity);
  const directory = routeMeta.directories.find((item) => item.kind === entity.kind);
  const items = (events, limit) => (Array.isArray(events) ? events : []).filter(usableEvent).slice(0, limit).map(eventItem);
  return {
    path: route.path,
    title: entity.name,
    description: metaDescription(
      entity.description,
      `Find ${kind.label.toLowerCase()} information and related dance events on Salsa Segura.`,
    ),
    image: httpUrl(entity.image_url),
    body: pageMain(
      entity.name,
      `<p>${escapeHtml(kind.label)}${where ? ` · ${escapeHtml(where)}` : ""}</p>`,
      paragraphs(entity.description),
      website ? `<p><a href="${escapeHtml(website)}" rel="noopener noreferrer">Website</a></p>` : "",
      section("Upcoming events", items(upcoming, LIST_LIMIT)),
      section("Past events", items(past, PAST_LIMIT)),
      section(
        "Related",
        (Array.isArray(related) ? related : [])
          .filter((ref) => entityPath(ref) && text(ref.name))
          .slice(0, LIST_LIMIT)
          .map((ref) => `${refLink(ref)} · ${escapeHtml(ENTITY_KINDS[ref.kind].label)}`),
      ),
      directory ? `<p>${link(directory.path, directory.title)}</p>` : "",
      asOfNote(data),
    ),
  };
}

function stablePage(route, data) {
  const base = { path: route.path, title: route.title, description: route.description, robots: route.robots };
  switch (route.type) {
    case "home":
    case "calendar":
      return {
        ...base,
        body: pageMain(route.title, `<p>${escapeHtml(route.description)}</p>`,
          section("Upcoming events", data.loaded ? eventItems(upcomingEvents(data)) : []), asOfNote(data), exploreLinks(data)),
      };
    case "metro": {
      const events = data.loaded ? eventItems(upcomingEvents(data, (event) => event.city === route.metro)) : [];
      return {
        ...base,
        body: pageMain(route.title, `<p>${escapeHtml(route.description)}</p>`,
          data.loaded && !events.length ? `<p>No upcoming ${escapeHtml(route.name)} events are listed right now.</p>` : section("Upcoming events", events),
          asOfNote(data), exploreLinks(data)),
      };
    }
    case "directory": {
      if (!route.kind) {
        const counts = (kind) => data.entities.filter((entity) => entity.kind === kind && entityPath(entity)).length;
        const directories = routeMeta.directories
          .filter((directory) => directory.kind)
          .map((directory) => `${link(directory.path, directory.title)}${data.loaded ? ` · ${counts(directory.kind)} listed` : ""}`);
        return { ...base, body: pageMain(route.title, `<p>${escapeHtml(route.description)}</p>`, section("Directories", directories), asOfNote(data), exploreLinks(data)) };
      }
      const entities = data.entities.filter((entity) => entity.kind === route.kind && entityPath(entity) && text(entity.name)).sort(byName);
      const items = entities.map((entity) => `${link(entityPath(entity), entity.name)}${locationLine(entity) ? ` · ${escapeHtml(locationLine(entity))}` : ""}`);
      return {
        ...base,
        body: pageMain(route.title, `<p>${escapeHtml(route.description)}</p>`, section("Listed", items), asOfNote(data), exploreLinks(data)),
      };
    }
    default:
      return { ...base, body: pageMain(route.title, `<p>${escapeHtml(route.description)}</p>`, exploreLinks(data)) };
  }
}

/** The page (head values plus #app content) for one route. */
export function buildPage(route, data) {
  if (route.type === "event") return eventPage(route.event, data);
  if (route.type === "entity") {
    const detail = data.details.get(route.path);
    if (!detail) throw new Error(`Prerender: no detail loaded for ${route.path}.`);
    return entityPage(route, detail, data);
  }
  return stablePage(route, data);
}

/** Replace exactly one match, or fail the build: a silent miss would ship the homepage's tags. */
function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Prerender: expected one ${label} in dist/index.html, found ${matches.length}.`);
  }
  return html.replace(pattern, () => replacement);
}

function metaTag(attribute, key) {
  return new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/>`);
}

/** Render one page from the built shell. */
export function renderPage(template, page, titleSuffix) {
  const title = escapeHtml(`${page.title}${titleSuffix}`);
  const description = escapeHtml(page.description);
  const url = escapeHtml(new URL(page.path, CANONICAL_ORIGIN).toString());
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "<title>");
  html = replaceOnce(html, metaTag("name", "description"), `<meta name="description" content="${description}" />`, "meta description");
  html = replaceOnce(html, metaTag("name", "robots"), `<meta name="robots" content="${escapeHtml(page.robots ?? "index, follow")}" />`, "meta robots");
  html = replaceOnce(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`, "canonical link");
  const tags = [
    ["property", "og:title", title], ["property", "og:description", description], ["property", "og:url", url],
    ["name", "twitter:title", title], ["name", "twitter:description", description],
  ];
  if (page.image) {
    // The shell's image dimensions and alt text describe the default share image, not this one.
    const image = escapeHtml(page.image);
    tags.push(["property", "og:image", image], ["name", "twitter:image", image]);
    for (const [attribute, key] of [["property", "og:image:width"], ["property", "og:image:height"], ["property", "og:image:alt"], ["name", "twitter:image:alt"]]) {
      html = replaceOnce(html, new RegExp(`\\s*${metaTag(attribute, key).source}`), "", key);
    }
  }
  for (const [attribute, key, value] of tags) {
    html = replaceOnce(html, metaTag(attribute, key), `<meta ${attribute}="${key}" content="${value}" />`, key);
  }
  if (page.eventJsonLd) {
    // Same id the app's event page uses, so a client render replaces this block instead of adding a second one.
    html = replaceOnce(html, /<\/head>/, `    <script type="application/ld+json" id="event-detail-data">${page.eventJsonLd}</script>\n  </head>`, "</head>");
  }
  html = replaceOnce(html, /<div id="app"><\/div>/, `<div id="app">${page.body}</div>`, "empty #app mount");
  // Keep the supplied no-JavaScript navigation/store content, but avoid a
  // second page heading and repeated intro after #app gains static content.
  const fallbackIntro = /<h1\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/h1>(?:\s*<p>[\s\S]*?<\/p>)*/;
  const fallbackHeadingId = html.match(fallbackIntro)?.[1];
  if (!fallbackHeadingId) throw new Error("Prerender: the no-JavaScript fallback has no labelled heading.");
  return replaceOnce(
    html, fallbackIntro,
    `<h2 id="${escapeHtml(fallbackHeadingId)}">More from Salsa Segura</h2>`,
    "noscript guide intro",
  );
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function fetchEntityDetails(config, routes) {
  const details = new Map();
  await mapLimit(routes.filter((route) => route.type === "entity"), DETAIL_CONCURRENCY, async ({ path, entity }) => {
    const detail = await supabaseJson(config, `Entity detail ${path}`, "/rest/v1/rpc/public_entity_detail", {
      body: { p_kind: entity.kind, p_slug: entity.slug },
    });
    if (detail?.entity?.kind !== entity.kind || detail.entity.slug !== entity.slug || !text(detail.entity.name)) {
      throw new Error(`Entity detail ${path} returned no matching entity.`);
    }
    details.set(path, detail);
  });
  return details;
}

async function main() {
  loadBuildEnv();
  const template = await readFile(resolve("dist/index.html"), "utf8");
  const config = supabaseConfig();
  let events = [];
  let entities = [];
  if (config) {
    [events, entities] = await Promise.all([fetchApprovedEvents(config, EVENT_FIELDS), fetchPublicEntities(config)]);
  } else {
    console.warn("Prerender: Supabase is not configured; writing stable routes only.");
  }
  const routes = buildRouteTable(routeMeta, events, entities);
  const data = {
    loaded: Boolean(config),
    builtAt: new Date(),
    events,
    entities,
    details: config ? await fetchEntityDetails(config, routes) : new Map(),
  };
  const distRoot = resolve("dist");
  for (const route of routes) {
    const output = resolve(distRoot, `.${route.path}`, "index.html");
    if (!output.startsWith(distRoot + sep)) throw new Error(`Prerender: ${route.path} resolves outside dist.`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderPage(template, buildPage(route, data), routeMeta.titleSuffix), "utf8");
  }
  console.log(`Prerendered ${routes.length} routes.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
