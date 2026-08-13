import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import ScrollToTop from "./components/Scroll/ScrollToTop";
import AppErrorBoundary from "./components/AppErrorBoundary/AppErrorBoundary";

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
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage"));
const AdminEventsPage = lazy(() => import("./pages/AdminEventsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminUserDetailPage = lazy(() => import("./pages/AdminUserDetailPage"));
const AdminOrganizerRequestsPage = lazy(() => import("./pages/AdminOrganizerRequestsPage"));
const AdminOrganizerRequestDetailPage = lazy(() => import("./pages/AdminOrganizerRequestDetailPage"));
const AdminVenuesPage = lazy(() => import("./pages/AdminVenuesPage"));
const AdminVenueDetailPage = lazy(() => import("./pages/AdminVenueDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserEventEditPage = lazy(() => import("./pages/UserEventEditPage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppErrorBoundary>
        <Suspense fallback={<div className="page-loading">Loading...</div>}>
          <Routes>
            <Route path="/signin" element={<SignInPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="submissions" element={<AdminEventsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:id" element={<AdminUserDetailPage />} />
              <Route path="organizer-requests" element={<AdminOrganizerRequestsPage />} />
              <Route path="organizer-requests/:id" element={<AdminOrganizerRequestDetailPage />} />
              <Route path="venues" element={<AdminVenuesPage />} />
              <Route path="venues/:id" element={<AdminVenueDetailPage />} />
            </Route>
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
                path="profile/edit/:eventId"
                element={
                  <RequireAuth>
                    <UserEventEditPage />
                  </RequireAuth>
                }
              />
              <Route path="lessons" element={<Lessons />} />
              <Route path="instructors" element={<Instructors />} />
              <Route path="schools" element={<Schools />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </Router>
  );
}

export default App;
