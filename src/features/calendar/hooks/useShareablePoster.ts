import { useCallback, useRef } from "react";
import { toPng } from "html-to-image";
import { ScheduleXEvent } from "../../../types/events";

/**
 * Hook that manages an off-screen poster-render target and exposes a
 * `downloadPoster` callback.  Call `downloadPoster(event, format)`
 * whenever the user requests an export.
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
   * Slugify for the download filename.
   */
  const slugify = useCallback((text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, []);

  /**
   * Downloads the event poster as a PNG.
   *
   * @param event       The event to render in the poster.
   * @param container   The DOM element containing the mounted poster.
   * @param format      "square" (1080×1080) or "portrait" (1080×1920).
   */
  const captureAndDownload = useCallback(
    async (event: ScheduleXEvent, container: HTMLElement, format: "square" | "portrait") => {
      // html-to-image needs the element to be in the layout flow.
      // The .poster-render-target class keeps it at left:-9999px so it's
      // rendered (with correct font metrics, images loaded) but invisible.
      const posterEl = container.firstElementChild as HTMLElement | null;
      if (!posterEl) {
        throw new Error("Poster element not found in container");
      }

      // Wait a tick so fonts / images have a chance to paint.
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(posterEl, {
        quality: 1,
        pixelRatio: 1,
        cacheBust: true,
      });

      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `salsa-segura-${slugify(event.title)}-${format}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      // Clean up the off-screen target after download.
      removeTarget();
    },
    [slugify, removeTarget]
  );

  return { ensureContainer, captureAndDownload, removeTarget };
}
