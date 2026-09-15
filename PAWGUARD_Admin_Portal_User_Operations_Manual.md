# PAWGUARD ADMIN PORTAL
## COMPLETE USER OPERATIONS MANUAL

**Document Code:** MAN-PAWGUARD-ADMIN-2026-V1  
**Version:** 1.2.0  
**Document Status:** Official Organization User Operations Manual  
**Prepared For:** PawGuard Operational Staff, Facility Managers & Client Leadership  
**Prepared By:** PawGuard Systems Engineering & Documentation Team  
**Date:** September 16, 2026  

---

## DOCUMENT CONTROL

| Property | Details |
| :--- | :--- |
| **Document Title** | PawGuard Admin Portal Complete User Operations Manual |
| **Document Owner** | PawGuard System Administration & Operations Team |
| **Target Audience** | All PawGuard Administrative Staff, Field Agents, Vets, Managers & Coordinators |
| **Classification** | Internal Operational Manual — Confidential |
| **System Version** | PawGuard Admin Web Application v1.0 (Build 2026.09) |
| **Backend Integration** | PawGuard FastAPI Live Backend API Service (`https://pawguard-backend-dev.onrender.com`) |

---

## TABLE OF CONTENTS

1. [INTRODUCTION](#1-introduction)
2. [ABOUT THE PAWGUARD ADMIN PORTAL](#2-about-the-pawguard-admin-portal)
3. [ACCESSING THE SYSTEM](#3-accessing-the-system)
4. [UNDERSTANDING THE ADMIN PORTAL](#4-understanding-the-admin-portal)
5. [ROLES AND PERMISSIONS](#5-roles-and-permissions)
6. [DASHBOARD AND COMMON UI OPERATIONS](#6-dashboard-and-common-ui-operations)
7. [RESCUE OPERATIONS](#7-rescue-operations)
8. [DOG MASTER MANAGEMENT](#8-dog-master-management)
9. [SHELTER OPERATIONS](#9-shelter-operations)
10. [MEDICAL OPERATIONS](#10-medical-operations)
11. [ADOPTION OPERATIONS](#11-adoption-operations)
12. [FOSTER OPERATIONS](#12-foster-operations)
13. [VOLUNTEER OPERATIONS](#13-volunteer-operations)
14. [INVENTORY OPERATIONS](#14-inventory-operations)
15. [VEHICLE & FLEET OPERATIONS](#15-vehicle--fleet-operations)
16. [FINANCE & DONATION OPERATIONS](#16-finance--donation-operations)
17. [LOST & FOUND](#17-lost--found)
18. [CERTIFICATES](#18-certificates)
19. [REPORTS & ANALYTICS](#19-reports--analytics)
20. [NOTIFICATIONS](#20-notifications)
21. [AUDIT LOGS](#21-audit-logs)
22. [SYSTEM SETTINGS](#22-system-settings)
23. [CMS / ADMINISTRATIVE CONTENT](#23-cms--administrative-content)
24. [END-TO-END OPERATIONAL WORKFLOWS](#24-end-to-end-operational-workflows)
25. [ROLE-SPECIFIC QUICK START GUIDES](#25-role-specific-quick-start-guides)
26. [SECURITY & RBAC](#26-security--rbac)
27. [TROUBLESHOOTING](#27-troubleshooting)
28. [GLOSSARY](#28-glossary)
29. [CLIENT REQUIREMENTS COVERAGE](#29-client-requirements-coverage)
30. [DOCUMENT CHANGE HISTORY](#30-document-change-history)

---

## 1. INTRODUCTION

### 1.1 Welcome to PawGuard
Welcome to PawGuard! The PawGuard Admin Portal is the central operational hub designed to manage animal rescue emergencies, shelter admissions, veterinary medical records, foster placements, adoption contracts, volunteer shifts, inventory logistics, vehicle fleets, and financial ledgers across PawGuard facilities.

This **User Operations Manual** serves as your authoritative reference for navigating and operating the PawGuard Admin Website. Whether you are a newly onboarded Rescue Agent responding to field calls, a Veterinarian recording clinical examinations, a Shelter Manager overseeing kennel capacity, or an Adoption Coordinator vetting applicants, this document provides complete step-by-step guidance tailored to your daily work.

### 1.2 Purpose of This Manual
This manual is designed for operational clarity. It explains:
- What each module in the PawGuard Admin Portal does.
- Which screens, tables, forms, and actions you can access based on your assigned role.
- How to complete operational workflows step by step.
- What status changes mean and what happens after you click a button.
- How to handle operational errors, validation warnings, or data restrictions.
- What actions you are allowed or restricted from performing under Role-Based Access Control (RBAC).

### 1.3 How to Use This Manual
- **New Staff Members:** Begin with [Section 3 (Accessing the System)](#3-accessing-the-system), [Section 4 (Understanding the Admin Portal)](#4-understanding-the-admin-portal), and [Section 5 (Roles and Permissions)](#5-roles-and-permissions).
- **Role-Specific Daily Guidance:** Go directly to [Section 25 (Role-Specific Quick Start Guides)](#25-role-specific-quick-start-guides) to see your exact start-of-day checklist.
- **Module Procedures:** Refer to Sections 7 through 23 for deep-dive instructions on specific modules.
- **Cross-Departmental Handoffs:** Refer to [Section 24 (End-to-End Operational Workflows)](#24-end-to-end-operational-workflows) to see how your actions connect to other roles.

---

## 2. ABOUT THE PAWGUARD ADMIN PORTAL

### 2.1 Core Mission
The PawGuard Admin Portal provides a unified management platform for stray animal rescue, shelter intake, healthcare, and adoption lifecycle management. By eliminating fragmented offline records and spreadsheet silos, PawGuard ensures complete accountability, data persistence, adoption exclusivity, and transparent animal welfare governance.

### 2.2 System Architecture Overview
The PawGuard Web Ecosystem consists of three interconnected layers:
1. **Public Web Portal:** Used by citizens to report stray dog emergencies, browse adoptable dogs, submit adoption or foster applications, report lost/found pets, submit public inquiries, and donate.
2. **Admin Portal (This System):** Used by internal staff to moderate incoming rescue calls, dispatch field teams, track kennel occupancy, record clinical exams, process adoptions, manage inventory, dispatch vehicles, and run executive analytics.
3. **Live Backend API Service:** Centralized cloud engine (`https://pawguard-backend-dev.onrender.com`) enforcing data persistence, authentication, authorization rules, database integrity, and multi-tenant security.

---

## 3. ACCESSING THE SYSTEM

### 3.1 Login Screen (`/`)
To access the PawGuard Admin Portal:
1. Open your desktop or tablet web browser and navigate to the Admin Portal web address.
2. The **Sign In to PawGuard Admin Portal** screen will display.
3. Enter your assigned **Email Address** and **Password**.
4. Click **Sign In**.
5. Upon successful authentication, the system stores your secure JWT session credential in browser web storage (`localStorage`) and automatically redirects you to your role-specific dashboard (e.g. `/dashboard/rescue-coordinator`, `/dashboard/veterinarian`, or `/dashboard/super-admin`).

### 3.2 Authentication & Security Safeguards
- **JWT Authentication:** Authentication uses JWT-based session credentials managed by the Admin Portal. The current web implementation manages authentication token data in browser `localStorage` through the application's auth storage mechanism.
- **Automatic 401 Expiration:** If your token expires or is invalidated by an administrator, the portal safely logs you out, clears local storage cache, and returns you to the login screen with a clean session alert.
- **Invalid Credentials:** If you enter an incorrect email or password, an error message ("Invalid email or password") will display. No partial session data is loaded.

### 3.3 Password Reset (`/reset-password`)
If you forget your password or receive a password reset link via email:
1. Click the link provided in your official PawGuard email notification.
2. You will be directed to `/reset-password?token=YOUR_RESET_TOKEN`.
3. Enter your **New Password** and confirm it.
4. Click **Reset Password**.
5. Once confirmed, you will be redirected to the login screen to sign in with your new password.

### 3.4 Unauthorized Access Page (`/403`)
If you attempt to open a URL route or click a module link that your assigned role does not have permission to view, the system will immediately block the request and render the **403 Access Denied** page.
- **Message:** *"Access Denied: You do not have permission to view this section."*
- **Action:** Click the **Back to My Dashboard** button to return safely to your authorized dashboard.

### 3.5 Public QR Code Scanning Entrypoints (`/public-scan/:dogId`, `/scan-pet/:dogId`, `/scan/:dogId`)
PawGuard animals are assigned unique QR Safety Tags attached to their physical collars.
- When scanned by authorized PawGuard staff (Super Admin, Shelter Manager, Vet, Rescue Coordinator/Agent, Foster), the portal verifies credentials and opens the full internal **Dog Master Profile** (`/pets?id=...`).
- When scanned by a member of the public, it displays a public-safe profile with non-sensitive animal details and emergency shelter contact buttons.

---

## 4. UNDERSTANDING THE ADMIN PORTAL

### 4.1 Interface Layout Overview
The PawGuard Admin Portal UI is built on a responsive, high-contrast, professional design system consisting of three main structural components:

```
+-----------------------------------------------------------------------------------+
|  BRAND LOGO | HEADER BAR: Search | Active Role Badge | Notifications | Profile     |
+------------------+----------------------------------------------------------------+
| NAV SIDEBAR      | MAIN CONTENT VIEWPORT                                          |
| - Dashboard      |                                                                |
| - Rescue Ops     | [ Page Header & Breadcrumb Navigation ]                        |
| - Dog Master     | [ Metric Cards & Quick Stat Widgets ]                          |
| - Shelter Ops    | [ Filters & Search Controls ]                                  |
| - Medical Suite  | [ Data Tables / Card Grids / Action Modals ]                   |
| - Adoptions      |                                                                |
| - Inventory      |                                                                |
| - Fleet          |                                                                |
| - Reports        |                                                                |
| - Settings       |                                                                |
| - Logout         |                                                                |
+------------------+----------------------------------------------------------------+
```

### 4.2 Header Bar Controls
Located at the top of every screen:
1. **Brand Logo & Title:** Displays the PawGuard mark and returns to your main dashboard when clicked.
2. **Global Search Input:** Allows searching across dogs, rescue cases, and volunteers.
3. **Active Role & Facility Badge:** Displays your current operating role (e.g. *Rescue Coordinator*) and assigned facility context.
4. **Notifications Indicator (Bell Icon):** Displays an unread badge counter for dispatch, medical, and approval alerts. Click to open the Notifications Drawer (`/notifications`).
5. **User Profile Dropdown:** Displays your name and email, allows profile inspection, and provides the **Logout** button.

### 4.3 Navigation Sidebar (Dark Navy Sidebar)
Fixed on the left side of the screen (`#0F172A` background):
- Displays only the specific modules permitted for your active role under RBAC rules.
- Highlighted in solid royal blue (`#1E3A8A`) with a white accent bar when active.
- Collapsible on desktop screens to increase viewport width; turns into an overlay drawer on mobile/tablet viewports.
- Bottom section contains the red-accented **Logout** trigger.

### 4.4 Responsive Layout & Screen Adaptation
- **Desktop (1280px+):** Full multi-column viewports, expanded sidebar, side-by-side data cards.
- **Laptop / Tablet (768px - 1024px):** Collapsible sidebar, 2-column card grids, horizontally scrollable data tables.
- **Mobile (375px - 414px):** Touch-optimized touch targets (minimum 44px height), full-width modals, slide-out mobile drawer menu.

---

## 5. ROLES AND PERMISSIONS

### 5.1 Role Architecture Baseline
PawGuard enforces Role-Based Access Control (RBAC). Every staff user account is assigned an operational role that governs navigation visibility, route protection, API access, and action privileges.

There are **15 operational roles** defined in the PawGuard Admin Ecosystem:

#### 1. Super Administrator (`super_admin`)
- **Purpose:** Full global system ownership, system governance, and cross-facility administration.
- **Accessible Modules:** All 23 portal modules, including User Management, Roles & Permissions, CMS Management, Audit Logs, and System Settings.
- **Special Capabilities:** Can view any role's dashboard via the active role menu switcher without modifying authentication context.

#### 2. Rescue Centre Admin (`rescue_centre_admin`)
- **Purpose:** Facility-level operational administration for a specific rescue centre.
- **Accessible Modules:** Rescue Management, Rescue Requests, Dispatch, Dog Profiles, Shelter Directory, Vehicle Fleet (`/vehicles`), Reports, Notifications, and CMS Inquiries.
- **Restricted Modules:** Global User RBAC editing, System Settings, Financial Ledgers.

#### 3. Rescue Coordinator (`rescue_coordinator`)
- **Purpose:** Incident moderation, emergency triage, field dispatch, and rescue lifecycle monitoring.
- **Accessible Modules:** Rescue Requests, Rescue Dispatch, Dog Master, Shelter Directory, Reports & Analytics, Notifications.
- **Restricted Modules:** Vehicle Fleet (`/vehicles` is restricted to Super Admin and Rescue Centre Admin), clinical surgery forms, financial ledgers, system settings.

#### 4. Rescue Agent (`rescue_agent`)
- **Purpose:** Field execution, emergency ambulance transit, animal capture, and shelter delivery.
- **Accessible Modules:** My Assigned Rescues, Rescue Dispatch & Tracking, Dog Master, Notifications.
- **Restricted Modules:** Dispatch creation, facility management, adoption approvals, vehicle fleet management.

#### 5. Veterinarian (`veterinarian`)
- **Purpose:** Clinical exams, surgeries, treatments, vaccination scheduling, and health certification.
- **Accessible Modules:** Medical Records, Vet Directory & Appointments, Vaccination Reminders, Dog Master, Health Certificates, Medical Reports.
- **Restricted Modules:** Fleet dispatch, vehicle management, financial ledgers, CMS management.

#### 6. Shelter Manager (`shelter_manager`)
- **Purpose:** Facility oversight, kennel allocation, sanitation status, facility shelter staff (`/users`), and intake vet check requests.
- **Accessible Modules:** Shelter Facilities, Shelter Dogs, Dog Master, Shelter Staff (`/users`), Medical Records, Vaccination Reminders, Adoptions, Lost & Found, Inventory, Reports, Notifications.
- **Restricted Modules:** Global RBAC, global system settings, vehicle fleet management.
- **Access Scope Note:** User Management access is scoped to staff within their assigned facility context (`rescue_centre_id`).

#### 7. Adoption Coordinator (`adoption_coordinator`)
- **Purpose:** Adoption application vetting, applicant home checks, contract issuance, and exclusivity enforcement.
- **Accessible Modules:** Adoptions, Adoptable Dogs (`/pets`), Lost & Found, Adoption Reports, Certificates.
- **Restricted Modules:** Clinical surgery forms, vehicle fleet dispatch, inventory adjustment.

#### 8. Foster Coordinator (`foster_coordinator`)
- **Purpose:** Foster caregiver roster management, capacity tracking, placement matching, and care monitoring.
- **Accessible Modules:** Foster Management, Foster Dogs (`/pets`), Reports, Notifications.
- **Restricted Modules:** Vehicle dispatch, vehicle management, financial ledgers.

#### 9. Volunteer Coordinator (`volunteer_coordinator`)
- **Purpose:** Volunteer onboarding, shift scheduling, duty rosters, and service hour logging.
- **Accessible Modules:** Volunteer Directory, Schedules & Reports, Notifications.
- **Restricted Modules:** Clinical medical records, adoption approvals, vehicle fleet.

#### 10. Inventory Manager (`inventory_manager`)
- **Purpose:** Stock tracking, reorder point enforcement, batch/expiry alerts, and stock adjustments.
- **Accessible Modules:** Inventory & Stock, Shelters & Storage, Reports, Notifications.
- **Restricted Modules:** Adoption contracts, clinical examinations, vehicle fleet.

#### 11. Finance User (`finance_user`)
- **Purpose:** Financial ledger management, donation receipts, campaign analytics, and financial auditing.
- **Accessible Modules:** Finance & Donations, Financial Reports.
- **Restricted Modules:** Clinical exams, rescue dispatch, vehicle fleet.

#### 12. Volunteer (`volunteer`)
- **Purpose:** Field volunteer viewing shift schedules, attendance check-in, and duty logs.
- **Accessible Modules:** Volunteer Dashboard (`/dashboard/volunteer` with tabs for shifts, attendance, feedback).

#### 13. Foster Family (`foster_family`)
- **Purpose:** Registered foster caregiver logging daily pet progress, medical symptoms, and supply requests.
- **Accessible Modules:** Foster Family Dashboard (`/dashboard/foster-family`).

#### 14. Donor (`donor`)
- **Purpose:** Donor viewing personal contribution history, active dog sponsorships, and tax receipts.
- **Accessible Modules:** Donor Dashboard (`/dashboard/donor`).

#### 15. General Public User (`general_public_user`)
- **Purpose:** Registered public account tracking submitted rescue calls or adoption applications.
- **Accessible Modules:** General Public Dashboard (`/dashboard/general-public`).

---

### 5.2 Master Role-Permission Matrix

| Operational Role | Rescue & Dispatch | Dog Master | Shelter Ops | Medical Suite | Adoptions | Fosters | Volunteers | Inventory | Vehicle Fleet (`/vehicles`) | Finance | Reports | CMS & Settings | User Admin & RBAC |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Super Administrator** | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| **Rescue Centre Admin** | FULL | FULL | READ | READ | READ | READ | READ | READ | FULL | READ | FULL | CMS | RESTRICTED |
| **Rescue Coordinator** | FULL | FULL | READ | READ | BLOCKED | BLOCKED | BLOCKED | BLOCKED | **BLOCKED** | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Rescue Agent** | FIELD | READ | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| **Shelter Manager** | READ | FULL | FULL | READ/REQ | READ | READ | READ | FULL | BLOCKED | BLOCKED | FULL | BLOCKED | SCOPED |
| **Veterinarian** | READ | READ | READ | FULL | READ | READ | BLOCKED | READ | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Adoption Coordinator**| BLOCKED | READ | READ | READ | FULL | READ | BLOCKED | BLOCKED | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Foster Coordinator** | BLOCKED | READ | READ | READ | READ | FULL | BLOCKED | BLOCKED | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Volunteer Coordinator**| BLOCKED | READ | READ | BLOCKED | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Inventory Manager** | BLOCKED | READ | READ | BLOCKED | BLOCKED | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED | FULL | BLOCKED | BLOCKED |
| **Finance User** | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | FULL | FULL | BLOCKED | BLOCKED |

---

## 6. DASHBOARD AND COMMON UI OPERATIONS

### 6.1 Role-Based Dashboards
Upon logging in, PawGuard automatically loads your specific role dashboard:
- **Metrics Bar:** Renders top-level summary cards displaying counts (e.g. *Active Rescues*, *Occupied Kennels*, *Pending Vet Checks*, *Adoptable Dogs*).
- **Interactive Action Feed:** Displays pending tasks requiring your immediate intervention.
- **Tabbed Views:** Allows switching between assigned workloads, historical logs, and roster tables.

### 6.2 Master Data Table Operations (`DataTable`)
All major module data lists (Dogs, Rescues, Volunteers, Inventory, Medical Records) use standardized, interactive tables:
1. **Search Bar:** Type keywords (name, registration number, phone, microchip) into the search box to filter rows instantly.
2. **Column Sorting:** Click any column header with arrows to sort ascending or descending.
3. **Status Filter Dropdowns:** Filter records by operational status (e.g., `verified`, `dispatched`, `occupied`, `in_progress`).
4. **Pagination Bar:** Use the **Previous** and **Next** buttons at the bottom right to navigate pages. Select items-per-page (10, 25, 50, 100).
5. **Action Buttons:** Located in the rightmost column for row-level operations (**View Details**, **Edit**, **Assign**, **Update Status**, **Delete**).

### 6.3 Standardized Status Badges & Color Coding
To ensure visual consistency across all modules, status badges follow strict color rules:
- **Red (`#DC2626` / `#FEE2E2`):** Emergency / Critical / Overdue / Rejected / Out of Service / Expired / Low Stock Danger.
- **Orange / Amber (`#D97706` / `#FEF3C7`):** Pending / High Priority / Warning / Cleaning Required / In Treatment / Reorder Warning.
- **Blue (`#2563EB` / `#DBEAFE`):** Dispatched / En Route / In Review / Scheduled / Active Placement.
- **Green (`#16A34A` / `#DCFCE7`):** Verified / Located / Secured / Admitted / Available / Disinfected / Adopted / Completed / Approved.
- **Gray (`#6B7280` / `#F3F4F6`):** Draft / Archived / Inactive / Cancelled.

### 6.4 Common Form & Modal Controls
- **Required Fields:** Marked with a red asterisk (`*`). Forms cannot be submitted if required fields are blank.
- **Modal Confirmation:** Action modals require clicking **Confirm** or **Save Changes**. Click **Cancel** or the top-right `X` to discard edits safely without mutating data.
- **Feedback Toasts:** After saving, a green success toast popup appears at the top-right (e.g. *"Rescue assigned successfully"*). If a validation error occurs, a red error toast explains the cause.

> [!NOTE]
> **Operational Note on Status Updates:** Medical request status updates are submitted through the backend status endpoint (`PATCH /api/v1/shelter/medical-requests/{id}/status`). If a medical request status update displays an error, allow the page to refresh and verify the current request status before repeating the action.

---

## 7. RESCUE OPERATIONS

### 7.1 Module Purpose
The Rescue Management module governs the emergency incident response pipeline for stray animals. It enables PawGuard staff to receive public incident reports, triage emergency urgency, dispatch rescue agents and vehicles, track ambulance movement, and transfer rescued animals into shelter facilities.

### 7.2 Who Can Access Rescue Operations
- **Full Control:** Super Admin, Rescue Centre Admin, Rescue Coordinator.
- **Field Execution:** Rescue Agent.
- **Read-Only Inspection:** Shelter Manager, Veterinarian.

### 7.3 Main Screens
1. **Rescue Management (`/rescues`):** Complete grid/table of all rescue cases across all statuses.
2. **Rescue Requests (`/rescue-requests`):** Triage moderation inbox for incoming public incident calls.
3. **Rescue Dispatch (`/rescue-dispatch`):** Active ambulance dispatch and field tracking control center.

---

### 7.4 Step-by-Step Operations

#### Procedure A: Public Incident Triage & Verification (`/rescue-requests`)
1. Open **Rescue Requests** from the sidebar.
2. Locate the reported incident in the **Incoming Requests** table.
3. Click **Review Request** to open the inspection modal.
4. Review reporter contact details, physical location, landmark notes, and uploaded scene photos.
5. Select **Priority Level** (`Low`, `Medium`, `High`, `Critical`).
6. If emergency medical care is needed, check the **Is Urgent Medical Emergency** checkbox.
7. Click **Verify & Accept Incident**.
8. The request status updates to `verified` and moves to the Dispatch Queue.
9. *Rejection Option:* If the report is invalid or a duplicate, click **Reject Incident**, select a mandatory rejection reason (*Duplicate Report*, *Invalid Address*, *False Alarm*), and click **Confirm Rejection**.

```
PUBLIC REPORT (Reported) ──> TRIAGE INBOX ──> VERIFY DETAILS ──> SET PRIORITY ──> VERIFIED STATUS
                                    │
                                    └──> REJECT INCIDENT ──> MANDATORY REASON ──> REJECTED
```

#### Procedure B: Dispatching Team & Vehicle (`RescueAssignModal.tsx`)
1. Open **Rescue Dispatch** (`/rescue-dispatch`) or **Rescue Requests**.
2. Locate the `verified` incident and click **Assign & Dispatch Team**.
3. In the modal:
   - Select the assigned **Rescue Coordinator**.
   - Select one or more **Rescue Field Agents**.
   - Select the assigned **Ambulance / Vehicle** (only vehicles marked `available` appear in the dropdown).
   - Select the **Driver**.
   - Enter **Special Instructions / Gear Notes** (e.g. *Bring catch pole and stretcher for aggressive dog*).
4. Click **Confirm Dispatch**.
5. The case status transitions to `dispatched`, sending an automated alert notification to the assigned Rescue Agent's mobile dashboard.

#### Procedure C: Field Agent Execution (`/dashboard/rescue-agent`)
1. Log in as **Rescue Agent**.
2. Open **My Assigned Rescues** or **Rescue Agent Dashboard**.
3. Locate your assigned dispatch case and review location details and map directions.
4. Click **Mark En Route** when starting transit. Status transitions to `en_route`, and the server logs the exact `en_route_at` timestamp via `PATCH /api/v1/rescue/dispatches/{id}`.
5. Upon arriving at the incident scene, click **Mark Animal Located**. Status transitions to `located`.
6. Once the animal is safely captured and secured inside the vehicle, click **Mark Animal Secured**. Status transitions to `secured`.
7. Transport the animal to the designated shelter facility and click **Transfer to Shelter Admission**.
8. Status transitions to `admitted`. The rescue lifecycle is complete, and the animal is transferred to the Shelter Intake queue.

---

### 7.5 Rescue Status Reference Table

| Status Code | Display Name | Meaning & System Behavior | Next Allowed Statuses |
| :--- | :--- | :--- | :--- |
| `reported` | Reported | Incident logged by public reporter; awaiting triage moderation. | `verified`, `rejected` |
| `verified` | Verified | Incident verified by Coordinator; priority set; ready for dispatch. | `dispatched`, `cancelled` |
| `dispatched` | Dispatched | Rescue team, agent, vehicle, and driver assigned to case. | `en_route`, `cancelled` |
| `en_route` | En Route | Rescue agent active in transit to incident scene (`en_route_at` logged). | `located`, `cancelled` |
| `located` | Located | Rescue team arrived on scene and located target animal. | `secured`, `cancelled` |
| `secured` | Secured | Animal safely captured and secured inside rescue vehicle. | `admitted`, `cancelled` |
| `admitted` | Admitted | Animal delivered to shelter facility and admitted into intake. | *Completed (Dog Master Active)* |
| `rejected` | Rejected | Incident report rejected during triage (reason recorded in audit log). | *Closed Terminal State* |
| `cancelled` | Cancelled | Active rescue cancelled due to field change (reason required). | *Closed Terminal State* |

---

## 8. DOG MASTER MANAGEMENT

### 8.1 Module Purpose
The Dog Master module (`/pets`) serves as the central master registry for all canine records in the PawGuard system. It tracks complete animal identity, microchip details, health condition, intake photos, collar safety tags, and historical event streams.

### 8.2 Who Can Access Dog Master
- **Full View & Edit:** Super Admin, Shelter Manager, Rescue Centre Admin, Rescue Coordinator.
- **Read-Only Access:** Veterinarian, Adoption Coordinator, Foster Coordinator, Rescue Agent.

### 8.3 Key Fields & Record Information
- **Registration Number:** Auto-generated unique identifier (e.g. `DOG-2026-08912`).
- **Name / Alias:** Animal's name or temporary rescue alias (e.g. *Buddy*).
- **Microchip Number:** 15-digit ISO microchip ID (e.g. `981020004589123`).
- **Gender & Age Class:** Male / Female; Puppy / Young Adult / Adult / Senior.
- **Breed & Color:** Primary breed, secondary breed, coat color, distinguishing marks.
- **Health & Behavior Status:** Intake Health Score, Aggression / Temperament Rating, Special Needs Notes.
- **Operational Status:** `intake`, `shelter_housed`, `medical_treatment`, `foster_care`, `adoptable`, `adopted`, `reunified`.

---

### 8.4 Step-by-Step Operations

#### Procedure: Registering & Editing a Dog Master Profile (`/pets`)
1. Open **Dog Management** (`/pets`) from the sidebar.
2. Click **+ Register New Dog**.
3. In the registration form:
   - Enter **Name** or temporary alias.
   - Enter **Microchip Number** (if present upon intake) or check **Pending Microchip Implantation**.
   - Select **Gender**, **Age Category**, **Primary Breed**, and **Coat Colors**.
   - Upload high-resolution **Intake Photos** (drag & drop JPEG/PNG/WebP files up to 5MB).
   - Enter **Intake Location Notes** and **Found Physical Condition**.
4. Click **Save Dog Master Profile**.
5. To view or update a profile, locate the dog in the table and click **View Profile** or **Edit Details**.

#### Procedure: Inspecting Canine Lifecycle Timeline (`DogLifecycleTimelineModal.tsx`)
1. In the **Pets** table, locate the required dog.
2. Click the **Lifecycle Timeline** button (clock icon).
3. The 8-stage chronological timeline modal opens, displaying exact timestamps, facilities, and staff handoffs across all life stages:

```
[1. Rescue Intake] ──> [2. Shelter Admission] ──> [3. Kennel Assignment] ──> [4. Medical Exam]
                                                                                   │
[8. Post-Adoption] <── [7. Adoption Finalized] <── [6. Adoptable Status] <── [5. Vet Clearance]
```

---

## 9. SHELTER OPERATIONS

### 9.1 Module Purpose
The Shelter Management module (`/shelters` and `/shelter-dogs`) manages physical shelter facility hierarchy, ward sections, individual kennels, capacity constraints, sanitation tracking, and shelter dog medical check requests.

### 9.2 Who Can Access Shelter Operations
- **Full Facility Management:** Super Admin, Shelter Manager.
- **Directory & Kennel Inspection:** Rescue Centre Admin, Rescue Coordinator, Inventory Manager.

### 9.3 Facility Hierarchy & Kennel Capacity Rules
PawGuard structures shelters into a 3-tier hierarchy:

```
FACILITY (e.g. Hope Haven Shelter)
 └── WARD / SECTION (e.g. Medical Isolation Ward, General Housing Section A)
      └── KENNEL UNIT (e.g. Kennel A-101, Capacity: 1 dog, Status: Available)
```

- **Strict Dual-Booking Guard:** A kennel unit marked `occupied` cannot be assigned a second dog. The portal automatically disables occupied kennels in assignment dropdowns to prevent capacity overbooking.

---

### 9.4 Step-by-Step Operations

#### Procedure A: Kennel Allocation (`KennelAssignmentModal.tsx`)
1. Open **Shelter Facilities** (`/shelters`).
2. Select the target facility and click **Manage Kennels**.
3. Click **Assign Dog to Kennel**.
4. Select the **Dog** from the unassigned intake list.
5. Select the **Target Kennel** (only `available` units with matching size criteria are enabled).
6. Click **Confirm Kennel Assignment**.
7. The kennel status changes from `available` to `occupied`, and the dog's location updates automatically.

#### Procedure B: Requesting Veterinary Check from Shelter (`ShelterDogs.tsx`)
1. Open **Shelter Dogs** (`/shelter-dogs`).
2. Locate the housed dog needing medical evaluation.
3. Click **Request Vet Check**.
4. In the request modal:
   - Select the assigned **Veterinarian** from the active vet directory list.
   - Select **Urgency Level** (`Routine Check`, `Urgent Evaluation`, `Emergency`).
   - Enter **Reason for Vet Check** (e.g. *Dog exhibiting fever, loss of appetite, and limping on left leg*).
5. Click **Submit Vet Check Request**.
6. The system creates a live medical check request (HTTP `201 Created`) and delivers an instant alert notification to the selected veterinarian's dashboard.
7. *Duplicate Protection:* If an active vet check request already exists for the dog, the system blocks resubmission with a `409 Conflict` warning.

---

## 10. MEDICAL OPERATIONS

### 10.1 Module Purpose
The Medical Suite manages clinical examinations, veterinary treatments, body condition scoring (BCS), surgical logs, vaccination schedules, medication administration, vet appointments, and health certificates.

### 10.2 Who Can Access Medical Operations
- **Full Clinical Control:** Veterinarian, Super Admin.
- **Request & View Access:** Shelter Manager.
- **Read-Only Certificates:** Adoption Coordinator, Foster Coordinator.

### 10.3 Main Screens
1. **Medical Records (`/medical-records`):** Clinical examination logs, diagnostic records, treatment plans.
2. **Vet Directory & Appointments (`/vet-directory`):** Registered veterinarian directory and appointment scheduling.
3. **Vaccination & Medication Reminders (`/medical-reminders`):** Due date tracking and overdue alert badges.

---

### 10.4 Step-by-Step Operations

#### Procedure A: Performing Clinical Examination (`/medical-records`)
1. Open **Medical Records** from the sidebar.
2. Click **+ New Medical Record**.
3. Select the **Dog** from the patient dropdown.
4. Complete the clinical examination form:
   - Enter **Vitals:** Weight (kg), Body Temperature (°C), Heart Rate (bpm).
   - Select **Body Condition Score (BCS):** Scale 1 (Emaciated) to 9 (Obese); Ideal is 4–5.
   - Enter **Primary Diagnosis** and **Clinical Findings**.
   - Enter **Prescribed Medications, Dosage & Frequency**.
   - Check **Medical Clearance Status:** (`Cleared for Adoption`, `Cleared for Foster`, `Requires Isolation`, `Under Ongoing Treatment`).
5. Click **Save Medical Record**.

#### Procedure B: Processing Vet Check Inbox & Updating Request Status (`VeterinarianDashboard.tsx`)
1. Log in as **Veterinarian**.
2. On your dashboard, open the **Assigned Veterinary Requests** tab.
3. Review incoming requests submitted by Shelter Managers.
4. Click **Inspect Request** to review urgency badges, facility location, and symptoms notes.
5. Perform clinical evaluation and click **Update Request Status**.
6. Select status (`in_progress`, `completed`, `rejected`) and enter **Veterinary Examination Notes**.
7. Click **Confirm Status Update**.

> [!NOTE]
> **Operational Note on Medical Status Updates:** Medical request status updates are submitted through the backend status endpoint (`PATCH /api/v1/shelter/medical-requests/{id}/status`). If a medical request status update displays an error message, allow the page to refresh and verify the updated status on your dashboard before retrying the operation.

#### Procedure C: Scheduling Vaccination Reminders (`/medical-reminders`)
1. Open **Vaccination & Medication Reminders**.
2. Click **+ Add Reminder**.
3. Select **Dog**, **Vaccine/Medication Type** (*Rabies*, *DHPP*, *Deworming*, *Heartworm Preventive*), **Scheduled Date**, and **Batch/Lot Number**.
4. Click **Save Reminder**.
5. The system automatically highlights overdue reminders with red alerts and upcoming reminders with orange warnings.

---

## 11. ADOPTION OPERATIONS

### 11.1 Module Purpose
The Adoption Management module (`/adoptions`) governs the formal application, vetting, home check screening, contract execution, and placement of adoptable dogs into verified permanent homes.

### 11.2 Who Can Access Adoption Operations
- **Full Control:** Adoption Coordinator, Super Admin.
- **Read & Intake Access:** Shelter Manager.

### 11.3 9-Stage Adoption Pipeline & Exclusivity Rule
PawGuard enforces a strict 9-stage adoption lifecycle:

```
1. Submitted ──> 2. Initial Review ──> 3. Applicant Screening ──> 4. Home Check Scheduled
                                                                        │
8. Placement <── 7. Adoption Agreement <── 6. Final Approval <── 5. Home Check Passed
```

> [!IMPORTANT]
> **Adoption Exclusivity Protection:** To prevent double-adopting a dog, PawGuard automatically queries backend records (`GET /adoptions?dog_id=...`) upon opening or approving an application. If another application for the same dog has already been approved or finalized, the system blocks dual-approval and displays an exclusivity toast warning.

---

### 11.4 Step-by-Step Operations

#### Procedure: Reviewing & Finalizing Adoption Application (`/adoptions`)
1. Open **Adoptions** from the sidebar.
2. Locate the application in the **Adoption Applications** table.
3. Click **Review Application** to inspect applicant details, residential type, yard fencing, existing pets, and vet reference.
4. Update stage to **Applicant Screening** or **Home Check Scheduled**.
5. After conducting the home inspection, record **Home Check Notes** and mark **Home Check Passed**.
6. Click **Grant Final Approval**. The system queries live adoption records (`GET /adoptions?dog_id=...`) to verify exclusivity.
7. Click **Generate Adoption Agreement Contract**. Both applicant and coordinator sign digitally.
8. Once signed and adoption fee payment is logged, click **Finalize Adoption & Handover**.
9. The dog's Master status automatically transitions to `adopted`, and an Adoption Certificate is generated.

> [!NOTE]
> **Operational Note on Follow-Up Compliance Information:** Follow-up compliance information is displayed when follow-up records are available for the adoption record. Where follow-up data is omitted, the portal displays *"Data unavailable"*.

---

## 12. FOSTER OPERATIONS

### 12.1 Module Purpose
The Foster Management module (`/fosters`) manages temporary home placements for dogs requiring medical recovery, puppy socialization, or shelter overflow relief.

### 12.2 Who Can Access Foster Operations
- **Full Control:** Foster Coordinator, Super Admin.
- **Caregiver Dashboard:** Foster Family (`/dashboard/foster-family`).

### 12.3 Step-by-Step Placement Operations
1. Open **Foster Management** (`/fosters`).
2. View the **Active Foster Caregivers** roster to check caregiver capacity (e.g. *2 / 3 active dogs housed*).
3. Click **+ New Foster Placement**.
4. Select the **Foster Caregiver Profile** and the **Dog**.
5. Set **Start Date**, **Expected End Date**, and **Special Care Instructions** (medication schedule, dietary restrictions).
6. Click **Confirm Foster Placement**.
7. The dog's Master status transitions to `foster_care`.

#### Foster-to-Adopt Transition Workflow
If a foster family decides to permanently adopt their foster dog:
1. Open the active placement record in `/fosters`.
2. Click **Initiate Foster-to-Adopt Transition**.
3. The system converts the placement into a formal adoption application, pre-filling verified caregiver details and transferring the dog to the Adoption pipeline.

---

## 13. VOLUNTEER OPERATIONS

### 13.1 Module Purpose
The Volunteer Management module (`/volunteers`) handles volunteer recruitment, orientation verification, shift scheduling, duty rosters, attendance check-ins, and service hour certification.

### 13.2 Who Can Access Volunteer Operations
- **Full Management:** Volunteer Coordinator, Super Admin.
- **Shift Viewing & Check-in:** Volunteer (`/dashboard/volunteer`).

### 13.3 Step-by-Step Shift Operations
1. Open **Volunteers** (`/volunteers`).
2. Click **Schedule New Shift**.
3. Set **Shift Title** (*Dog Walking & Socialization*, *Shelter Sanitation*, *Adoption Event Support*), **Date**, **Start/End Time**, **Facility Branch**, and **Headcount Limit** (e.g. *Max 6 volunteers*).
4. Click **Publish Shift Roster**.
5. Volunteers register via their portal dashboard.
6. On shift day, click **Attendance Check-in** to log actual service hours.
7. Click **Generate Service Certificate** to calculate cumulative volunteer hours and issue an official service certificate.

---

## 14. INVENTORY OPERATIONS

### 14.1 Module Purpose
The Inventory Management module (`/inventory`) controls shelter supplies, dog food, medical drugs, vaccines, sanitation chemicals, and rescue gear across facilities.

### 14.2 Who Can Access Inventory Operations
- **Full Inventory Control:** Inventory Manager, Super Admin.
- **Read & Requisition Access:** Shelter Manager.

### 14.3 Stock Level Badging & Expiry Alerts
- **In Stock (Green):** Quantity is safely above reorder threshold.
- **Low Stock Warning (Amber):** Quantity has reached reorder point; requisition required.
- **Critical Stock / Out of Stock (Red):** Quantity is zero or below minimum safety stock.
- **Lot Expiry Alert (Red Badge):** Medical batch/lot expiry date is within 30 days.

### 14.4 Step-by-Step Inventory Adjustment
1. Open **Inventory** (`/inventory`).
2. Locate the target item and click **Adjust Stock**.
3. Select adjustment type (*Stock Receipt / Purchase*, *Usage / Consumption*, *Damaged / Expired Disposal*).
4. Enter **Quantity Change**, **Lot/Batch Number**, and **Reason Notes**.
5. Click **Save Stock Adjustment**. Inventory totals update immediately across facility ledgers.

---

## 15. VEHICLE & FLEET OPERATIONS

### 15.1 Module Purpose
The Vehicle Fleet module (`/vehicles`) tracks rescue ambulances, transport vans, fuel logs, maintenance schedules, driver assignments, and field availability.

### 15.2 Who Can Access Vehicle Fleet
- **Full Fleet Oversight:** Super Administrator (`super_admin`) and Rescue Centre Admin (`rescue_centre_admin`).
- **Restricted Roles:** Rescue Coordinators, Rescue Agents, Veterinarians, Shelter Managers, and other roles do NOT have access to `/vehicles`.

### 15.3 Vehicle Operational Statuses
- `available`: Vehicle inspected, fueled, ready for field dispatch.
- `assigned`: Vehicle actively dispatched on a rescue or transport call.
- `maintenance`: Vehicle undergoing routine servicing or repairs (disabled from dispatch selection).
- `out_of_service`: Vehicle decommissioned or unavailable (disabled from dispatch selection).

---

## 16. FINANCE & DONATION OPERATIONS

### 16.1 Module Purpose
The Finance & Donations module (`/finance`) tracks public monetary contributions, dog sponsorships, campaign funds, medical expense allocations, fuel costs, and tax receipt issuance.

### 16.2 Who Can Access Finance Operations
- **Full Financial Control:** Finance User, Super Admin.
- **Donor View:** Donor (`/dashboard/donor`).

### 16.3 Step-by-Step Ledger & Receipt Operations
1. Open **Finance** (`/finance`).
2. Review the **Donation Transactions Ledger**.
3. Filter by category (*General Fund*, *Medical Emergency Fund*, *Dog Sponsorship*, *Shelter Expansion*).
4. Click **Generate Tax Receipt** for a selected contribution.
5. The system generates an official, print-formatted PDF tax receipt featuring transaction reference, donor details, and tax-deductible clearance statement.

---

## 17. LOST & FOUND

### 17.1 Module Purpose
The Lost & Found module (`/lost-and-found`) matches reported lost pets with found/rescued animals using location data, physical descriptions, and side-by-side photo comparison.

### 17.2 Step-by-Step Reunification Flow
1. Open **Lost & Found** (`/lost-and-found`).
2. Select a reported **Lost Pet Report**.
3. Click **Run Algorithmic Pattern Match**.
4. The system calculates attribute match confidence scores against housed shelter dogs and found reports based on breed, coat color, location radius, and time window scoring.
5. Inspect the side-by-side photo comparison card.
6. If a match is verified, click **Verify Match & Contact Owner**.
7. Upon successful owner identification and microchip verification, click **Finalize Pet Reunification**. The dog status updates to `reunified`.

---

## 18. CERTIFICATES

### 18.1 Module Purpose
The Certificates module (`/certificates`) issues, signs, and archives official digital certificates generated across PawGuard modules.

### 18.2 Certificate Types
1. **Health Clearance Certificate:** Issued by Veterinarians certifying an animal is free of contagious disease and fit for adoption/foster.
2. **Rabies Vaccination Certificate:** Official record of rabies immunization with batch lot details and veterinarian registration license.
3. **Adoption Completion Certificate:** Formal certificate issued to adoptive parents upon final contract execution.
4. **Volunteer Service Certificate:** Issued to volunteers certifying logged community service hours and contributions.

---

## 19. REPORTS & ANALYTICS

### 19.1 Module Purpose
The Reports & Analytics module (`/reports`) generates high-level operational intelligence, executive summaries, compliance reports, and multi-format exports.

### 19.2 The 6 Executive Reports

```
+-----------------------------------------------------------------------------------+
| 1. RESCUE ANALYTICS      | 2. SHELTER OCCUPANCY    | 3. MEDICAL SUMMARY           |
| Emergency response times,| Kennel capacity %,      | Treatments, surgeries,       |
| triage priority breakdown| facility utilization    | vaccination coverage         |
+--------------------------+-------------------------+------------------------------+
| 4. ADOPTION PIPELINE     | 5. INVENTORY & STOCK    | 6. FINANCIAL LEDGER          |
| Stage conversion rates,  | Reorder alerts, stock   | Donations, sponsorships,     |
| turnaround time          | consumption metrics     | expense categorization       |
+-----------------------------------------------------------------------------------+
```

### 19.3 Export Capabilities
All reports can be exported instantly:
- **CSV Export:** Generates clean, unformatted raw data tables for data analysis.
- **Excel (.xls) Export:** Generates formatted spreadsheet workbooks with headers and totals.
- **PDF Export:** Generates print-formatted executive reports with header branding and signature blocks.

> [!NOTE]
> **Operational Note on Report Data Availability:** Post-adoption follow-up compliance information is displayed when follow-up records are available for the adoption record. Where backend data is unavailable, reports display *"Data unavailable"*.

---

## 20. NOTIFICATIONS

### 20.1 Module Purpose
The Notifications System (`/notifications`) delivers operational alerts to staff members based on their active role and assigned facility.

### 20.2 Notification Categories & Urgency
- **Critical Red Alerts:** New urgent medical emergency dispatch, critical stock depletion, high-priority incident call.
- **Amber Warnings:** Overdue medical reminder, kennel reaching max capacity, inventory item at reorder point.
- **Blue Info Alerts:** New adoption application submitted, volunteer shift filled, new comment logged.

---

## 21. AUDIT LOGS

### 21.1 Module Purpose
The Audit Logs module (`/audit-logs`) provides an unalterable security audit trail tracking user actions, login events, record edits, status transitions, and data deletions across the system.

### 21.2 Who Can Access Audit Logs
- **Super Administrator Only.**

---

## 22. SYSTEM SETTINGS

### 22.1 Module Purpose
The System Settings module (`/system-settings`) controls global system parameters, organizational branding, default facility rules, automated alert thresholds, and email templates.

### 22.2 Who Can Access System Settings
- **Super Administrator Only.**

---

## 23. CMS / ADMINISTRATIVE CONTENT

### 23.1 Module Purpose
The Website Management (CMS) module (`/cms`) allows authorized administrative staff to control public website content, publish news articles, update shelter FAQ items, post success stories, and manage public contact inquiry SLA responses.

### 23.2 CMS Sub-Views
- `/cms/home`: Main landing page hero section, banners, and metrics.
- `/cms/about`: About PawGuard mission, leadership team, and facility locations.
- `/cms/success-stories`: Adopted dog happy tail stories and photos.
- `/cms/articles`: Educational articles on pet care, animal welfare, and rescue guidelines.
- `/cms/faq`: Public frequently asked questions.
- `/cms/inquiries`: Moderation panel for public contact submissions, feedback, and complaints with SLA resolution notes.

---

## 24. END-TO-END OPERATIONAL WORKFLOWS

This section illustrates the 17 core cross-departmental operational workflows connecting different roles and modules in PawGuard.

### 24.1 Workflow 1: Complete Rescue-to-Adoption Lifecycle

```
[ PUBLIC CITIZEN ]
       │ Submits Incident Report with Photo & Location
       ▼
[ RESCUE COORDINATOR ] (Module: /rescue-requests)
       │ Verifies Incident Details ──> Sets Urgency Priority (High/Critical)
       ▼
[ RESCUE COORDINATOR ] (Module: /rescue-dispatch)
       │ Assigns Agent + Driver + Vehicle ──> Triggers Dispatch
       ▼
[ RESCUE AGENT ] (Module: /dashboard/rescue-agent)
       │ Marks En Route ──> Marks Located ──> Marks Secured ──> Delivers to Shelter (Admitted)
       ▼
[ SHELTER MANAGER ] (Module: /shelters)
       │ Admits Animal ──> Allocates Available Kennel ──> Requests Vet Check
       ▼
[ VETERINARIAN ] (Module: /medical-records)
       │ Performs Clinical Exam (BCS, Vitals) ──> Administers Vaccines ──> Issues Health Clearance
       ▼
[ ADOPTION COORDINATOR ] (Module: /adoptions)
       │ Marks Dog Adoptable ──> Vets Application ──> Conducts Home Check ──> Signs Contract
       ▼
[ ADOPTIVE FAMILY / SYSTEM ]
       └─► Finalizes Adoption ──> Issues Adoption Certificate ──> Dog Status: Adopted
```

---

### 24.2 Workflow 2: Emergency Field Dispatch Sequence
1. Public report received at `/rescue-requests`.
2. Coordinator verifies report details and evaluates urgency.
3. Coordinator opens `RescueAssignModal.tsx`, selects available ambulance van, driver, and rescue agent.
4. Agent receives push alert on field mobile dashboard (`/dashboard/rescue-agent`).
5. Agent clicks **En Route** (server logs `en_route_at` timestamp via `PATCH /rescue/dispatches/{id}`).
6. Agent arrives on scene and clicks **Located**.
7. Agent captures animal and clicks **Secured**.
8. Agent transports animal to facility and clicks **Admitted**.

---

### 24.3 Workflow 3: Shelter Intake & Kennel Capacity Guard
1. Admitted dog enters Shelter Intake queue.
2. Shelter Manager opens `/shelters` and clicks **Assign Kennel**.
3. System filters kennel dropdown to show only `available` units matching size criteria.
4. Occupied units are disabled to enforce zero dual-booking.
5. Manager selects Kennel A-102 and confirms.
6. Kennel status changes to `occupied`; dog location is updated.

---

### 24.4 Workflow 4: Veterinary Clinical Examination & Vaccination
1. Shelter Manager submits vet check request in `/shelter-dogs`.
2. Request appears in Veterinarian's dashboard inbox (`/dashboard/veterinarian`).
3. Vet reviews symptoms and opens `/medical-records`.
4. Vet logs clinical examination (Vitals, BCS score 4/9, diagnosis).
5. Vet administers Rabies and DHPP vaccines, logging lot numbers and scheduling 1-year reminder dates.
6. Vet checks **Cleared for Adoption** box and signs digital record.

---

### 24.5 Workflow 5: Adoption Application & Exclusivity Enforcement
1. Applicant submits adoption form via Public Portal for Dog *Buddy* (`DOG-2026-08912`).
2. Application appears in `/adoptions` for Adoption Coordinator review.
3. Coordinator conducts telephone screening and schedules home check.
4. Coordinator logs **Home Check Passed**.
5. Coordinator clicks **Approve Application**. System queries database (`GET /adoptions?dog_id=...`) to ensure no other approved application exists for *Buddy*.
6. If clean, approval completes; digital adoption agreement is generated and signed.
7. Handover completed; Dog Master status updates to `adopted`.

---

### 24.6 Workflow 6: Foster Placement & Foster-to-Adopt
1. Foster Coordinator opens `/fosters` and selects vetted foster caregiver.
2. Coordinator assigns dog requiring 3-week medical recovery.
3. Dog Master status updates to `foster_care`.
4. Foster family logs weekly progress notes and supply requests via `/dashboard/foster-family`.
5. At end of foster term, foster family applies to adopt.
6. Coordinator clicks **Initiate Foster-to-Adopt Transition**, transferring record seamlessly into the Adoption pipeline.

---

### 24.7 Workflow 7: Volunteer Onboarding & Shift Roster
1. Volunteer Coordinator posts weekend shift roster in `/volunteers` (Max 6 slots).
2. Registered volunteers sign up via `/dashboard/volunteer`.
3. On shift day, coordinator opens attendance check-in panel and logs actual service hours.
4. System calculates cumulative volunteer hours and generates official Service Certificate.

---

### 24.8 Workflow 8: Inventory Requisition & Stock Replenishment
1. Quantity of Rabies Vaccines falls below reorder point (5 vials remaining).
2. System triggers red **Low Stock Warning** badge in `/inventory` and alerts Inventory Manager.
3. Inventory Manager submits stock purchase requisition.
4. New shipment arrives; Manager logs stock adjustment (+50 vials, Lot #RB-2026-99).
5. Stock status returns to green **In Stock**.

---

### 24.9 Workflow 9: Vehicle Fleet Dispatch & Maintenance
1. Rescue Van 02 marked `available` in `/vehicles` by Rescue Centre Admin.
2. Rescue Coordinator selects Van 02 for emergency field call via `RescueAssignModal.tsx`.
3. Upon return, agent reports brake squeal.
4. Admin updates vehicle status in `/vehicles` to `maintenance` (disabling it from active dispatch lists).
5. Repairs completed; status restored to `available`.

---

### 24.10 Workflow 10: Financial Donation & Tax Receipt Issuance
1. Citizen donates $250 online toward Medical Emergency Fund.
2. Transaction logs automatically in `/finance` ledger.
3. Finance User verifies payment clearance and clicks **Generate Tax Receipt**.
4. System produces signed PDF receipt sent to donor.

---

### 24.11 Workflow 11: Health & Vaccination Certificate Generation
1. Vet completes final clearance exam for dog *Luna*.
2. Vet opens `/certificates` and clicks **Issue Health Certificate**.
3. System pulls dog registration #, microchip ID, vaccine batch details, and vet license #.
4. Signed PDF certificate issued and attached to Dog Master file.

---

### 24.12 Workflow 12: Lost & Found Pattern Matching & Reunification
1. Citizen reports lost Golden Retriever in `/lost-and-found`.
2. System runs **Algorithmic Location & Attribute Match**.
3. Matching algorithm calculates attribute score against housed shelter dogs based on breed, coat color, location radius, and time window.
4. Staff inspects side-by-side photo comparison card.
5. Microchip scan confirms ownership; dog status updated to `reunified`.

---

### 24.13 Workflow 13: Public Complaint Moderation & SLA Resolution
1. Citizen submits feedback inquiry regarding shelter visiting hours.
2. Submission routes to `/cms/inquiries`.
3. Centre Admin reviews message, assigns resolution notes, and updates status to `resolved` within SLA window.

---

### 24.14 Workflow 14: Dog Master Record Audit Stream
1. Super Admin opens `/pets` and selects Dog *Max*.
2. Admin opens `DogLifecycleTimelineModal.tsx`.
3. System renders full timeline stream: Rescue Intake → Shelter Intake → Medical Exam → Foster Placement → Adoption Contract.

---

### 24.15 Workflow 15: Role-Based Navigation & Access Block
1. User logged in as *Rescue Agent* attempts to navigate to `/finance`.
2. Router guard (`ProtectedRoute.tsx`) inspects role permissions.
3. Access denied; system immediately redirects user to `/403` Unauthorized page.

---

### 24.16 Workflow 16: Executive Analytics Export
1. Executive opens `/reports` and selects **Shelter Occupancy & Capacity Report**.
2. Filters applied for Quarter 3 2026 across all facilities.
3. Executive clicks **Export Excel (.xls)**. Formatted spreadsheet file generated instantly.

---

### 24.17 Workflow 17: System Notifications & Alert Delivery
1. Emergency incident reported with `Critical` priority.
2. Notification engine broadcasts alert to all Rescue Coordinators.
3. Unread bell badge increments (+1) in header bar. Click opens notification drawer to view case details.

---

## 25. ROLE-SPECIFIC QUICK START GUIDES

### Guide 1: Rescue Coordinator — Shift Start Checklist
```
1. Log in -> Redirected to /dashboard/rescue-coordinator
2. Review Metrics Bar: Check Pending Incident Calls & Available Ambulances
3. Open /rescue-requests: Review incoming public incident reports
4. Triage Reports: Set priority (Low/Med/High/Critical) and click Verify
5. Open /rescue-dispatch: Assign Agent + Driver + Vehicle for verified cases
6. Monitor Field Progress: Track En Route -> Located -> Secured -> Admitted
```

### Guide 2: Rescue Agent — Shift Start Checklist
```
1. Log in -> Open /dashboard/rescue-agent on field mobile device
2. Check My Assigned Rescues tab for active dispatch alerts
3. Review target address, landmark notes, and special gear instructions
4. Click Mark En Route when starting ambulance transit (en_route_at logged)
5. Click Mark Animal Located upon arriving on scene
6. Click Mark Animal Secured after capturing animal
7. Transport to shelter and click Transfer to Shelter Admission
```

### Guide 3: Veterinarian — Shift Start Checklist
```
1. Log in -> Open /dashboard/veterinarian
2. Check Assigned Veterinary Requests tab for pending checkup requests
3. Review request urgency badges and shelter manager symptom notes
4. Open /medical-records -> Perform clinical examination (Vitals, BCS, Diagnosis)
5. Administer vaccinations/medications and log lot numbers in /medical-reminders
6. Update clearance status (Refer to Section 6 operational note if refetch occurs)
```

### Guide 4: Shelter Manager — Shift Start Checklist
```
1. Log in -> Open /dashboard/shelter-manager
2. Review Shelter Occupancy Metric Card (Target < 85% capacity)
3. Open /shelters -> Process newly admitted animals from intake queue
4. Assign dogs to available kennels (Verify zero dual-booking)
5. Open /shelter-dogs -> Submit Vet Check Requests for dogs needing medical evaluation
6. Review inventory stock alerts for dog food and sanitation supplies
```

### Guide 5: Adoption Coordinator — Shift Start Checklist
```
1. Log in -> Open /dashboard/adoption-coordinator
2. Open /adoptions -> Filter by Submitted Applications
3. Review applicant residential details, fencing, and vet references
4. Conduct applicant phone screening and schedule home check
5. Record Home Check Passed notes
6. Click Grant Final Approval (Exclusivity verified) -> Execute contract and complete placement
```

### Guide 6: Foster Coordinator — Shift Start Checklist
```
1. Log in -> Open /dashboard/foster-coordinator
2. Review Active Foster Caregivers roster and available housing capacity
3. Match incoming recovery/socialization dogs with vetted foster homes
4. Issue placement contracts and medication handoff instructions
5. Monitor weekly progress logs submitted by foster families
```

### Guide 7: Volunteer Coordinator — Shift Start Checklist
```
1. Log in -> Open /dashboard/volunteer-coordinator
2. Review upcoming weekend shift rosters in /volunteers
3. Confirm volunteer headcount limits and assigned shelter duties
4. Mark attendance check-ins on shift day
5. Calculate logged service hours and issue Volunteer Service Certificates
```

### Guide 8: Inventory Manager — Shift Start Checklist
```
1. Log in -> Open /dashboard/inventory-manager
2. Review stock alerts: Check items flagged with Amber or Red badges
3. Inspect lot expiry dates for medical drugs and vaccines
4. Log stock adjustments for newly received supplier shipments
5. Process shelter supply requisitions
```

### Guide 9: Finance User — Shift Start Checklist
```
1. Log in -> Open /dashboard/finance
2. Review daily online donation transactions ledger
3. Verify campaign allocation balances (Medical, Food, Shelter Expansion)
4. Issue official tax receipts for qualified contributions
5. Export financial ledger summaries for auditing
```

### Guide 10: Super Administrator — Shift Start Checklist
```
1. Log in -> Open /dashboard/super-admin
2. Review global system metrics across all facilities
3. Check /audit-logs for security events or unauthorized access attempts
4. Manage user role permissions in /roles-permissions
5. Inspect CMS content moderation in /cms
```

---

## 26. SECURITY & RBAC

### 26.1 Authentication & Token Storage Security
Authentication uses JWT-based session credentials managed by the Admin Portal. The current web implementation stores authentication token data in browser `localStorage` through the application's auth storage mechanism. Users should use trusted devices, avoid sharing authenticated sessions, and sign out when finished.

### 26.2 Password & Credential Guidelines
- Passwords must be at least 8 characters long, containing uppercase letters, numbers, and symbols.
- **NEVER** share your admin login credentials with anyone. Every action in the system is tied to your personal user account in `/audit-logs`.

### 26.3 File Upload Security
- Supported image formats: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`).
- Maximum file size: **5 MB per file**.
- Uploads are validated for file size and MIME type on the client before being sent to the server.

---

## 27. TROUBLESHOOTING

| Problem / Situation | Likely Cause | Recommended User Action |
| :--- | :--- | :--- |
| **Login Failed ("Invalid email or password")** | Incorrect credentials or inactive user account. | Double-check email spelling and password. If problem persists, contact Super Admin to verify account active status in `/users`. |
| **403 Access Denied Screen (`/403`)** | Your current role lacks permission to view the requested page. | Click "Back to My Dashboard". If you need access for your job duties, request a role permission update from your Super Admin. |
| **Medical Request Status Update Displays Error** | Request status update payload encountered a server-side response serialization delay. | If a medical request status update displays an error, allow the page to refresh and verify the current request status on your dashboard before retrying the action. If the status was not updated, retry the operation or escalate to the system administrator. |
| **Kennel Option Disabled in Dropdown** | Kennel is currently occupied by another dog (Dual-booking protection). | Select a different kennel marked `available`, or update the occupying dog's location if it has been transferred. |
| **Cannot Approve Adoption Application** | Another application for the same dog has already been approved or finalized. | Refresh `/adoptions` table. Review the active approved application for that dog. |
| **Vehicle Missing from Dispatch List** | Vehicle status is set to `maintenance`, `assigned`, or `out_of_service`, or current role lacks vehicle permissions. | Access `/vehicles` (restricted to Super Admin and Rescue Centre Admin) to verify status. Vehicles must be marked `available` for dispatch. |
| **Report Export / Data Unavailable** | Network timeout, heavy query size, or unpopulated follow-up record payload. | Apply date range filters (e.g., last 30 days) to reduce dataset size before clicking Export CSV/Excel. If follow-up data shows *"Data unavailable"*, verify if follow-up records exist for the adoption. |
| **Session Expired Alert** | Token lifetime elapsed due to inactivity. | Click OK to return to the login screen and sign in again. |

---

## 28. GLOSSARY

- **Adoption Exclusivity:** System rule preventing multiple approved adoption applications for the same animal.
- **Algorithmic Pattern Matching:** Attribute scoring logic matching animals based on breed, coat color, location radius, and time window.
- **BCS (Body Condition Score):** Standard veterinary clinical scale (1 to 9) assessing canine fat and muscle condition.
- **Canine Lifecycle Timeline:** Chronological event stream tracking an animal from initial rescue through shelter intake, medical exams, foster care, and adoption.
- **Dispatch:** Process of assigning a rescue agent, driver, vehicle, and equipment to an emergency field call.
- **Dog Master:** Centralized master profile registry for all canine records in the PawGuard system.
- **Dual-Booking Guard:** System constraint preventing the assignment of multiple animals to a single occupied kennel unit.
- **JWT (JSON Web Token):** Session authentication token stored in browser web storage (`localStorage`).
- **Microchip ID:** 15-digit ISO standard RFID transponder implanted under an animal's skin for permanent identification.
- **QR Safety Tag:** Scannable code attached to an animal's physical collar linking directly to its digital profile.
- **RBAC (Role-Based Access Control):** Security framework governing module visibility and action permissions based on user roles.
- **Reorder Point:** Minimum inventory threshold that automatically triggers low-stock alerts when reached.
- **Reunification:** Process of matching a lost pet with its verified owner and updating system records to `reunified`.
- **Triage:** Moderation and prioritization process for incoming public emergency incident calls.

---

## 29. CLIENT REQUIREMENTS COVERAGE

All identified client requirement dimensions from the Project Requirement Report (`PRR-PAWGUARD-2026-V1`) are covered within this User Operations Manual. The manual provides operational guidance for the corresponding roles, modules, workflows, and administrative functions of the PawGuard Admin Portal.

| Requirement Dimension | PRR Section | Manual Section | Admin Portal Route | Relevant Roles | Manual Coverage |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1. Public Incident Moderation** | Sec 1 | [Section 7](#7-rescue-operations) | `/rescue-requests` | Coordinator, Admin | Fully Documented |
| **2. Emergency Triage & Urgency** | Sec 2 | [Section 7](#7-rescue-operations) | `/rescue-requests` | Coordinator, Admin | Fully Documented |
| **3. Dispatch Assignment** | Sec 3 | [Section 7 & 15](#15-vehicle--fleet-operations) | `/rescue-dispatch` | Coordinator | Fully Documented |
| **4. Rescue En Route State** | Sec 3 | [Section 7](#7-rescue-operations) | `/rescue-dispatch` | Rescue Agent | Fully Documented |
| **5. Rescue Located / Secured** | Sec 3 | [Section 7](#7-rescue-operations) | `/rescue-dispatch` | Rescue Agent | Fully Documented |
| **6. Shelter Admission** | Sec 3 | [Section 7 & 9](#9-shelter-operations) | `/shelters` | Shelter Manager | Fully Documented |
| **7. Dog Master Profile** | Sec 4 | [Section 8](#8-dog-master-management) | `/pets` | Staff Roles | Fully Documented |
| **8. Canine Lifecycle Timeline** | Sec 4 | [Section 8](#8-dog-master-management) | `/pets` | Staff Roles | Fully Documented |
| **9. Clinical Exam & BCS** | Sec 5 | [Section 10](#10-medical-operations) | `/medical-records` | Veterinarian | Fully Documented |
| **10. Vaccines & Reminders** | Sec 5 | [Section 10](#10-medical-operations) | `/medical-reminders` | Veterinarian | Fully Documented |
| **11. Medical Certificates** | Sec 5 | [Section 18](#18-certificates) | `/certificates` | Veterinarian | Fully Documented |
| **12. Shelter Vet Check Request**| Sec 5/6 | [Section 9](#9-shelter-operations) | `/shelter-dogs` | Shelter Manager | Fully Documented |
| **13. Vet Check Status Update** | Sec 5/6 | [Section 10](#10-medical-operations) | `/dashboard/veterinarian`| Veterinarian | Fully Documented |
| **14. Multi-Facility Hierarchy**| Sec 6 | [Section 9](#9-shelter-operations) | `/shelters` | Shelter Manager | Fully Documented |
| **15. Kennel Dual-Booking Guard**| Sec 6 | [Section 9](#9-shelter-operations) | `/shelters` | Shelter Manager | Fully Documented |
| **16. Adoption 9-Stage Pipeline**| Sec 7 | [Section 11](#11-adoption-operations) | `/adoptions` | Adoption Coordinator| Fully Documented |
| **17. Adoption Exclusivity** | Sec 7 | [Section 11](#11-adoption-operations) | `/adoptions` | Adoption Coordinator| Fully Documented |
| **18. Foster Placement & Care** | Sec 8 | [Section 12](#12-foster-operations) | `/fosters` | Foster Coordinator | Fully Documented |
| **19. Volunteer Shift Roster** | Sec 9 | [Section 13](#13-volunteer-operations) | `/volunteers` | Volunteer Coordinator| Fully Documented |
| **20. Lost & Found Matching** | Sec 10 | [Section 17](#17-lost--found) | `/lost-and-found` | Coordinator, Shelter| Fully Documented |
| **21. Donations & Ledgers** | Sec 11 | [Section 16](#16-finance--donation-operations)| `/finance` | Finance User | Fully Documented |
| **22. Inventory & Expiry Alerts**| Sec 12 | [Section 14](#14-inventory-operations) | `/inventory` | Inventory Manager | Fully Documented |
| **23. Fleet & Vehicle Dispatch** | Sec 13 | [Section 15](#15-vehicle--fleet-operations) | `/vehicles` | Centre Admin, Admin| Fully Documented |
| **24. Complaints & Feedback** | Sec 14 | [Section 23](#23-cms--administrative-content)| `/cms/inquiries` | Admin | Fully Documented |
| **25. Executive Reports & Export**| Sec 15 | [Section 19](#19-reports--analytics) | `/reports` | Staff Roles | Fully Documented |

---

## 30. DOCUMENT CHANGE HISTORY

| Revision | Date | Author / Title | Description of Changes |
| :--- | :--- | :--- | :--- |
| **v1.0.0** | September 16, 2026 | PawGuard Documentation Engineering Team | Initial release of the Complete PawGuard Admin Portal User Operations Manual. |
| **v1.1.0** | September 16, 2026 | PawGuard Systems & Quality Assurance Team | Technical audit updates: Vehicle Fleet RBAC, Medical request HTTP 422, Adoption follow-up dependency, Lost & Found pattern matching, and JWT storage. |
| **v1.2.0** | September 16, 2026 | PawGuard Systems Engineering & Documentation Team | Final client-facing documentation refinement. User-facing operational guidance standardized, development-status language removed from operational sections, and PRD-aligned completion presentation finalized. |
