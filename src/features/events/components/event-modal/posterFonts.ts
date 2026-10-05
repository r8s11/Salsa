import shrikhandUrl from "@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2?url";
import barlow600Url from "@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url";
import barlow800Url from "@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2?url";

/**
 * The poster is its own printed world (the sleeve), so it sets its own faces:
 * Shrikhand for the lettered title, Barlow Condensed for the track list.
 * They are self-hosted and loaded only when a poster is shown, and the same
 * bytes are embedded into the capture so the exported PNG matches the preview
 * instead of falling back to a system sans.
 */
const FACES = [
  { family: "Poster Lettering", weight: "400", url: shrikhandUrl },
  { family: "Poster Condensed", weight: "600", url: barlow600Url },
  { family: "Poster Condensed", weight: "800", url: barlow800Url },
] as const;

let loaded: Promise<void> | null = null;
let embedCss: Promise<string> | null = null;

/** Registers the poster faces with the document. Safe to call repeatedly. */
export function ensurePosterFonts(): Promise<void> {
  if (loaded) return loaded;
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    loaded = Promise.resolve();
    return loaded;
  }
  loaded = Promise.all(
    FACES.map(async ({ family, weight, url }) => {
      const face = new FontFace(family, `url(${url}) format("woff2")`, { weight });
      document.fonts.add(await face.load());
    })
  )
    .then(() => undefined)
    .catch(() => {
      // A failed font load must not block sharing; the stacks fall back.
      loaded = null;
    });
  return loaded;
}

async function toDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font request failed: ${url}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read poster font"));
    reader.readAsDataURL(blob);
  });
}

/** `@font-face` rules with inlined font data, for html-to-image's fontEmbedCSS. */
export function posterFontEmbedCss(): Promise<string> {
  if (embedCss) return embedCss;
  embedCss = Promise.all(
    FACES.map(
      async ({ family, weight, url }) =>
        `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(${await toDataUrl(url)}) format("woff2");}`
    )
  )
    .then((rules) => rules.join("\n"))
    .catch((error: unknown) => {
      embedCss = null;
      throw error;
    });
  return embedCss;
}
