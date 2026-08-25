import { useCallback, useRef } from "react";
import { toBlob } from "html-to-image";
import { ScheduleXEvent } from "../../../types/events";

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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const ensureContainer = useCallback(() => {
    if (containerRef.current && document.body.contains(containerRef.current)) {
      return containerRef.current;
    }
    const div = document.createElement("div");
    div.className = "poster-render-target";
    document.body.appendChild(div);
    containerRef.current = div;
    return div;
  }, []);

  /**
   * Clean up a mounted poster element. Safe to call even if already removed.
   */
  const removeTarget = useCallback(() => {
    if (containerRef.current && document.body.contains(containerRef.current)) {
      document.body.removeChild(containerRef.current);
      containerRef.current = null;
    }
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

    const blob = await toBlob(posterEl, {
      quality: 1,
      pixelRatio: 1,
      // Google Fonts is a cross-origin stylesheet. Browsers correctly block
      // `CSSStyleSheet.cssRules`; html-to-image logs one SecurityError per
      // capture while trying to inline it. The Story poster already declares
      // system fallbacks, so skip this unsupported scan rather than emitting
      // noisy console errors or aborting capture.
      skipFonts: true,
      // No cacheBust: flyer is already inlined as a data URL by
      // resolvePosterImage, and busting cache only forces needless re-fetches
      // of same-origin assets.
      // Flyer still cannot be inlined (unreadable host) degrades to a poster
      // without photo instead of rejecting whole capture.
      onImageErrorHandler: () => undefined,
    });

    if (!blob) {
      throw new Error("Poster image could not be created");
    }

    return blob;
  }, []);

  /**
   * Returns the normalized filename shared by native sharing and download.
   */
  const posterFilename = useCallback((event: ScheduleXEvent) => {
    return `salsa-segura-${slugify(event.title)}.png`;
  }, []);

  /**
   * Downloads the poster PNG using the shared filename convention.
   */
  const downloadPoster = useCallback(
    (event: ScheduleXEvent, poster: Blob) => {
      const url = URL.createObjectURL(poster);
      const link = document.createElement("a");
      link.href = url;
      link.download = posterFilename(event);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [posterFilename]
  );

  return {
    ensureContainer,
    capturePoster,
    posterFilename,
    downloadPoster,
    removeTarget,
    resolvePosterImage,
  };
}
