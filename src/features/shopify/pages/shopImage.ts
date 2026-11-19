const WIDTHS = [320, 480, 720, 960, 1440];
// Merchant uploads sometimes keep the mockup tool's generic caption.
const PLACEHOLDER_ALT = /^\s*(product\s+)?(mockup|image|photo)\s*$/i;

/** Shopify's CDN resizes on the `width` query parameter; never upscale past the original. */
export function shopifySrcSet(url: string, naturalWidth?: number | null) {
  if (!/^https?:\/\//.test(url)) return undefined;
  const widths = WIDTHS.filter((width) => !naturalWidth || width <= naturalWidth);
  return widths.map((width) => {
    const sized = new URL(url);
    sized.searchParams.set("width", String(width));
    return `${sized.toString()} ${width}w`;
  }).join(", ") || undefined;
}

export function productAlt(altText: string | null | undefined, title: string) {
  return altText && !PLACEHOLDER_ALT.test(altText) ? altText : title;
}
