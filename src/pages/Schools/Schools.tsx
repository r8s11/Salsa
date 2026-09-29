import WorkInProgress from "../../components/WIP/WorkInProgress";
import { useDocumentMeta } from "../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../utils/seo";

export default function Schools() {
  useDocumentMeta({
    title: "Dance Schools",
    description: "The dance school directory is not available yet. Find current salsa and bachata events on the Salsa Segura calendar.",
    canonical: canonicalUrl("/schools"),
    robots: "noindex, follow",
  });
  return <WorkInProgress />;
}
