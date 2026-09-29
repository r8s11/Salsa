import Contact from "../components/Contact/Contact";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";

export default function ContactPage() {
  useDocumentMeta({
    title: "Contact Salsa Segura",
    description: "Get in touch with Salsa Segura about salsa and bachata event listings across Greater Boston and New York City.",
    canonical: canonicalUrl("/contact"),
  });
  return <Contact />;
}
