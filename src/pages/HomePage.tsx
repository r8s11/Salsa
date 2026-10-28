import { useLocation } from "react-router-dom";
import Hero from "../components/marketing/Hero";
import Events from "../features/events/components/Events";
import HomeCta from "../components/marketing/HomeCta";
import { useCity } from "../contexts/useCity";
import { useMetroName } from "../features/metros/hooks/useMetros";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";

function HomePage() {
  const location = useLocation();
  const { city } = useCity();
  const metroName = useMetroName();
  const cityName = location.pathname.startsWith("/events/") && city ? metroName(city) : null;
  const cityPath = location.pathname.replace(/\/+$/, "") || "/";

  useDocumentMeta({
    title: cityName ? routeMeta.metroHome.title.replace("{city}", cityName) : routeMeta.home.title,
    description: cityName ? routeMeta.metroHome.description.replace("{city}", cityName) : routeMeta.home.description,
    canonical: canonicalUrl(cityName ? cityPath : routeMeta.home.path),
  });

  return (
    <>
      <Hero />
      <Events />
      <HomeCta />
    </>
  );
}

export default HomePage;
