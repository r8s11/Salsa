/** Parse only the public itinerary route; dates must exist before Monday normalization. */
export function parseItineraryPath(pathname, aliases) {
  const match = /^\/itineraries\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/?$/.exec(pathname);
  if (!match) return null;
  let city;
  try {
    city = decodeURIComponent(match[1]).normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  } catch {
    return null;
  }
  if (!city) return null;
  city = Object.hasOwn(aliases, city) ? aliases[city] : city;
  const date = new Date(`${match[2]}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[2]) return null;
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const weekStart = date.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? { city, weekStart } : null;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function attribute(tag, name) {
  return new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)?.slice(1).find((value) => value !== undefined) ?? "";
}

/** Replace the shell's default SEO tags, including every stale social-image variant. */
export function injectMeta(html, meta) {
  const clean = html.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>\s*|<(?:meta|link)\b[^>]*>\s*/gi, (tag) => {
    if (/^<title\b/i.test(tag)) return "";
    const name = (attribute(tag, "name") || attribute(tag, "property")).toLowerCase();
    if (/^<meta\b/i.test(tag) && (name === "description" || name.startsWith("og:") || name.startsWith("twitter:"))) return "";
    if (/^<link\b/i.test(tag) && attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical")) return "";
    return tag;
  });
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const image = meta.image ? escapeHtml(meta.image) : null;
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (image) tags.push(
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta name="twitter:image" content="${image}" />`,
  );
  return clean.replace(/<\/head\s*>/i, `${tags.join("\n")}\n</head>`);
}

export function noindexShell(html, { title, description, url }) {
  return injectMeta(html, { title, description, url, image: null })
    .replace(/<meta\b[^>]*>\s*/gi, (tag) => attribute(tag, "name").toLowerCase() === "robots" ? "" : tag)
    .replace(/<\/head\s*>/i, '<meta name="robots" content="noindex, follow" />\n</head>');
}
