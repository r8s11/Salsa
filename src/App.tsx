import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import WorkInProgress from "./components/WIP/WorkInProgress";
import Lessons from "./pages/Lessons";
import Instructors from "./pages/Instructors";
import ScrollToTop from "./components/Scroll/ScrollToTop";
import NotFoundPage from "./pages/NotFoundPage";
import CalendarPage from "./pages/CalendarPage";

function App() {
  // Set to true to show work in progress page
  const showWIP = false;

  if (showWIP) {
    return <WorkInProgress />;
  }

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="Lessons" element={<Lessons />} />
          <Route path="Instructors" element={<Instructors />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
