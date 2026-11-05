import Contact from "../components/marketing/Contact";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";

export default function ContactPage() {
  useDocumentMeta({ ...routeMeta.contact, canonical: canonicalUrl(routeMeta.contact.path) });
  return <Contact />;
}
