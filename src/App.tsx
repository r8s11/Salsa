import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import ScrollToTop from "./components/Scroll/ScrollToTop";

// Lazy-loaded pages for better initial bundle size
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SubmitEventPage = lazy(() => import("./pages/SubmitEventPage"));
const Lessons = lazy(() => import("./pages/Lessons"));
const Instructors = lazy(() => import("./pages/Instructors"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="submit" element={<SubmitEventPage />} />
            <Route path="lessons" element={<Lessons />} />
            <Route path="instructors" element={<Instructors />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
