import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildPage, renderPage } from "./prerender-routes.mjs";
import { buildRouteTable, routeMeta } from "./public-routes.mjs";

// The source shell has the same head, #app mount and noscript markup Vite copies to dist.
const template = await readFile("index.html", "utf8");
const builtAt = new Date("2026-10-28T16:00:00Z");
const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

const data = (overrides = {}) => ({ loaded: true, builtAt, events: [], entities: [], details: new Map(), ...overrides });
const route = (path) => buildRouteTable(routeMeta).find((item) => item.path === path);
const render = (page) => renderPage(template, page, routeMeta.titleSuffix);
const appContent = (html) => html.match(/<div id="app">([\s\S]*?)<\/div>\s*<noscript>/)?.[1] ?? "";

const event = {
  id: EVENT_ID,
  slug: "noche-latina",
  title: "Noche <Latina> & Friends",
  description: "Social dancing.\n\nDoors at 9 </script><script>alert(1)</script>",
  event_type: "social",
  event_date: "2026-10-31T01:00:00Z",
  location: "Havana Club",
  address: "288 Green St",
  city: "boston",
  host: "Roosevelt",
  price_type: "paid",
  price_amount: 15,
  rsvp_link: "https://tickets.example.com/noche",
  image_url: "https://images.example.com/flyer.jpg",
  poster_image_url: null,
  public_entities: { venue: { kind: "venue", name: "Havana Club", slug: "havana-club" }, djs: [{ kind: "dj", name: "DJ <X>", slug: "../x" }] },
};

describe("prerendered metro page", () => {
  it("carries the metro's own head tags and lists upcoming events as real content, once", () => {
    const html = render(buildPage(route("/events/boston"), data({
      events: [
        event,
        { ...event, id: "223e4567-e89b-12d3-a456-426614174000", slug: "old-night", title: "Old night", event_date: "2026-10-01T01:00:00Z" },
        { ...event, id: "323e4567-e89b-12d3-a456-426614174000", slug: "nyc-night", title: "NYC night", city: "new-york-city" },
      ],
    })));

    expect(html).toContain("<title>Salsa &amp; Bachata Events in Boston | Salsa Segura</title>");
    expect(html).toContain('<link rel="canonical" href="https://www.salsasegura.com/events/boston" />');
    expect(html).toContain('<meta property="og:url" content="https://www.salsasegura.com/events/boston" />');
    expect(html).not.toContain('content="https://www.salsasegura.com/"');

    const app = appContent(html);
    expect(app).toContain("<h1>Salsa &amp; Bachata Events in Boston</h1>");
    expect(app).toContain('<a href="/events/noche-latina">Noche &lt;Latina&gt; &amp; Friends</a>');
    expect(app).toMatch(/<time datetime="2026-10-31T01:00:00Z">Fri, Oct 30, 9:00\sPM<\/time> · Havana Club/);
    expect(app).not.toContain("Old night");
    expect(app).not.toContain("NYC night");

    // One h1 without JavaScript: the noscript guide drops its intro but keeps navigation.
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("says so when a metro has no upcoming events, and omits listings entirely when data was not loaded", () => {
    expect(appContent(render(buildPage(route("/events/boston"), data())))).toContain("No upcoming Boston events are listed right now.");
    const unloaded = appContent(render(buildPage(route("/events/boston"), data({ loaded: false }))));
    expect(unloaded).not.toContain("No upcoming");
    expect(unloaded).toContain("Salsa &amp; Bachata Events in Boston");
  });
});

describe("prerendered event page", () => {
  const html = render(buildPage(buildRouteTable(routeMeta, [event]).find((item) => item.type === "event"), data()));

  it("renders crawlable details with the event's own head, image and canonical", () => {
    expect(html).toContain("<title>Noche &lt;Latina&gt; &amp; Friends | Salsa Segura</title>");
    expect(html).toContain('<link rel="canonical" href="https://www.salsasegura.com/events/noche-latina" />');
    expect(html).toContain('<meta property="og:image" content="https://images.example.com/flyer.jpg" />');
    expect(html).toContain('<meta name="twitter:image" content="https://images.example.com/flyer.jpg" />');
    expect(html).not.toContain("og-image.jpg");
    expect(html).not.toContain("og:image:width");
    const app = appContent(html);
    expect(app).toContain("<h1>Noche &lt;Latina&gt; &amp; Friends</h1>");
    expect(app).toContain('<a href="/v/havana-club">Havana Club</a>');
    expect(app).toContain("Price: $15");
    expect(app).toContain('<a href="https://tickets.example.com/noche" rel="nofollow noopener noreferrer">');
    // An unroutable reference (unsafe slug) is shown as text, never as a link.
    expect(app).toContain("DJs: DJ &lt;X&gt;");
    expect(app).not.toContain("../x");
  });

  it("emits Event structured data that cannot break out of its script tag", () => {
    const block = html.match(/<script type="application\/ld\+json" id="event-detail-data">([\s\S]*?)<\/script>/)?.[1];
    expect(block).toBeDefined();
    expect(block).not.toContain("</script>");
    const parsed = JSON.parse(block);
    expect(parsed).toMatchObject({
      "@type": "DanceEvent",
      name: "Noche <Latina> & Friends",
      startDate: "2026-10-31T01:00:00Z",
      url: "https://www.salsasegura.com/events/noche-latina",
      location: { name: "Havana Club", address: { streetAddress: "288 Green St" } },
      offers: { price: 15, priceCurrency: "USD" },
    });
    expect(parsed.description).toContain("</script><script>alert(1)</script>");
  });

  it("does not invent a location, price or link the data does not support", () => {
    const bare = { ...event, location: null, address: null, price_type: null, price_amount: null, rsvp_link: "javascript:alert(1)", image_url: "data:text/html,x", public_entities: null };
    const page = render(buildPage(buildRouteTable(routeMeta, [bare]).find((item) => item.type === "event"), data()));
    const json = JSON.parse(page.match(/id="event-detail-data">([\s\S]*?)<\/script>/)[1]);
    expect(json.location).toBeUndefined();
    expect(json.offers).toBeUndefined();
    expect(page).not.toContain("javascript:");
    expect(page).not.toContain("data:text/html");
    expect(page).toContain("og-image.jpg");
  });

  it("fails the build rather than render an event without a usable date", () => {
    expect(() => buildPage({ type: "event", path: `/events/${EVENT_ID}`, event: { ...event, event_date: "not a date" } }, data())).toThrow(/invalid event_date/);
  });
});

describe("prerendered entity page", () => {
  const entity = { kind: "venue", id: "v1", name: "Havana & Co", slug: "havana-co", description: "Salsa <room>", image_url: null, city: "boston", state_region: "MA", website: "https://havana.example.com" };
  const detail = {
    entity,
    upcoming: [{ id: EVENT_ID, slug: "noche-latina", title: "Noche", event_date: "2026-10-31T01:00:00Z", city: "boston", location: "Havana Club" }],
    past: [],
    related: [{ kind: "organizer", name: "Boston Salsa", slug: "boston-salsa" }, { kind: "organizer", name: "Bad", slug: "Bad Slug" }],
  };
  const page = buildPage({ type: "entity", path: "/v/havana-co", entity }, data({ details: new Map([["/v/havana-co", detail]]) }));
  const html = render(page);

  it("uses the entity's name and description for the head and lists its events and routable relations", () => {
    expect(html).toContain("<title>Havana &amp; Co | Salsa Segura</title>");
    expect(html).toContain('<meta name="description" content="Salsa &lt;room&gt;" />');
    expect(html).toContain('<link rel="canonical" href="https://www.salsasegura.com/v/havana-co" />');
    const app = appContent(html);
    expect(app).toContain("Venue · boston, MA");
    expect(app).toContain('<a href="https://havana.example.com/" rel="noopener noreferrer">Website</a>');
    expect(app).toContain('<a href="/events/noche-latina">Noche</a>');
    expect(app).toContain('<a href="/o/boston-salsa">Boston Salsa</a>');
    expect(app).not.toContain("Bad Slug");
  });
});

describe("stable routes", () => {
  it("carries noindex onto routes that must not rank", () => {
    const html = render(buildPage(route("/submit"), data({ loaded: false })));
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("prerenders a directory as a list of links to its entities", () => {
    const html = render(buildPage(route("/venues"), data({
      entities: [
        { kind: "venue", name: "B Hall", slug: "b-hall", city: "new-york-city" },
        { kind: "venue", name: "A Hall", slug: "a-hall", city: "boston" },
        { kind: "school", name: "Not a venue", slug: "school" },
      ],
    })));
    const app = appContent(html);
    expect(app.indexOf("A Hall")).toBeGreaterThan(-1);
    expect(app.indexOf("A Hall")).toBeLessThan(app.indexOf("B Hall"));
    expect(app).toContain('<a href="/v/a-hall">A Hall</a> · boston');
    expect(app).not.toContain("Not a venue");
  });
});

describe("route table", () => {
  it("lets a stable route win over an event slug and never routes unsafe slugs", () => {
    const table = buildRouteTable(
      routeMeta,
      [{ ...event, slug: "boston" }, { ...event, id: "423e4567-e89b-12d3-a456-426614174000", slug: "Bad Slug" }],
      [{ kind: "venue", name: "x", slug: "../etc" }],
    );
    expect(table.find((item) => item.path === "/events/boston").type).toBe("metro");
    expect(table.some((item) => item.path.includes(".."))).toBe(false);
    expect(table.some((item) => item.path === "/events/423e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
});
