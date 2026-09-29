import { useEffect } from "react";
import { updatePageTitle, updateMetaDescription, updateCanonicalUrl } from "../../utils/seo";

interface DocumentMetaOptions {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
}

// Sets route metadata for the component lifetime, then restores the previous
// document state on unmount so values never leak into the next route.
export function useDocumentMeta({ title, description, canonical, robots }: DocumentMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;

    const descriptionEl = document.querySelector('meta[name="description"]');

    const hadDescription = descriptionEl !== null;
    const previousDescription = descriptionEl?.getAttribute("content") ?? null;

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalEl?.getAttribute("href") ?? null;
    const hadCanonical = canonicalEl !== null;
    const robotsEl = document.querySelector('meta[name="robots"]');
    const previousRobots = robotsEl?.getAttribute("content") ?? null;

    updatePageTitle(title);
    updateMetaDescription(description);
    if (canonical) updateCanonicalUrl(canonical);
    if (robots && robotsEl) robotsEl.setAttribute("content", robots);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) updateMetaDescription(previousDescription);
      else if (hadDescription) descriptionEl?.removeAttribute("content");
      else document.querySelector('meta[name="description"]')?.remove();
      if (canonical) {
        if (hadCanonical && previousCanonical !== null) updateCanonicalUrl(previousCanonical);
        else document.querySelector('link[rel="canonical"]')?.remove();
      }
      if (robots && robotsEl && previousRobots !== null) {
        robotsEl.setAttribute("content", previousRobots);
      }
    };
  }, [title, description, canonical, robots]);
}
