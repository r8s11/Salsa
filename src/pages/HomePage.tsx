import { useLocation } from "react-router-dom";
import Hero from "../components/Hero/Hero";
import Events from "../components/Events/Events";
import HomeCta from "../components/HomeCta/HomeCta";
import { useCity } from "../contexts/useCity";
import { useMetroName } from "../features/metros/hooks/useMetros";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";

function HomePage() {
  const location = useLocation();
  const { city } = useCity();
  const metroName = useMetroName();
  const cityName = location.pathname.startsWith("/events/") && city ? metroName(city) : null;
  const cityPath = location.pathname.replace(/\/+$/, "") || "/";

  useDocumentMeta({
    title: cityName
      ? `Salsa & Bachata Events in ${cityName}`
      : "Find Salsa & Bachata Events",
    description: cityName
      ? `Find salsa, bachata, and Latin dance events in ${cityName}. Browse local socials, classes, and workshops.`
      : "Find salsa, bachata, and Latin dance socials, classes, and workshops across Greater Boston and New York City.",
    canonical: canonicalUrl(cityName ? cityPath : "/"),
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
