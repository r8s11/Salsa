import { useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ScheduleXEvent } from "../../../types/events";
import type { PosterFormat } from "../../../components/EventModal/posterFormat";
import { ensurePosterFonts, posterFontEmbedCss } from "../../../components/EventModal/posterFonts";
import { resolveEventFlyer } from "../../../components/EventModal/eventModalImage";
import { buildShortEventUrl, shortEventLabel } from "../../events/model/shortLink";
import { resolvePosterImageForEvent } from "../api/posterFlyers";

/** Time for the off-screen poster (and its inlined flyer) to paint before capture. */
const POSTER_PAINT_MS = 300;

/**
 * Slugify for the poster filename.
 */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves a flyer URL to an inline data URL so the poster capture never
 * depends on the image host's CORS headers.
 *
 * html-to-image inlines `<img>` sources by fetching them during capture, and
 * the poster's `<img>` previously carried `crossOrigin="anonymous"` — against a
 * host that sends no `Access-Control-Allow-Origin`, the element fails to load
 * at all and the capture silently produced a poster with no photo. Fetching the
 * bytes ourselves and handing the poster a data URL removes the cross-origin
 * load from the capture entirely. Returns null when the flyer cannot be read,
 * so callers fall back to the designed gradient rather than an empty frame.
 */
export async function resolvePosterImage(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!response.ok) return null;

    // Promise constructor rather than Promise.withResolvers: this project
    // targets ES2020 (tsconfig lib), where withResolvers does not exist.
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read flyer image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Hook that manages an off-screen poster-render target and exposes
 * operations to capture the mounted poster as a PNG blob, name it, and
 * download it as a fallback when native sharing isn't available.
 */
export function useShareablePoster() {
  // One entry per in-flight export; unmounting the owner cancels and cleans all of them.
  const exportsRef = useRef(new Set<{
    cancelled: boolean;
    dispose?: () => void;
    reject?: (reason: unknown) => void;
  }>());

  useEffect(() => {
    const exports = exportsRef.current;
    return () => {
      for (const job of exports) {
        job.cancelled = true;
        job.reject?.(new Error("Poster export cancelled"));
        job.dispose?.();
      }
      exports.clear();
    };
  }, []);

  /**
   * Captures the poster mounted inside `container` as a PNG blob.
   */
  const capturePoster = useCallback(async (container: HTMLElement): Promise<Blob> => {
    // html-to-image needs the element to be in the layout flow.
    // The .poster-render-target class keeps it at left:-9999px so it's
    // rendered (with correct font metrics, images loaded) but invisible.
    const posterEl = container.firstElementChild as HTMLElement | null;
    if (!posterEl) {
      throw new Error("Poster element not found in container");
    }

    // Dynamic import, deliberately: a static import puts html-to-image in
    // the initial chunk, and poster capture only ever runs when a visitor
    // asks to share. Splitting it out is the whole point, so a static import
    // cannot express this. (ts-no-dynamic-import exception.)
    const { toBlob } = await import("html-to-image");

    // The poster sets its own self-hosted faces; embedding them explicitly
    // keeps the export identical to the preview. html-to-image is never
    // asked to scan stylesheets itself: Google Fonts is cross-origin and
    // every scan logs a SecurityError. If the font bytes are unreachable the
    // capture still succeeds on the declared fallback stacks.
    const fontEmbedCSS = await posterFontEmbedCss().catch(() => null);

    const options = {
      quality: 1,
      pixelRatio: 1,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      // No cacheBust: flyer is already inlined as a data URL by
      // resolvePosterImage, and busting cache only forces needless re-fetches
      // of same-origin assets.
      // Flyer still cannot be inlined (unreadable host) degrades to a poster
      // without photo instead of rejecting whole capture.
      onImageErrorHandler: () => undefined,
    };

    // Every cover image must be decoded before the capture reads it.
    await Promise.all(
      Array.from(posterEl.querySelectorAll("img"), (img) => img.decode?.().catch(() => undefined))
    );

    // WebKit needs a previous SVG draw before it paints the cover image into
    // the snapshot. Chromium also includes "AppleWebKit" in its user agent,
    // so exclude Chromium-family engines; iOS Chrome/Edge still use WebKit.
    const agent = navigator.userAgent;
    if (/AppleWebKit\//.test(agent) && !/(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(agent)) {
      await toBlob(posterEl, options).catch(() => null);
    }

    const blob = await toBlob(posterEl, options);
    if (!blob) {
      throw new Error("Poster image could not be created");
    }

    return blob;
  }, []);
  /**
   * Returns the normalized filename shared by native sharing and download.
   */
  const posterFilename = useCallback((event: ScheduleXEvent, format: PosterFormat = "story") => {
    return `salsa-segura-${slugify(event.title)}${format === "feed" ? "-feed" : ""}.png`;
  }, []);

  /**
   * Downloads the poster PNG using the shared filename convention.
   */
  const downloadPoster = useCallback(
    (event: ScheduleXEvent, poster: Blob, format: PosterFormat = "story") => {
      const url = URL.createObjectURL(poster);
      const link = document.createElement("a");
      link.href = url;
      link.download = posterFilename(event, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [posterFilename]
  );


  /**
   * Renders the event's sleeve poster off-screen in the requested format and
   * captures it. Cover art priority: the normalized flyer cache, then the
   * event flyer, then the on-brand fallback art for its type.
   */
  const createPoster = useCallback(
    async (
      event: ScheduleXEvent,
      format: PosterFormat,
      sources: { sourceUrl?: string | null; cachedUrl?: string | null } = {}
    ): Promise<Blob> => {
      const job: {
        cancelled: boolean;
        dispose?: () => void;
        reject?: (reason: unknown) => void;
      } = { cancelled: false };
      exportsRef.current.add(job);
      const assertActive = () => {
        if (job.cancelled) throw new Error("Poster export cancelled");
      };
      try {
        const resolution = await resolvePosterImageForEvent({
          eventId: String(event.id),
          sourceUrl: sources.sourceUrl ?? event.imageUrl ?? null,
          cachedUrl: sources.cachedUrl ?? event.posterImageUrl ?? null,
        });
        const flyer = resolution.status === "ready" ? resolution.dataUrl : null;

        // The poster (and its QR encoder) loads only when a visitor shares.
        const [{ default: ShareableEventPoster }] = await Promise.all([
          import("../../../components/EventModal/ShareableEventPoster"),
          ensurePosterFonts(),
        ]);

        assertActive();

        // Create an operation-local container to avoid concurrent capture conflicts.
        // Each createPoster call gets its own container so concurrent calls don't
        // overwrite/remove each other's art.
        const container = document.createElement("div");
        container.className = "poster-render-target";
        container.style.position = "absolute";
        container.style.left = "-9999px";
        container.style.top = "-9999px";
        document.body.appendChild(container);
        const root = createRoot(container);
        let disposed = false;
        job.dispose = () => {
          if (disposed) return;
          disposed = true;
          root.unmount();
          container.remove();
        };
        flushSync(() => {
          root.render(
            <ShareableEventPoster
              event={event}
              format={format}
              imageUrl={flyer ?? resolveEventFlyer({ ...event, imageUrl: undefined })}
              artKind={flyer ? "flyer" : "fallback"}
              shortUrl={buildShortEventUrl(String(event.id))}
              shortLabel={shortEventLabel(String(event.id))}
            />
          );
        });
        // Executor form: this project's tsconfig lib (ES2020) has no
        // Promise.withResolvers.
        const cancelPromise = new Promise<never>((_, reject) => {
          job.reject = reject;
        });
        const paintDelay = new Promise<void>((resolve) => {
          window.setTimeout(resolve, POSTER_PAINT_MS);
        });
        await Promise.race([paintDelay, cancelPromise]);
        assertActive();
        const blob = await Promise.race([capturePoster(container), cancelPromise]);
        assertActive();
        return blob;
      } finally {
        job.dispose?.();
        exportsRef.current.delete(job);
      }
    },
    [capturePoster]
  );

  return {
    capturePoster,
    createPoster,
    posterFilename,
    downloadPoster,
    resolvePosterImage,
  };
}