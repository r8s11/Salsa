import WorkInProgress from "../components/marketing/WorkInProgress";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";

export default function Lessons() {
  useDocumentMeta({
    title: "Dance Lessons",
    description: "Dance lessons are not listed yet. Browse current salsa and bachata events on the Salsa Segura calendar.",
    canonical: canonicalUrl("/lessons"),
    robots: "noindex, follow",
  });
  return <WorkInProgress />;
}
