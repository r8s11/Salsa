import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/HomePage";
import EventsParamRoute from "../pages/EventsParamRoute";
import ScrollToTop from "../components/layout/ScrollToTop";
import AppErrorBoundary from "../components/layout/AppErrorBoundary";

// Lazy-loaded pages for better initial bundle size
const AboutPage = lazy(() => import("../pages/AboutPage"));
const ContactPage = lazy(() => import("../pages/ContactPage"));
const CalendarPage = lazy(() => import("../pages/CalendarPage"));
const SubmitEventPage = lazy(() => import("../pages/SubmitEventPage"));
// Explicit route-level lazy loading keeps non-critical shop pages out of the entry bundle.
const ShopPage = lazy(() => import("../features/shopify/pages/ShopPage"));
const ProductPage = lazy(() => import("../features/shopify/pages/ProductPage"));
const FoundersPage = lazy(() => import("../features/founder/pages/FoundersPage"));
const FoundersAcceptPage = lazy(() => import("../features/founder/pages/FoundersAcceptPage"));
const FoundersWelcomePage = lazy(() => import("../features/founder/pages/FoundersWelcomePage"));
const ShortEventLinkPage = lazy(() => import("../pages/ShortEventLinkPage"));
const PublicEntityPage = lazy(() => import("../pages/PublicEntityPage"));
const EntityDirectoryPage = lazy(() => import("../features/entities/components/EntityDirectoryPage"));
const AdminEntityDirectoryPage = lazy(
  () => import("../features/admin/entities/pages/AdminEntityDirectoryPage")
);
const AdminEntityDetailPage = lazy(
  () => import("../features/admin/entities/pages/AdminEntityDetailPage")
);
const Lessons = lazy(() => import("../pages/Lessons"));
const Instructors = lazy(() => import("../pages/Instructors"));
const Schools = lazy(() => import("../pages/Schools/Schools"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const AdminFounderRequestsPage = lazy(() => import("../features/admin/pages/AdminFounderRequestsPage"));
const AdminFounderRequestDetailPage = lazy(
  () => import("../features/admin/pages/AdminFounderRequestDetailPage")
);
const SignInPage = lazy(() => import("../pages/auth/SignInPage"));
const AuthCallback = lazy(() => import("../features/auth/pages/AuthCallback"));
const ConfirmSignupPage = lazy(() => import("../features/auth/pages/ConfirmSignupPage"));
const InviteActivationPage = lazy(() => import("../features/auth/pages/InviteActivationPage"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminOverviewPage = lazy(() => import("../features/admin/pages/AdminOverviewPage"));
const AdminEventsPage = lazy(() => import("../features/admin/pages/AdminEventsPage"));
const AdminUsersPage = lazy(() => import("../features/admin/pages/AdminUsersPage"));
const AdminUserDetailPage = lazy(() => import("../features/admin/pages/AdminUserDetailPage"));
const AdminOrganizerRequestsPage = lazy(() => import("../features/admin/pages/AdminOrganizerRequestsPage"));
const AdminOrganizerRequestDetailPage = lazy(
  () => import("../features/admin/pages/AdminOrganizerRequestDetailPage")
);
const AdminVenuesPage = lazy(() => import("../features/admin/pages/AdminVenuesPage"));
const AdminVenueDetailPage = lazy(() => import("../features/admin/pages/AdminVenueDetailPage"));
const AdminTagsPage = lazy(() => import("../features/admin/pages/AdminTagsPage"));
const AdminTaxonomyNewPage = lazy(() => import("../features/admin/pages/AdminTaxonomyNewPage"));
const AdminTaxonomyDetailPage = lazy(() => import("../features/admin/pages/AdminTaxonomyDetailPage"));
const AdminImportEventsPage = lazy(() => import("../features/admin/pages/AdminImportEventsPage"));
const AdminSubmissionsPage = lazy(() => import("../features/admin/pages/AdminSubmissionsPage"));
const AdminSubmissionDetailPage = lazy(() => import("../features/admin/pages/AdminSubmissionDetailPage"));
const AdminSettingsPage = lazy(() => import("../features/admin/pages/AdminSettingsPage"));
const AdminActivityPage = lazy(() => import("../features/admin/pages/AdminActivityPage"));
const AdminActivityDetailPage = lazy(() => import("../features/admin/pages/AdminActivityDetailPage"));
const AdminAnalyticsPage = lazy(() => import("../features/admin/pages/AdminAnalyticsPage"));
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
const BulkFlyerImportPage = lazy(() => import("../pages/BulkFlyerImportPage"));
const HostOrganizationPage = lazy(() => import("../pages/host/HostOrganizationPage"));
const UserEventEditPage = lazy(() => import("../pages/UserEventEditPage"));
const OnboardingPage = lazy(() => import("../pages/account/OnboardingPage"));
const AdminEntityClaimsPage = lazy(() => import("../features/admin/pages/AdminEntityClaimsPage"));
const EntityWorkspaceOverviewPage = lazy(() => import("../features/workspaces/pages/EntityWorkspaceOverviewPage"));
const EntityWorkspaceProfilePage = lazy(() => import("../features/workspaces/pages/EntityWorkspaceProfilePage"));
const EntityWorkspaceTeamPage = lazy(() => import("../features/workspaces/pages/EntityWorkspaceTeamPage"));
const SchoolTimetablePage = lazy(() => import("../features/workspaces/pages/SchoolTimetablePage"));
const SchoolPrivatesPage = lazy(() => import("../features/workspaces/pages/SchoolPrivatesPage"));
const SchoolPricesPage = lazy(() => import("../features/workspaces/pages/SchoolPricesPage"));
import RequireAuth from "../features/auth/components/RequireAuth";
import RequireAdmin from "../features/auth/components/RequireAdmin";
import { MANAGED_KINDS, WORKSPACE_SEGMENTS } from "../features/workspaces/model";
import RequireReviewer from "../features/auth/components/RequireReviewer";
import RequireOrganizer from "../features/auth/components/RequireOrganizer";
import RequireOnboarding from "../features/auth/components/RequireOnboarding";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppErrorBoundary>
        <Suspense fallback={<div className="page-loading">Loading...</div>}>
          <Routes>
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/confirm" element={<ConfirmSignupPage />} />
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
              <Route
                path="events/import-flyers"
                element={
                  <RequireAdmin>
                    <BulkFlyerImportPage mode="admin" />
                  </RequireAdmin>
                }
              />
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
              {(["series", "organizer", "school", "instructor"] as const).map((kind) => {
                const path = kind === "series" ? "series" : `${kind}s`;
                return (
                  <Route key={kind}>
                    <Route path={path} element={<RequireAdmin><AdminEntityDirectoryPage kind={kind} /></RequireAdmin>} />
                    <Route path={`${path}/new`} element={<RequireAdmin><AdminEntityDetailPage kind={kind} mode="create" /></RequireAdmin>} />
                    <Route path={`${path}/:id`} element={<RequireAdmin><AdminEntityDetailPage kind={kind} /></RequireAdmin>} />
                  </Route>
                );
              })}
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
              <Route
                path="claims"
                element={
                  <RequireAdmin>
                    <AdminEntityClaimsPage />
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
              <Route path="events/import-flyers" element={<BulkFlyerImportPage mode="host" />} />
              <Route path="events/new" element={<HostCreateEventPage />} />
              <Route path="organization" element={<HostOrganizationPage />} />
              <Route path="events/:eventId" element={<HostEventDetailPage />} />
              <Route path="events/:eventId/edit" element={<HostEditEventPage />} />
              <Route path="events/:eventId/attendees" element={<HostAttendeeListPage />} />
              <Route path="events/:eventId/check-in" element={<HostCheckInPage />} />
              {MANAGED_KINDS.map((kind) => (
                <Route key={kind} path={`${WORKSPACE_SEGMENTS[kind]}/:id`}>
                  <Route index element={<EntityWorkspaceOverviewPage kind={kind} />} />
                  <Route path="profile" element={<EntityWorkspaceProfilePage kind={kind} />} />
                  <Route path="team" element={<EntityWorkspaceTeamPage kind={kind} />} />
                </Route>
              ))}
              <Route path="schools/:id/timetable" element={<SchoolTimetablePage />} />
              <Route path="schools/:id/privates" element={<SchoolPrivatesPage />} />
              <Route path="schools/:id/prices" element={<SchoolPricesPage />} />
            </Route>
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="submit" element={<SubmitEventPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="shop/products/:handle" element={<ProductPage />} />
              <Route path="events/:id" element={<EventsParamRoute />} />
              <Route path="e/:code" element={<ShortEventLinkPage />} />
              <Route path="v/:slug" element={<PublicEntityPage kind="venue" />} />
              <Route path="o/:slug" element={<PublicEntityPage kind="organizer" />} />
              <Route path="i/:slug" element={<PublicEntityPage kind="instructor" />} />
              <Route path="s/:slug" element={<PublicEntityPage kind="school" />} />
              <Route path="discover" element={<EntityDirectoryPage />} />
              <Route path="series" element={<EntityDirectoryPage kind="series" />} />
              <Route path="organizers" element={<EntityDirectoryPage kind="organizer" />} />
              <Route path="venues" element={<EntityDirectoryPage kind="venue" />} />
              <Route path="cities" element={<EntityDirectoryPage kind="city" />} />
              <Route path="styles" element={<EntityDirectoryPage kind="style" />} />
              <Route path="series/:slug" element={<PublicEntityPage kind="series" />} />
              <Route path="cities/:slug" element={<PublicEntityPage kind="city" />} />
              <Route path="styles/:slug" element={<PublicEntityPage kind="style" />} />
              <Route
                path="profile"
                element={
                  <RequireAuth>
                    <RequireOnboarding>
                      <ProfilePage />
                    </RequireOnboarding>
                  </RequireAuth>
                }
              />
              <Route
                path="profile/edit"
                element={
                  <RequireAuth>
                    <RequireOnboarding>
                      <ProfileEditPage />
                    </RequireOnboarding>
                  </RequireAuth>
                }
              />
              <Route
                path="account"
                element={
                  <RequireAuth>
                    <RequireOnboarding>
                      <AccountPage />
                    </RequireOnboarding>
                  </RequireAuth>
                }
              />
              <Route
                path="profile/edit/:eventId"
                element={
                  <RequireAuth>
                    <RequireOnboarding>
                      <UserEventEditPage />
                    </RequireOnboarding>
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
