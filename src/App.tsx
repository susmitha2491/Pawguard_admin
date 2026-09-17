import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute/ProtectedRoute";
import ScrollToTop from "./components/common/ScrollToTop";
import Loader from "./components/common/Loader";

// Lazy-loaded Page Route Components for Bundle Code-Splitting
const Login = lazy(() => import("./pages/auth/Login"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Unauthorized = lazy(() => import("./pages/auth/Unauthorized"));
const PublicDogProfile = lazy(() => import("./pages/public/PublicDogProfile"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Users = lazy(() => import("./pages/users/Users"));
const Pets = lazy(() => import("./pages/pets/Pets"));
const Shelters = lazy(() => import("./pages/shelters/Shelters"));
const ShelterDogs = lazy(() => import("./pages/shelters/ShelterDogs"));
const Adoptions = lazy(() => import("./pages/adoptions/Adoptions"));
const Reports = lazy(() => import("./pages/reports/Reports"));
const MedicalRecords = lazy(() => import("./pages/medical/MedicalRecords"));
const VaccinationReminders = lazy(() => import("./pages/medical/VaccinationReminders"));

const VetAppointments = lazy(() => import("./pages/medical/VetAppointments"));

const Inventory = lazy(() => import("./pages/inventory/Inventory"));
const Finance = lazy(() => import("./pages/finance/Finance"));
const AuditLogs = lazy(() => import("./pages/audit/AuditLogs"));
const Certificates = lazy(() => import("./pages/certificates/Certificates"));
const RolesPermissions = lazy(() => import("./pages/permissions/RolesPermissions"));
const SystemSettings = lazy(() => import("./pages/settings/SystemSettings"));

const RescueManagement = lazy(() => import("./pages/rescues/RescueManagement"));
const RescueRequests = lazy(() => import("./pages/rescues/RescueRequests"));
const RescueDispatch = lazy(() => import("./pages/rescues/RescueDispatch"));
const FosterManagement = lazy(() => import("./pages/fosters/FosterManagement"));
const VolunteerManagement = lazy(() => import("./pages/volunteers/VolunteerManagement"));
const LostAndFound = lazy(() => import("./pages/lostfound/LostAndFound"));
const VehicleManagement = lazy(() => import("./pages/vehicles/VehicleManagement"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));
const NotFoundFallback = lazy(() => import("./pages/common/NotFoundFallback"));

const CmsLayout = lazy(() => import("./pages/cms/CmsLayout"));
const CmsHomeView = lazy(() => import("./pages/cms/CmsHomeView"));
const CmsPagesView = lazy(() => import("./pages/cms/CmsPagesView"));
const CmsAboutView = lazy(() => import("./pages/cms/CmsAboutView"));
const CmsSuccessStoriesView = lazy(() => import("./pages/cms/CmsSuccessStoriesView"));
const CmsArticlesView = lazy(() => import("./pages/cms/CmsArticlesView"));
const CmsFaqView = lazy(() => import("./pages/cms/CmsFaqView"));
const CmsContactView = lazy(() => import("./pages/cms/CmsContactView"));
const CmsContactInquiriesView = lazy(() => import("./pages/cms/CmsContactInquiriesView"));
const CmsLegalView = lazy(() => import("./pages/cms/CmsLegalView"));
const CmsAlertsView = lazy(() => import("./pages/cms/CmsAlertsView"));

const SuperAdminDashboard = lazy(() => import("./pages/dashboard/roles/SuperAdminDashboard"));
const RescueCentreAdminDashboard = lazy(() => import("./pages/dashboard/roles/RescueCentreAdminDashboard"));
const RescueCoordinatorDashboard = lazy(() => import("./pages/dashboard/roles/RescueCoordinatorDashboard"));
const RescueAgentDashboard = lazy(() => import("./pages/dashboard/roles/RescueAgentDashboard"));
const VeterinarianDashboard = lazy(() => import("./pages/dashboard/roles/VeterinarianDashboard"));
const ShelterManagerDashboard = lazy(() => import("./pages/dashboard/roles/ShelterManagerDashboard"));
const AdoptionCoordinatorDashboard = lazy(() => import("./pages/dashboard/roles/AdoptionCoordinatorDashboard"));
const FosterCoordinatorDashboard = lazy(() => import("./pages/dashboard/roles/FosterCoordinatorDashboard"));
const VolunteerCoordinatorDashboard = lazy(() => import("./pages/dashboard/roles/VolunteerCoordinatorDashboard"));
const VolunteerDashboard = lazy(() => import("./pages/dashboard/roles/VolunteerDashboard"));
const InventoryManagerDashboard = lazy(() => import("./pages/dashboard/roles/InventoryManagerDashboard"));
const FinanceUserDashboard = lazy(() => import("./pages/dashboard/roles/FinanceUserDashboard"));
const FosterFamilyDashboard = lazy(() => import("./pages/dashboard/roles/FosterFamilyDashboard"));
const DonorDashboard = lazy(() => import("./pages/dashboard/roles/DonorDashboard"));
const GeneralPublicDashboard = lazy(() => import("./pages/dashboard/roles/GeneralPublicDashboard"));

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<Loader />}>
        <Routes>
        {/* Public Login */}
        <Route path="/" element={<Login />} />

        {/* Public Password Reset (token comes via ?token=... from the email link) */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 403 Unauthorized Error Page */}
        <Route path="/403" element={<Unauthorized />} />

        {/* Public Dog QR Scan & Profile Pages (unauthenticated) */}
        <Route path="/public-scan/:dogId?" element={<PublicDogProfile />} />
        <Route path="/scan-pet/:dogId?" element={<PublicDogProfile />} />
        <Route path="/scan/:dogId?" element={<PublicDogProfile />} />

        {/* Protected Admin Routes for Internal Staff Only */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            {/* Dynamic Dashboard Entry */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Role-Specific Protected Dashboards (Internal Staff Roles Only) */}
            <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
              <Route path="/dashboard/super-admin" element={<SuperAdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["rescue_centre_admin", "super_admin"]} />}>
              <Route path="/dashboard/rescue-centre-admin" element={<RescueCentreAdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["rescue_coordinator", "super_admin"]} />}>
              <Route path="/dashboard/rescue-coordinator" element={<RescueCoordinatorDashboard />} />
              <Route path="/dashboard/rescue" element={<Navigate to="/dashboard/rescue-coordinator" replace />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["rescue_agent", "super_admin"]} />}>
              <Route path="/dashboard/rescue-agent" element={<RescueAgentDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["veterinarian", "super_admin"]} />}>
              <Route path="/dashboard/veterinarian" element={<VeterinarianDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["shelter_manager", "super_admin"]} />}>
              <Route path="/dashboard/shelter-manager" element={<ShelterManagerDashboard />} />
              <Route path="/dashboard/shelter-admin" element={<Navigate to="/dashboard/shelter-manager" replace />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["adoption_coordinator", "super_admin"]} />}>
              <Route path="/dashboard/adoption-coordinator" element={<AdoptionCoordinatorDashboard />} />
              <Route path="/dashboard/adoption" element={<Navigate to="/dashboard/adoption-coordinator" replace />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["foster_coordinator", "super_admin"]} />}>
              <Route path="/dashboard/foster-coordinator" element={<FosterCoordinatorDashboard />} />
              <Route path="/dashboard/foster" element={<Navigate to="/dashboard/foster-coordinator" replace />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["volunteer_coordinator", "super_admin"]} />}>
              <Route path="/dashboard/volunteer-coordinator" element={<VolunteerCoordinatorDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["volunteer", "super_admin"]} />}>
              <Route path="/dashboard/volunteer" element={<VolunteerDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["foster_family", "super_admin"]} />}>
              <Route path="/dashboard/foster-family" element={<FosterFamilyDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["donor", "super_admin"]} />}>
              <Route path="/dashboard/donor" element={<DonorDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["general_public_user", "super_admin"]} />}>
              <Route path="/dashboard/general-public" element={<GeneralPublicDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["inventory_manager", "super_admin"]} />}>
              <Route path="/dashboard/inventory-manager" element={<InventoryManagerDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["finance_user", "super_admin"]} />}>
              <Route path="/dashboard/finance" element={<FinanceUserDashboard />} />
            </Route>

            {/* Operational Module Routes with Proper RBAC Route Guards */}
            <Route
              element={
                <ProtectedRoute
                  permission="view_users"
                  allowedRoles={[
                    "super_admin",
                    "shelter_manager",
                  ]}
                />
              }
            >
              <Route path="/users" element={<Users />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission={["view_rescues", "view_rescue_requests", "view_rescue_dispatch"]}
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "rescue_coordinator",
                    "rescue_agent",
                  ]}
                />
              }
            >
              <Route path="/rescues" element={<RescueManagement />} />
              <Route path="/rescue-requests" element={<RescueRequests />} />
              <Route path="/rescue-dispatch" element={<RescueDispatch />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_animals"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "rescue_coordinator",
                    "rescue_agent",
                    "veterinarian",
                    "shelter_manager",
                    "adoption_coordinator",
                    "foster_coordinator",
                  ]}
                />
              }
            >
              <Route path="/pets" element={<Pets />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_animals"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "veterinarian",
                    "shelter_manager",
                  ]}
                />
              }
            >
              <Route path="/shelter-dogs" element={<ShelterDogs />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_shelters"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "rescue_coordinator",
                    "shelter_manager",
                    "inventory_manager",
                  ]}
                />
              }
            >
              <Route path="/shelters" element={<Shelters />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_adoptions"
                  allowedRoles={["super_admin", "adoption_coordinator", "shelter_manager"]}
                />
              }
            >
              <Route path="/adoptions" element={<Adoptions />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_foster_placements"
                  allowedRoles={["super_admin", "foster_coordinator"]}
                />
              }
            >
              <Route path="/fosters" element={<FosterManagement />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_volunteers"
                  allowedRoles={["super_admin", "volunteer_coordinator", "shelter_manager"]}
                />
              }
            >
              <Route path="/volunteers" element={<VolunteerManagement />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_lost_found"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "shelter_manager",
                    "adoption_coordinator",
                  ]}
                />
              }
            >
              <Route path="/lost-and-found" element={<LostAndFound />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_medical"
                  allowedRoles={["super_admin", "veterinarian", "shelter_manager"]}
                />
              }
            >
              <Route path="/medical-records" element={<MedicalRecords />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_medical"
                  allowedRoles={["super_admin", "veterinarian", "shelter_manager"]}
                />
              }
            >
              <Route path="/vet-directory" element={<VetAppointments />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_medical"
                  allowedRoles={["super_admin", "veterinarian", "shelter_manager"]}
                />
              }
            >
              <Route path="/medical-reminders" element={<VaccinationReminders />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_inventory"
                  allowedRoles={[
                    "super_admin",
                    "shelter_manager",
                    "inventory_manager",
                  ]}
                />
              }
            >
              <Route path="/inventory" element={<Inventory />} />
            </Route>

            <Route
              element={
                <ProtectedRoute permission="view_finance" allowedRoles={["super_admin", "finance_user"]} />
              }
            >
              <Route path="/finance" element={<Finance />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_vehicles"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                  ]}
                />
              }
            >
              <Route path="/vehicles" element={<VehicleManagement />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_reports"
                  allowedRoles={[
"super_admin",
                  "rescue_centre_admin",
                  "rescue_coordinator",
                  "veterinarian",
                  "shelter_manager",
                  "adoption_coordinator",
                  "foster_coordinator",
                  "volunteer_coordinator",
                  "finance_user",
                  "inventory_manager",
                  ]}
                />
              }
            >
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission={["view_roles", "manage_roles"]}
                  allowedRoles={["super_admin"]}
                />
              }
            >
              <Route path="/roles-permissions" element={<RolesPermissions />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_cms"
                  allowedRoles={["super_admin", "rescue_centre_admin"]}
                />
              }
            >
              <Route path="/cms" element={<CmsLayout />}>
                <Route index element={<CmsHomeView />} />
                <Route path="home" element={<CmsHomeView />} />
                <Route path="pages" element={<CmsPagesView />} />
                <Route path="about" element={<CmsAboutView />} />
                <Route path="success-stories" element={<CmsSuccessStoriesView />} />
                <Route path="articles" element={<CmsArticlesView />} />
                <Route path="faq" element={<CmsFaqView />} />
                <Route path="contact" element={<CmsContactView />} />
                <Route path="inquiries" element={<CmsContactInquiriesView />} />
                <Route path="legal" element={<CmsLegalView />} />
                <Route path="alerts" element={<CmsAlertsView />} />
              </Route>
            </Route>

            <Route
              element={
                <ProtectedRoute permission="view_audit_logs" allowedRoles={["super_admin"]} />
              }
            >
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>

            <Route
              element={
                <ProtectedRoute permission={["view_settings", "manage_settings"]} allowedRoles={["super_admin"]} />
              }
            >
              <Route path="/system-settings" element={<SystemSettings />} />
              <Route path="/settings" element={<SystemSettings />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_notifications"
                  allowedRoles={[
                    "super_admin",
                    "rescue_centre_admin",
                    "rescue_coordinator",
                    "rescue_agent",
                    "veterinarian",
                    "shelter_manager",
                    "adoption_coordinator",
                    "foster_coordinator",
                    "volunteer_coordinator",
                    "inventory_manager",
                    "finance_user",
                  ]}
                />
              }
            >
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  permission="view_certificates"
                  allowedRoles={["super_admin", "veterinarian", "adoption_coordinator", "shelter_manager"]}
                />
              }
            >
              <Route path="/certificates" element={<Certificates />} />
            </Route>

            {/* Catch-all fallback route inside AdminLayout */}
            <Route path="*" element={<NotFoundFallback />} />
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;