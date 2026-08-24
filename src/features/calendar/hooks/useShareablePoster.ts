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
      cacheBust: true,
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
      const filename = posterFilename(event);
      const url = URL.createObjectURL(poster);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [posterFilename]
  );

  return { ensureContainer, capturePoster, posterFilename, downloadPoster, removeTarget };
}
