import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import Unauthorized from "./pages/auth/Unauthorized";
import PublicDogProfile from "./pages/public/PublicDogProfile";
import Dashboard from "./pages/dashboard/Dashboard";
import Users from "./pages/users/Users";
import Pets from "./pages/pets/Pets";
import Shelters from "./pages/shelters/Shelters";
import ShelterDogs from "./pages/shelters/ShelterDogs";
import Adoptions from "./pages/adoptions/Adoptions";
import Reports from "./pages/reports/Reports";
import MedicalRecords from "./pages/medical/MedicalRecords";
import VaccinationReminders from "./pages/medical/VaccinationReminders";

import VetAppointments from "./pages/medical/VetAppointments";

import Inventory from "./pages/inventory/Inventory";
import Finance from "./pages/finance/Finance";
import AuditLogs from "./pages/audit/AuditLogs";
import Certificates from "./pages/certificates/Certificates";
import RolesPermissions from "./pages/permissions/RolesPermissions";
import SystemSettings from "./pages/settings/SystemSettings";

import RescueManagement from "./pages/rescues/RescueManagement";
import RescueRequests from "./pages/rescues/RescueRequests";
import RescueDispatch from "./pages/rescues/RescueDispatch";
import FosterManagement from "./pages/fosters/FosterManagement";
import VolunteerManagement from "./pages/volunteers/VolunteerManagement";
import LostAndFound from "./pages/lostfound/LostAndFound";
import VehicleManagement from "./pages/vehicles/VehicleManagement";
import Notifications from "./pages/notifications/Notifications";

import CmsLayout from "./pages/cms/CmsLayout";
import CmsPagesView from "./pages/cms/CmsPagesView";
import CmsAboutView from "./pages/cms/CmsAboutView";
import CmsSuccessStoriesView from "./pages/cms/CmsSuccessStoriesView";
import CmsArticlesView from "./pages/cms/CmsArticlesView";
import CmsFaqView from "./pages/cms/CmsFaqView";
import CmsContactView from "./pages/cms/CmsContactView";
import CmsLegalView from "./pages/cms/CmsLegalView";
import CmsAlertsView from "./pages/cms/CmsAlertsView";

import SuperAdminDashboard from "./pages/dashboard/roles/SuperAdminDashboard";
import RescueCentreAdminDashboard from "./pages/dashboard/roles/RescueCentreAdminDashboard";
import RescueCoordinatorDashboard from "./pages/dashboard/roles/RescueCoordinatorDashboard";
import RescueAgentDashboard from "./pages/dashboard/roles/RescueAgentDashboard";
import VeterinarianDashboard from "./pages/dashboard/roles/VeterinarianDashboard";
import ShelterManagerDashboard from "./pages/dashboard/roles/ShelterManagerDashboard";
import AdoptionCoordinatorDashboard from "./pages/dashboard/roles/AdoptionCoordinatorDashboard";
import FosterCoordinatorDashboard from "./pages/dashboard/roles/FosterCoordinatorDashboard";
import VolunteerCoordinatorDashboard from "./pages/dashboard/roles/VolunteerCoordinatorDashboard";
import VolunteerDashboard from "./pages/dashboard/roles/VolunteerDashboard";
import InventoryManagerDashboard from "./pages/dashboard/roles/InventoryManagerDashboard";
import FinanceUserDashboard from "./pages/dashboard/roles/FinanceUserDashboard";
import FosterFamilyDashboard from "./pages/dashboard/roles/FosterFamilyDashboard";
import DonorDashboard from "./pages/dashboard/roles/DonorDashboard";
import GeneralPublicDashboard from "./pages/dashboard/roles/GeneralPublicDashboard";

import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute/ProtectedRoute";
import ScrollToTop from "./components/common/ScrollToTop";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
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
                  allowedRoles={["super_admin"]}
                />
              }
            >
              <Route path="/cms" element={<CmsLayout />}>
                <Route index element={<CmsPagesView />} />
                <Route path="pages" element={<CmsPagesView />} />
                <Route path="about" element={<CmsAboutView />} />
                <Route path="success-stories" element={<CmsSuccessStoriesView />} />
                <Route path="articles" element={<CmsArticlesView />} />
                <Route path="faq" element={<CmsFaqView />} />
                <Route path="contact" element={<CmsContactView />} />
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
                  allowedRoles={["super_admin", "veterinarian"]}
                />
              }
            >
              <Route path="/certificates" element={<Certificates />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;