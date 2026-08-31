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
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const Lessons = lazy(() => import("./pages/Lessons"));
const Instructors = lazy(() => import("./pages/Instructors"));
const Schools = lazy(() => import("./pages/Schools"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AuthCallback = lazy(() => import("./components/Auth/AuthCallback"));
const InviteActivationPage = lazy(() => import("./components/Auth/InviteActivationPage"));
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
const AccountPage = lazy(() => import("./pages/AccountPage"));
const HostMyEventsPage = lazy(() => import("./pages/HostMyEventsPage"));
const HostCreateEventPage = lazy(() => import("./pages/HostCreateEventPage"));
const HostEditEventPage = lazy(() => import("./pages/HostEditEventPage"));
const HostDashboard = lazy(() => import("./components/Host/HostDashboard"));
const HostEventDetailPage = lazy(() => import("./pages/HostEventDetailPage"));
const HostAttendeeListPage = lazy(() => import("./pages/HostAttendeeListPage"));
const HostCheckInPage = lazy(() => import("./pages/HostCheckInPage"));
const UserEventEditPage = lazy(() => import("./pages/UserEventEditPage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";
import RequireReviewer from "./components/Auth/RequireReviewer";
import RequireOrganizer from "./components/Auth/RequireOrganizer";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppErrorBoundary>
        <Suspense fallback={<div className="page-loading">Loading...</div>}>
          <Routes>
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/invite" element={<InviteActivationPage />} />
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
              <Route path="events/import" element={<AdminImportEventsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="submissions/:id" element={<AdminSubmissionDetailPage />} />
              <Route path="tags" element={<AdminTagsPage />} />
              <Route path="tags/new" element={<AdminTaxonomyNewPage />} />
              <Route path="tags/:id" element={<AdminTaxonomyDetailPage />} />
              <Route
                path="users"
                element={
                  <RequireAdmin>
                    <AdminUsersPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="users/:id"
                element={
                  <RequireAdmin>
                    <AdminUserDetailPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="organizer-requests"
                element={
                  <RequireAdmin>
                    <AdminOrganizerRequestsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="organizer-requests/:id"
                element={
                  <RequireAdmin>
                    <AdminOrganizerRequestDetailPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="venues"
                element={
                  <RequireAdmin>
                    <AdminVenuesPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="venues/:id"
                element={
                  <RequireAdmin>
                    <AdminVenueDetailPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireAdmin>
                    <AdminSettingsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="activity"
                element={
                  <RequireAdmin>
                    <AdminActivityPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="activity/:id"
                element={
                  <RequireAdmin>
                    <AdminActivityDetailPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="analytics"
                element={
                  <RequireAdmin>
                    <AdminAnalyticsPage />
                  </RequireAdmin>
                }
              />
            </Route>
            <Route
              path="/host"
              element={
                <RequireOrganizer>
                  <AdminLayout />
                </RequireOrganizer>
              }
            >
              <Route index element={<HostDashboard />} />
              <Route path="events" element={<HostMyEventsPage />} />
              <Route path="events/new" element={<HostCreateEventPage />} />
              <Route path="events/:eventId" element={<HostEventDetailPage />} />
              <Route path="events/:eventId/edit" element={<HostEditEventPage />} />
              <Route path="events/:eventId/attendees" element={<HostAttendeeListPage />} />
              <Route path="events/:eventId/check-in" element={<HostCheckInPage />} />
            </Route>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="submit" element={<SubmitEventPage />} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route
                path="profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="account"
                element={
                  <RequireAuth>
                    <AccountPage />
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
