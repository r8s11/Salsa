import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/HomePage";
import ScrollToTop from "../components/Scroll/ScrollToTop";
import AppErrorBoundary from "../components/AppErrorBoundary/AppErrorBoundary";

// Lazy-loaded pages for better initial bundle size
const AboutPage = lazy(() => import("../pages/AboutPage"));
const ContactPage = lazy(() => import("../pages/ContactPage"));
const CalendarPage = lazy(() => import("../pages/CalendarPage"));
const SubmitEventPage = lazy(() => import("../pages/SubmitEventPage"));
const FoundersPage = lazy(() => import("../pages/founder/FoundersPage"));
const FoundersAcceptPage = lazy(() => import("../pages/founder/FoundersAcceptPage"));
const FoundersWelcomePage = lazy(() => import("../pages/founder/FoundersWelcomePage"));
const EventDetailPage = lazy(() => import("../pages/EventDetailPage"));
const Lessons = lazy(() => import("../pages/Lessons"));
const Instructors = lazy(() => import("../pages/Instructors"));
const Schools = lazy(() => import("../pages/schools/Schools"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const AdminFounderRequestsPage = lazy(() => import("../pages/admin/AdminFounderRequestsPage"));
const AdminFounderRequestDetailPage = lazy(() => import("../pages/admin/AdminFounderRequestDetailPage"));
const SignInPage = lazy(() => import("../pages/auth/SignInPage"));
const AuthCallback = lazy(() => import("../features/auth/components/AuthCallback"));
const InviteActivationPage = lazy(() => import("../features/auth/components/InviteActivationPage"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminOverviewPage = lazy(() => import("../pages/admin/AdminOverviewPage"));
const AdminEventsPage = lazy(() => import("../pages/admin/AdminEventsPage"));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminUserDetailPage = lazy(() => import("../pages/admin/AdminUserDetailPage"));
const AdminOrganizerRequestsPage = lazy(() => import("../pages/admin/AdminOrganizerRequestsPage"));
const AdminOrganizerRequestDetailPage = lazy(
  () => import("../pages/admin/AdminOrganizerRequestDetailPage")
);
const AdminVenuesPage = lazy(() => import("../pages/admin/AdminVenuesPage"));
const AdminVenueDetailPage = lazy(() => import("../pages/admin/AdminVenueDetailPage"));
const AdminTagsPage = lazy(() => import("../pages/admin/AdminTagsPage"));
const AdminTaxonomyNewPage = lazy(() => import("../pages/admin/AdminTaxonomyNewPage"));
const AdminTaxonomyDetailPage = lazy(() => import("../pages/admin/AdminTaxonomyDetailPage"));
const AdminImportEventsPage = lazy(() => import("../pages/admin/AdminImportEventsPage"));
const AdminSubmissionsPage = lazy(() => import("../pages/admin/AdminSubmissionsPage"));
const AdminSubmissionDetailPage = lazy(() => import("../pages/admin/AdminSubmissionDetailPage"));
const AdminSettingsPage = lazy(() => import("../pages/admin/AdminSettingsPage"));
const AdminActivityPage = lazy(() => import("../pages/admin/AdminActivityPage"));
const AdminActivityDetailPage = lazy(() => import("../pages/admin/AdminActivityDetailPage"));
const AdminAnalyticsPage = lazy(() => import("../pages/admin/AdminAnalyticsPage"));
const ProfilePage = lazy(() => import("../pages/account/ProfilePage"));
const ProfileEditPage = lazy(() => import("../pages/account/ProfileEditPage"));
const AccountPage = lazy(() => import("../pages/account/AccountPage"));
const HostMyEventsPage = lazy(() => import("../pages/host/HostMyEventsPage"));
const HostCreateEventPage = lazy(() => import("../pages/host/HostCreateEventPage"));
const HostEditEventPage = lazy(() => import("../pages/host/HostEditEventPage"));
const HostDashboard = lazy(() => import("../features/host/components/HostDashboard"));
const HostEventDetailPage = lazy(() => import("../pages/host/HostEventDetailPage"));
const HostAttendeeListPage = lazy(() => import("../pages/host/HostAttendeeListPage"));
const HostCheckInPage = lazy(() => import("../pages/host/HostCheckInPage"));
const HostEventImportPage = lazy(() => import("../pages/host/HostEventImportPage"));
const HostOrganizationPage = lazy(() => import("../pages/host/HostOrganizationPage"));
const UserEventEditPage = lazy(() => import("../pages/UserEventEditPage"));
import RequireAuth from "../features/auth/components/RequireAuth";
import RequireAdmin from "../features/auth/components/RequireAdmin";
import RequireReviewer from "../features/auth/components/RequireReviewer";
import RequireOrganizer from "../features/auth/components/RequireOrganizer";

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
            <Route path="/founders" element={<FoundersPage />} />
            <Route path="/founders/accept" element={<FoundersAcceptPage />} />
            <Route path="/founders/welcome" element={<FoundersWelcomePage />} />
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
                path="founder-requests"
                element={
                  <RequireReviewer>
                    <AdminFounderRequestsPage />
                  </RequireReviewer>
                }
              />
              <Route
                path="founder-requests/:id"
                element={
                  <RequireReviewer>
                    <AdminFounderRequestDetailPage />
                  </RequireReviewer>
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
              <Route path="events/import" element={<HostEventImportPage />} />
              <Route path="events/new" element={<HostCreateEventPage />} />
              <Route path="organization" element={<HostOrganizationPage />} />
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
                path="profile/edit"
                element={
                  <RequireAuth>
                    <ProfileEditPage />
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
