import Header from "./components/Header";
import Hero from "./components/Hero";
import Events from "./components/Events";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import WorkInProgress from "./components/WorkInProgress";

function App() {
  // Set to true to show work in progress page
  const showWIP = false;

  if (showWIP) {
    return <WorkInProgress />;
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Events />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

export default App;
