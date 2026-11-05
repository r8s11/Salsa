import WorkInProgress from "../components/marketing/WorkInProgress";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";

export default function Lessons() {
  useDocumentMeta({ ...routeMeta.lessons, canonical: canonicalUrl(routeMeta.lessons.path) });
  return <WorkInProgress />;
}
