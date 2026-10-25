import { useEffect } from "react";
import { updatePageTitle, updateMetaDescription, updateCanonicalUrl } from "../../utils/seo";

interface DocumentMetaOptions {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  image?: string | null;
}

// Sets route metadata for the component lifetime, then restores the previous
// document state on unmount so values never leak into the next route.
export function useDocumentMeta({ title, description, canonical, robots, image }: DocumentMetaOptions) {
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
    const socialValues = [
      ["property", "og:title", document.title],
      ["property", "og:description", description],
      ["property", "og:url", canonical],
      ["property", "og:type", "website"],
      ["property", "og:image", image],
      ["name", "twitter:card", image ? "summary_large_image" : "summary"],
      ["name", "twitter:title", document.title],
      ["name", "twitter:description", description],
      ["name", "twitter:image", image],
    ] as const;
    const socialState = socialValues.map(([attribute, key, value]) => {
      const element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const previous = element?.getAttribute("content") ?? null;
      if (value) {
        const next = element ?? document.createElement("meta");
        next.setAttribute(attribute, key);
        next.content = value;
        if (!element) document.head.append(next);
      } else {
        element?.remove();
      }
      return { attribute, key, element, previous };
    });

    return () => {
      document.title = previousTitle;
      for (const { attribute, key, element, previous } of socialState) {
        document.querySelector(`meta[${attribute}="${key}"]`)?.remove();
        if (element) {
          if (previous !== null) element.content = previous;
          else element.removeAttribute("content");
          document.head.append(element);
        }
      }
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
  }, [title, description, canonical, robots, image]);
}
