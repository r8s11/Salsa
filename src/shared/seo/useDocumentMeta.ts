import { useEffect } from "react";
import { updatePageTitle, updateMetaDescription } from "../../utils/seo";

interface DocumentMetaOptions {
  title: string;
  description: string;
}

// Sets the document title + meta description for the lifetime of the
// component, restoring the previous title on unmount.
export function useDocumentMeta({ title, description }: DocumentMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;

    updatePageTitle(title);
    updateMetaDescription(description);

    return () => {
      document.title = previousTitle;
    };
  }, [title, description]);
}
