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
const AdminOrganizerRequestDetailPage = lazy(
  () => import("./pages/AdminOrganizerRequestDetailPage")
);
const AdminVenuesPage = lazy(() => import("./pages/AdminVenuesPage"));
const AdminVenueDetailPage = lazy(() => import("./pages/AdminVenueDetailPage"));
const AdminTagsPage = lazy(() => import("./pages/AdminTagsPage"));
const AdminTaxonomyNewPage = lazy(() => import("./pages/AdminTaxonomyNewPage"));
const AdminTaxonomyDetailPage = lazy(() => import("./pages/AdminTaxonomyDetailPage"));
const AdminImportEventsPage = lazy(() => import("./pages/AdminImportEventsPage"));
const AdminSubmissionsPage = lazy(() => import("./pages/Admin/AdminSubmissionsPage"));
const AdminSubmissionDetailPage = lazy(() => import("./pages/Admin/AdminSubmissionDetailPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminActivityPage = lazy(() => import("./pages/AdminActivityPage"));
const AdminActivityDetailPage = lazy(() => import("./pages/AdminActivityDetailPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const HostMyEventsPage = lazy(() => import("./pages/HostMyEventsPage"));
const UserEventEditPage = lazy(() => import("./pages/UserEventEditPage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";
import RequireReviewer from "./components/Auth/RequireReviewer";

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
                <RequireReviewer>
                  <AdminLayout />
                </RequireReviewer>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="host/events" element={<HostMyEventsPage />} />
              <Route path="events/import" element={<AdminImportEventsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="submissions/:id" element={<AdminSubmissionDetailPage />} />
              <Route path="tags" element={<AdminTagsPage />} />
              <Route path="tags/new" element={<AdminTaxonomyNewPage />} />
              <Route path="tags/:id" element={<AdminTaxonomyDetailPage />} />
              <Route path="users" element={
                <RequireAdmin>
                  <AdminUsersPage />
                </RequireAdmin>
              } />
              <Route path="users/:id" element={
                <RequireAdmin>
                  <AdminUserDetailPage />
                </RequireAdmin>
              } />
              <Route path="organizer-requests" element={
                <RequireAdmin>
                  <AdminOrganizerRequestsPage />
                </RequireAdmin>
              } />
              <Route path="organizer-requests/:id" element={
                <RequireAdmin>
                  <AdminOrganizerRequestDetailPage />
                </RequireAdmin>
              } />
              <Route path="venues" element={
                <RequireAdmin>
                  <AdminVenuesPage />
                </RequireAdmin>
              } />
              <Route path="venues/:id" element={
                <RequireAdmin>
                  <AdminVenueDetailPage />
                </RequireAdmin>
              } />
              <Route path="settings" element={
                <RequireAdmin>
                  <AdminSettingsPage />
                </RequireAdmin>
              } />
              <Route path="activity" element={
                <RequireAdmin>
                  <AdminActivityPage />
                </RequireAdmin>
              } />
              <Route path="activity/:id" element={
                <RequireAdmin>
                  <AdminActivityDetailPage />
                </RequireAdmin>
              } />
              <Route path="analytics" element={
                <RequireAdmin>
                  <AdminAnalyticsPage />
                </RequireAdmin>
              } />
            </Route>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="submit" element={<SubmitEventPage />} />
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
