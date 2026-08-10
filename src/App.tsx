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
const Schools = lazy(() => import("./pages/Schools"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route
              path="submit"
              element={
                <RequireAuth>
                  <SubmitEventPage />
                </RequireAuth>
              }
            />
            <Route
              path="profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              }
            />
            <Route path="lessons" element={<Lessons />} />
            <Route path="instructors" element={<Instructors />} />
            <Route path="schools" element={<Schools />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
