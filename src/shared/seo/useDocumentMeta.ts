import { useEffect } from "react";
import { updatePageTitle, updateMetaDescription, updateCanonicalUrl } from "../../utils/seo";

interface DocumentMetaOptions {
  title: string;
  description: string;
  canonical?: string;
}

// Sets the document title, meta description, and optional canonical URL for
// the lifetime of the component, restoring all three to their previous state
// on unmount so values never leak into whatever renders next.
export function useDocumentMeta({ title, description, canonical }: DocumentMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;

    const descriptionEl = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionEl?.getAttribute("content") ?? null;

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalEl?.getAttribute("href") ?? null;
    const hadCanonical = canonicalEl !== null;

    updatePageTitle(title);
    updateMetaDescription(description);
    if (canonical) {
      updateCanonicalUrl(canonical);
    }

    return () => {
      document.title = previousTitle;

      if (previousDescription !== null) {
        updateMetaDescription(previousDescription);
      }

      if (canonical) {
        if (hadCanonical && previousCanonical !== null) {
          updateCanonicalUrl(previousCanonical);
        } else {
          document.querySelector('link[rel="canonical"]')?.remove();
        }
      }
    };
  }, [title, description, canonical]);
}
