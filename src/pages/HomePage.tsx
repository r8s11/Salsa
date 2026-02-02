import Hero from "../components/Hero/Hero";
import Events from "../components/Events/Events";
import Contact from "../components/Contact/Contact";
import SupabaseTest from "../components/SupabaseTest";

function HomePage() {
  return (
    <>
      <Hero />
      <SupabaseTest />
      <Events />
      <Contact />
    </>
  );
}

export default HomePage;
