import WorkInProgress from "../components/WIP/WorkInProgress";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";

export default function Instructors() {
  useDocumentMeta({
    title: "Dance Instructors",
    description: "The instructor directory is not available yet. Find current salsa and bachata events on the Salsa Segura calendar.",
    canonical: canonicalUrl("/instructors"),
    robots: "noindex, follow",
  });
  return <WorkInProgress />;
}
