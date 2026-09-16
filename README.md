# PawGuard Admin Portal

**PawGuard Dog Rescue, Shelter Operations & Adoption Management Platform**  
**Internal Operations & Administrative Management Portal**  
**Document Code:** README-PAWGUARD-ADMIN-2026  
**Authoritative Baseline:** PawGuard Project Requirement Report (PRR-PAWGUARD-2026-V1)  

---

## Table of Contents

1. [Overview](#overview)
2. [Project Objectives](#project-objectives)
3. [Key Capabilities](#key-capabilities)
4. [Technology Stack](#technology-stack)
5. [System Architecture](#system-architecture)
6. [Project Structure](#project-structure)
7. [Admin Portal Roles](#admin-portal-roles)
8. [Role-Based Access Control](#role-based-access-control)
9. [Authentication & Session Management](#authentication--session-management)
10. [Modules](#modules)
    - [Authentication](#authentication)
    - [Dashboard](#dashboard)
    - [User Management](#user-management)
    - [Roles & Permissions](#roles--permissions)
    - [Rescue Management](#rescue-management)
    - [Dog Master](#dog-master)
    - [Shelter Management](#shelter-management)
    - [Medical](#medical)
    - [Adoption](#adoption)
    - [Foster](#foster)
    - [Volunteer](#volunteer)
    - [Inventory](#inventory)
    - [Finance](#finance)
    - [Vehicles & Equipment](#vehicles--equipment)
    - [Lost & Found](#lost--found)
    - [Reports & Analytics](#reports--analytics)
    - [Notifications](#notifications)
    - [Audit Logs](#audit-logs)
    - [System Settings](#system-settings)
    - [CMS](#cms)
11. [Major Business Workflows](#major-business-workflows)
12. [API Integration](#api-integration)
13. [Environment Variables](#environment-variables)
14. [Local Development Setup](#local-development-setup)
15. [Available Commands](#available-commands)
16. [Testing & Quality Checks](#testing--quality-checks)
17. [Security](#security)
18. [File Uploads](#file-uploads)
19. [Reporting & Exports](#reporting--exports)
20. [Deployment](#deployment)
21. [Responsive Design](#responsive-design)
22. [UI/UX](#uiux)
23. [Project Documentation](#project-documentation)
24. [Git / Development Workflow](#git--development-workflow)
25. [Troubleshooting](#troubleshooting)
26. [Configuration Reference](#configuration-reference)
27. [PRR Alignment](#prr-alignment)
28. [Quick Reference](#quick-reference)
29. [Support / Maintenance Notes](#support--maintenance-notes)
30. [License](#license)

---

## Overview

The **PawGuard Admin Portal** is an enterprise-grade web application built to streamline and govern the entire operational lifecycle of stray dog rescue, medical treatment, shelter housing, foster placements, adoption contracts, volunteer shifts, inventory logistics, vehicle fleets, and financial auditing.

Operating as the centralized internal operations hub for PawGuard facilities, this portal bridges field operations with administrative governance. It eliminates fragmented manual logs and spreadsheet silos by providing verified chains of custody, immutable clinical histories, zero double-allocation adoption protections, and audit-compliant financial records.

### Platform Boundary Distinction

- **Admin Portal (This Repository):** The internal web application used exclusively by authenticated staff, field rescue agents, licensed veterinarians, facility managers, coordinators, and registered operational users (volunteers, foster families, donors) to conduct operational workflows and system governance.
- **Public Service Portal (Separate Application):** The citizen-facing website where the general public reports emergency rescue incidents, browses adoptable dogs, registers lost/found pets, submits public inquiries, and makes donations.

---

## Project Objectives

Aligined with **PRR-PAWGUARD-2026-V1**, the PawGuard Admin Portal achieves the following business objectives:

1. **Rescue Response Efficiency:** Accelerate emergency verification and dispatch cycle times through real-time incident triage and mobile-optimized agent routing.
2. **Shelter Capacity Optimization:** Eliminate facility overcrowding through multi-branch kennel tracking, visual sanitation states, and inter-facility transfer controls.
3. **Adoption Exclusivity & Velocity:** Facilitate thorough multi-stage vetting (identity verification, background audit, home inspection) while enforcing a digital exclusivity lock that prevents double-allocation errors.
4. **Clinical & Preventative Care Compliance:** Ensure 100% adherence to clinical intake examinations, surgical registers, preventative care schedules (DHPP, Rabies, Deworming), and formal veterinary adoption clearances.
5. **Supply Chain & Pharmacy Accountability:** Audit pharmaceutical, vaccine, and feed consumption, enforcing minimum reorder thresholds and 60-day product expiry warnings.
6. **Financial Transparency & 80G Compliance:** Provide itemized expense tagging to rescue cases and shelter facilities while generating automated tax-compliant donation receipts.
7. **Granular RBAC Governance:** Guarantee complete role isolation and data privacy so that each user accesses only the data and operations permitted by their role.

---

## Key Capabilities

- **15 Role-Tailored Dashboards:** Dedicated operational views displaying contextual KPIs, active task rosters, and quick action bars for every system role.
- **Interactive Rescue Dispatch Board:** Dynamic dispatch coordinator interface with vehicle assignment, agent dispatching, and live field status tracking.
- **Dog Master Profile (360-Degree Record):** Single source of truth for every admitted canine, complete with microchip registry, behavioral matrices, weight tracking, and an immutable event stream.
- **Visual Multi-Facility Kennel Map:** Real-time spatial occupancy matrix supporting 6 operational sections and 4 sanitation states.
- **Veterinary Diagnostic & Surgery Suite:** Standardized intake examination (1-9 Body Condition Score), surgery logs, anesthesia tracking, and adoption medical clearance authorization.
- **6-Stage Adoption Pipeline:** Controlled qualification stages, applicant screening matrices, digital adoption lease generation, certificate creation, and automated 30/90/180-day follow-up audit schedules.
- **Volunteer Self-Service Portal:** Roster browsing, duty acceptance, GPS-enabled attendance check-in/out, activity logging, shelter feedback, and service certificate downloads.
- **Automated Reporting & Analytics Engine:** 6 core PRR analytical reports with interactive drill-downs and real-time PDF/CSV data exports.
- **Enterprise Security & Audit Trail:** Double-layer RBAC route protection, configurable inactivity timeouts, PII masking, file signature validation, and pre/post state audit logging.

---

## Technology Stack

### Core Frontend Technologies

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | React | `^19.2.7` | Component-based user interface |
| **Language** | TypeScript | `~6.0.2` | Static type safety and contract enforcement |
| **Build Tool** | Vite | `^8.1.1` | Fast development server and production bundler |
| **Routing** | React Router DOM | `^7.18.2` | Client-side routing, protected routes, URL state sync |
| **HTTP Client** | Axios | `^1.18.1` | Interceptors, Bearer auth, session handling, binary streaming |
| **Data Visualization** | Recharts | `^3.10.1` | Real-time operational charts and analytical reports |
| **Animation** | Framer Motion | `^12.43.0` | UI transitions, modal animations, state changes |
| **Notifications** | React Hot Toast | `^2.6.0` | Toast notifications for async operations |
| **Icons** | React Icons | `^5.7.0` | FontAwesome, Feather, Material Design icon sets |

### Tooling & Quality Assurance

| Tool | Version | Configuration | Purpose |
| :--- | :--- | :--- | :--- |
| **TypeScript Compiler** | `~6.0.2` | `tsconfig.app.json`, `tsconfig.node.json` | Type checking (`tsc -b`, `tsc --noEmit`) |
| **ESLint** | `^10.6.0` | `eslint.config.js` | Code linting and style compliance |
| **Vite React Plugin** | `^6.0.3` | `vite.config.ts` | Fast Refresh and JSX compilation |

---

## System Architecture

The PawGuard Admin Portal operates as a Single Page Application (SPA) communicating with the PawGuard FastAPI backend service:

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSER                                    |
|  +-----------------------------------------------------------------------------+  |
|  |                             React 19 / TypeScript UI                        |  |
|  +-----------------------------------------------------------------------------+  |
|  |                 React Router 7 (Route Guards & ProtectedRoute)              |  |
|  +-----------------------------------------------------------------------------+  |
|  |             Role-Based Access Control (rbac.ts & permissionsCatalog.ts)     |  |
|  +-----------------------------------------------------------------------------+  |
|  |               Axios API Client Layer (Interceptors & Auth Tokens)           |  |
+--+-----------------------------------------------------------------------------+--+
                                        │
                         HTTPS / JSON Requests & JWT Bearer
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                             PAWGUARD BACKEND ENGINE                               |
|  +-----------------------------------------------------------------------------+  |
|  |                         FastAPI Application Gateway                         |  |
|  +-----------------------------------------------------------------------------+  |
|  |                  OAuth2 / JWT Authentication & RBAC Middleware              |  |
|  +-----------------------------------------------------------------------------+  |
|  |            Operational Domain Controllers (Rescue, Medical, Shelter, ...)   |  |
|  +-----------------------------------------------------------------------------+  |
|  |            Relational Database (PostgreSQL) & Cloud Storage (S3 / Blob)     |  |
+-----------------------------------------------------------------------------------+
```

### Architectural Layer Responsibilities

- **Pages (`src/pages/`):** Full-page module views and role-specific dashboards managing view-level state and API orchestration.
- **Components (`src/components/`):** Reusable UI widgets, data tables, filter toolbars, modal workflows, screening forms, and charts.
- **Layouts (`src/layouts/`):** Application shells (`AdminLayout.tsx`, `AuthLayout.tsx`, `CmsLayout.tsx`) managing sidebars, headers, and navigation states.
- **Services (`src/services/`):** Strongly-typed API client services wrapping Axios HTTP endpoints and response schemas.
- **API Client (`src/api/axios.ts`):** Central Axios instance configuring base URLs, Bearer token injection, request timeouts, and global 401 response interceptors.
- **RBAC Engine (`src/utils/rbac.ts` & `src/utils/permissionsCatalog.ts`):** Central permission evaluation engine supporting dynamic overrides and permission expansion.
- **Auth Storage (`src/utils/authStorage.ts`):** Session storage manager handling user metadata, last activity timestamps, and inactivity timeout enforcement.

---

## Project Structure

```
Pawguard_admin/
├── docs/                               # Comprehensive operational manuals, role guides, QA reports
│   ├── ADOPTION_COORDINATOR.md         # Adoption officer operations guide
│   ├── ALL_ROLES_AND_MODULES_...md     # Platform-wide integration audit
│   ├── Agent.md                        # Architecture, engineering standards & PRR alignment
│   ├── FINAL_ADMIN_PORTAL_E2E_QA_...md # End-to-end testing run sheet
│   ├── PAWGUARD_Admin_Portal_...md     # Official Admin Portal Operations Manual
│   ├── RESCUE_COORDINATOR.md           # Rescue dispatch workflows
│   ├── SHELTER_MANAGER.md              # Shelter capacity and kennel operations
│   ├── SUPER_ADMIN.md                  # Governance and platform administration
│   ├── VETERINARIAN.md                 # Clinical exam, surgery and clearance guide
│   └── ...                             # Additional module and role guides
├── public/                             # Static assets, favicon, logos
├── scratch/                            # Audit scratchpad and backend test scripts
├── src/
│   ├── api/
│   │   └── axios.ts                    # Axios configuration, interceptors, inactivity timer
│   ├── components/
│   │   ├── adoptions/                  # Screening modals, lease generator, handover dialogs
│   │   ├── auth/                       # Login form, password reset, session timeout modals
│   │   ├── certificates/               # Certificate preview and generation components
│   │   ├── common/                     # Reusable badges, buttons, modals, spinners, pagination
│   │   ├── dashboard/                  # Dashboard stat cards, quick action grids, sidebar, header
│   │   ├── layout/                     # AdminLayout, ProtectedRoute, role wrappers
│   │   ├── medical/                    # Clinical diagnosis forms, Rx registers, clearance modals
│   │   ├── notifications/              # Notification dropdown and drawer panels
│   │   ├── pets/                       # Dog profile forms, timeline renderer, QR code modals
│   │   ├── rbac/                       # Dynamic permission matrix grid and role assignment tools
│   │   ├── reports/                    # Chart drill-downs and export format triggers
│   │   ├── rescue/                     # Dispatch board, map view, outcome logging modals
│   │   ├── shelters/                   # Visual kennel map, occupancy meters, sanitation toggles
│   │   ├── users/                      # User creation, status toggling, role assignment dialogs
│   │   └── volunteers/                 # Shift scheduler, attendance check-in/out dialogs
│   ├── constants/                      # Application constants and static lookup tables
│   ├── context/                        # React context providers for global UI state
│   ├── hooks/                          # Custom React hooks (notifications, dashboard metrics, sync)
│   ├── layouts/
│   │   └── AdminLayout.tsx             # Main dashboard layout shell with responsive sidebar
│   ├── pages/
│   │   ├── adoptions/                  # Adoptions.tsx
│   │   ├── audit/                      # AuditLogs.tsx
│   │   ├── auth/                       # Login.tsx, ResetPassword.tsx, Unauthorized.tsx
│   │   ├── certificates/               # Certificates.tsx
│   │   ├── cms/                        # CmsLayout.tsx and 10 CMS sub-views (Articles, FAQ, etc.)
│   │   ├── dashboard/                  # Dashboard.tsx (Router) and 15 role dashboards
│   │   ├── finance/                    # Finance.tsx
│   │   ├── fosters/                    # FosterManagement.tsx, FosterDogs.tsx
│   │   ├── inventory/                  # Inventory.tsx
│   │   ├── lostfound/                  # LostAndFound.tsx
│   │   ├── medical/                    # MedicalRecords.tsx, VaccinationReminders.tsx, VetAppointments.tsx
│   │   ├── notifications/              # Notifications.tsx
│   │   ├── permissions/                # RolesPermissions.tsx
│   │   ├── pets/                       # Pets.tsx
│   │   ├── public/                     # PublicDogProfile.tsx (QR Scan redirect view)
│   │   ├── reports/                    # Reports.tsx
│   │   ├── rescues/                    # RescueManagement.tsx, RescueRequests.tsx, RescueDispatch.tsx
│   │   ├── settings/                   # SystemSettings.tsx
│   │   ├── shelters/                   # Shelters.tsx, ShelterDogs.tsx
│   │   ├── users/                      # Users.tsx
│   │   ├── vehicles/                   # VehicleManagement.tsx
│   │   └── volunteers/                 # VolunteerManagement.tsx
│   ├── routes/                         # Route configuration helpers
│   ├── services/                       # 24 API services interfacing with backend endpoints
│   ├── types/                          # TypeScript interface definitions (Auth, Rescue, Pet, Medical, etc.)
│   ├── utils/
│   │   ├── authStorage.ts              # Session storage, last activity tracker, timeout logic
│   │   ├── dataSync.ts                 # Custom broadcast events for instant cross-component sync
│   │   ├── dateUtils.ts                # Date and timestamp formatting helpers
│   │   ├── errorUtils.ts               # API error extraction and user-friendly messaging
│   │   ├── permissionsCatalog.ts       # 105-cell action × module permission catalog
│   │   ├── qrGenerator.ts              # QR code generation utility for dog collars
│   │   ├── rbac.ts                     # Live RBAC evaluator, overrides, and permission expander
│   │   └── roleUtils.ts                # Role normalization, navigation menu builders
│   ├── App.tsx                         # Root component, route declarations, ProtectedRoute wrapping
│   ├── index.css                       # Core Tailwind/Vanilla CSS design system and tokens
│   └── main.tsx                        # Application entrypoint
├── .env.example                        # Template for required environment variables
├── eslint.config.js                    # ESLint configuration
├── package.json                        # Project metadata, dependencies, and build scripts
├── tsconfig.json                       # Base TypeScript configuration
├── tsconfig.app.json                   # Client TypeScript compiler settings
├── tsconfig.node.json                  # Vite Node tooling TypeScript configuration
├── vercel.json                         # Vercel deployment rewrites and API proxies
└── vite.config.ts                      # Vite dev server configuration and proxy rules
```

---

## Admin Portal Roles

The Admin Portal supports **14 distinct operational roles** with strict separation of operational concerns:

```
+--------------------------+---------------------------------------------------------------------------+
| Role Identifier          | Operational Responsibility & Data Boundaries                              |
+--------------------------+---------------------------------------------------------------------------+
| super_admin              | System governance, user provisioning, live RBAC matrix, audit log review  |
| rescue_centre_admin      | Facility strategy, fleet oversight, high-level approvals, grievances      |
| rescue_coordinator       | Incident triage, report verification, field agent and vehicle dispatch    |
| rescue_agent             | Mobile field execution, GPS navigation, outcome logging, transport logs   |
| veterinarian             | Clinical intake exams, surgeries, vaccinations, adoption health clearance |
| shelter_manager          | Multi-facility capacity, kennel allocation, sanitation, transfer logs     |
| adoption_coordinator     | 6-phase applicant vetting, home inspection, exclusivity lock, contracts   |
| foster_coordinator       | Foster home onboarding, placement tracking, supply dispatch logs          |
| volunteer_coordinator    | Volunteer onboarding, skills matrix, shift rosters, attendance verification|
| inventory_manager        | SKU catalog, stock arrival/transfer auditing, 60-day expiry enforcement   |
| finance_user             | Operational expense recording, donation reconciliation, 80G tax receipts  |
| volunteer                | Self-service shift claiming, GPS check-in/out, activity logs, certificates|
| foster_family            | Self-service daily logs, weight tracking, symptom photos, supply requests |
| donor                    | Self-service contribution history, dog sponsorship progress, tax receipts |
+--------------------------+---------------------------------------------------------------------------+
```

### Role vs Module Access Matrix

| Module | Super Admin | Rescue Admin | Rescue Coord | Rescue Agent | Vet | Shelter Mgr | Adoption Coord | Foster Coord | Vol Coord | Inv Mgr | Finance | Vol | Foster | Donor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Self | Self | Self |
| **Users & IAM** | Full | View | - | - | - | View | - | - | - | - | - | - | - | - |
| **RBAC Matrix** | Full | - | - | - | - | - | - | - | - | - | - | - | - | - |
| **Rescues** | Full | Full | Full | Assigned | - | - | - | - | - | - | - | - | - | - |
| **Dispatch** | Full | Full | Full | - | - | - | - | - | - | - | - | - | - | - |
| **Dog Master** | Full | Full | Full | View | Full | Full | Full | Full | View | View | View | - | Assigned | Sponsored |
| **Shelter/Kennels**| Full | Full | View | - | View | Full | View | - | - | View | - | - | - | - |
| **Medical Suite** | Full | View | - | - | Full | View | View | - | - | - | - | - | - | - |
| **Adoptions** | Full | View | - | - | View | View | Full | - | - | - | - | - | - | - |
| **Foster Care** | Full | View | - | - | - | View | - | Full | - | - | - | - | Self | - |
| **Volunteers** | Full | View | - | - | - | View | - | - | Full | - | - | Self | - | - |
| **Inventory** | Full | View | - | - | View | Full | - | View | - | Full | - | - | - | - |
| **Finance / 80G** | Full | View | - | - | - | - | - | - | - | - | Full | - | - | Self |
| **Fleet & Gear** | Full | Full | Full | - | - | - | - | - | - | - | - | - | - | - |
| **Reports** | Full | Full | Full | - | Full | Full | Full | Full | Full | Full | Full | - | - | - |
| **Audit Logs** | Full | - | - | - | - | - | - | - | - | - | - | - | - | - |
| **Settings** | Full | - | - | - | - | - | - | - | - | - | - | - | - | - |
| **CMS** | Full | Full | - | - | - | - | - | - | - | - | - | - | - | - |

---

## Role-Based Access Control

The RBAC system implements a two-tier protection model:

1. **Client-Side Enforcement (`ProtectedRoute.tsx`):**
   - Direct address bar navigation to unauthorized routes is intercepted before component mounting.
   - Evaluates authenticated state, `allowedRoles`, and granular `permission` codes.
   - Unauthorized attempts immediately abort rendering and redirect to `/403` (Forbidden) or `/?expired=true` (Session Expired).
2. **Server-Side Verification:**
   - Every API request carries a JWT Bearer token in the `Authorization` header.
   - The backend API verifies user role and permissions on every endpoint transaction.

```
┌─────────────────────────────────┐
│     User Navigation Attempt     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    Authentication Check         │ ── Not Authenticated ──► Redirect to Login (`/`)
└────────────────┬────────────────┘
                 │ Authenticated
                 ▼
┌─────────────────────────────────┐
│    Session Expiry Check         │ ── Inactive Timeout ──► Clear Auth & Redirect (`/?expired=true`)
└────────────────┬────────────────┘
                 │ Active Session
                 ▼
┌─────────────────────────────────┐
│    Allowed Role Check           │ ── Role Mismatch ────► Redirect to Forbidden (`/403`)
└────────────────┬────────────────┘
                 │ Role Authorized (or Super Admin)
                 ▼
┌─────────────────────────────────┐
│    Granular Permission Check    │ ── Missing Code ─────► Redirect to Forbidden (`/403`)
└────────────────┬────────────────┘
                 │ Permission Granted
                 ▼
┌─────────────────────────────────┐
│    Render Operational Screen    │
└─────────────────────────────────┘
```

### Dynamic Permission Overrides

Super Administrators can modify role permissions in real-time via `/roles-permissions`. Changes are broadcast across the application via `notifyPermissionsChanged()`, instantly updating UI access without requiring users to log out.

---

## Authentication & Session Management

- **Endpoint:** `POST /api/v1/auth/login`
- **Session Tokens:** JWT Bearer tokens attached automatically via Axios request interceptors.
- **Inactivity Timeout:** Automated session termination after a configurable inactivity period (default **30 minutes**, configurable from **5 to 120 minutes** in System Settings).
- **Cross-Tab Synchronization:** `BroadcastChannel("pawguard_session_sync")` ensures that user activity in one tab refreshes the session timer across all open tabs, and a logout in one tab immediately terminates all tabs.
- **401 Interception:** Global Axios response handler intercepts expired sessions, clears client credentials, and redirects to `/?expired=true` with an informative banner.

---

## Modules

### Authentication
- User login with email/password and client identification header (`X-Client-Type: admin`).
- Self-service password reset workflow with token validation via email link.
- Inactivity warning modal notifying users 60 seconds before session termination.

### Dashboard
- Dynamic entry router directing authenticated staff to their designated role dashboard.
- 15 dedicated dashboard components rendering real-time KPI metrics, active case tables, and quick action bars.

### User Management
- Staff account provisioning, profile editing, role assignment, and account activation/deactivation.
- Search, filter by role, and activity status indicators.

### Roles & Permissions
- Interactive 105-cell permission matrix (7 actions × 15 operational modules) supporting dynamic permission toggles.
- Live override persistence via `PUT /api/v1/admin/roles/permissions`.

### Rescue Management
- Multi-step rescue incident verification, severity classification (Critical, Injured, Sick, Malnourished, Stray), and rejection rationale logging.
- Dispatch board allocating field agents, rescue vans, and capture gear.
- Standardized field outcome codes (`ANIMAL_FLED`, `AREA_INACCESSIBLE`, `FALSE_REPORT`, `LOCAL_BLOCK`) and emergency escalation flags.

### Dog Master
- 360-degree single source of truth for every admitted canine.
- Tracks unique Registration Numbers, microchip IDs, physical traits, 6-point behavioral matrix, and current location.
- Immutable historical event stream logging intake, medical procedures, kennel transfers, and adoptions.

### Shelter Management
- Multi-facility occupancy monitoring across 6 operational sections.
- Visual kennel allocation engine with 4 sanitation states (`Clean`, `Needs Cleaning`, `Disinfecting`, `Out of Service`).
- Inter-facility transfer logs with sender dispatch and receiver confirmation handshakes.

### Medical
- Clinical intake examination recording Body Condition Score (1–9), dental health, coat condition, and visible trauma.
- Surgical logs for sterilization and orthopedic procedures with anesthesia details.
- Preventative care tracking for core vaccinations (DHPP, Rabies) and deworming.
- Daily medication administration registers and formal digital Adoption Health Clearance approval.

### Adoption
- 6-phase adoption pipeline: Application → Document Verification → Background Interview → Home Inspection → Approval & Lease → Handover & Certificate → 30/90/180-Day Follow-ups.
- Mandatory Adoption Exclusivity Lock applied when an application reaches `Home Inspection Approved`.

### Foster
- Foster caregiver qualification directory tracking home setup, preferences, and active capacity.
- Placement tracking with inventory supply dispatch logging (crates, food, medication).
- Caregiver daily progress portal (weights, behavioral notes, symptom photos).
- Streamlined foster-to-adopt conversion workflow.

### Volunteer
- Volunteer onboarding, emergency contacts, and specialized skills cataloging.
- Branch shift scheduling with capacity limits.
- Self-service dashboard for shift claiming, GPS-enabled check-in/out, activity notes, and certificate downloads.

### Inventory
- Central SKU catalog across 7 categories (Pharmaceuticals, Vaccines, Surgical Consumables, Dog Food, Sanitation Supplies, Capture Gear, Office Supplies).
- Stock movement auditing, reorder threshold alerts, and 60-day expiration warnings.

### Finance
- Operational expense recording tagged to specific rescue cases or shelter facilities.
- General donation, recurring membership, and dog sponsorship reconciliation.
- Automated 80G tax exemption receipt PDF generation.

### Vehicles & Equipment
- Rescue van, ambulance, and mobile clinic registry tracking driver assignment, mileage, and maintenance.
- Equipment checkout logs for high-value capture assets (net guns, traps, microchip scanners).

### Lost & Found
- Dual-purpose lost/found pet registry with attribute-based cross-matching (breed, color, radius, date).
- Ownership verification and claim audit workflow before contact disclosure.

### Reports & Analytics
- 6 core PRR analytical reports (Rescue Efficiency, Shelter Capacity, Medical Compliance, Adoption Velocity, Financial Transparency, Inventory Valuation).
- Real-time chart drill-downs and PDF/CSV data export engine.

### Notifications
- Role-filtered notification center broadcasting system alerts, emergency dispatches, and workflow updates.

### Audit Logs
- Immutable audit log viewer capturing User ID, Timestamp, IP Address, Action Code, and Pre/Post State JSON diffs.

### System Settings
- System configuration, session timeout sliders (5–120 mins), MFA policy toggles, and manual backup triggers.

### CMS
- Content management interface for publishing articles, FAQs, success stories, and legal terms.

---

## Major Business Workflows

### 1. Emergency Rescue Lifecycle

```mermaid
graph TD
    A[Public / Field Incident Report] -->|Status: REPORTED| B(Rescue Coordinator Triage)
    B -->|Reject with Reason| C[Status: REJECTED / Archived]
    B -->|Verify Authenticity| D[Status: VERIFIED]
    D -->|Allocate Agent & Vehicle| E[Status: DISPATCHED]
    E -->|Visual Contact Made| F[Status: LOCATED]
    F -->|Animal Secured in Van| G[Status: RESCUED]
    G -->|Shelter Gate Handover| H[Status: ADMITTED]
    H -->|System Trigger| I[Creates Dog Master Record & Quarantine Kennel]
```

### 2. Adoption & Exclusivity Workflow

```mermaid
graph TD
    A[Adoption Application Submitted] --> B[Phase 1: Document & ID Verification]
    B --> C[Phase 2: Background Interview & Audit]
    C --> D[Phase 3: Home Inspection Visit]
    D -->|Home Inspection Approved| E[EXCLUSIVITY LOCK APPLIED ON DOG]
    E --> F[Phase 4: Digital Adoption Lease Signing]
    F --> G[Phase 5: Dog Handover & Certificate Issuance]
    G --> H[Phase 6: Post-Adoption Follow-ups: 30, 90, 180 Days]
```

---

## API Integration

All API integrations reside in `src/services/` and interface with the backend REST endpoints:

| Service Module | File | Core Endpoints & Operations |
| :--- | :--- | :--- |
| `authService` | `src/services/auth/authService.ts` | Login, current user (`/auth/me`), password reset, refresh tokens |
| `userService` | `src/services/userService.ts` | User CRUD, account activation, role assignment |
| `rescueService` | `src/services/rescueService.ts` | Rescue case intake, verification, dispatch unit creation, outcome logging |
| `petService` | `src/services/petService.ts` | Dog master catalog, intake registration, 360 timeline, QR codes |
| `medicalService` | `src/services/medicalService.ts` | Clinical exams, surgical records, Rx administration, medical clearances |
| `shelterService` | `src/services/shelterService.ts` | Facility occupancy, kennel maps, sanitation states, inter-facility transfers |
| `adoptionService` | `src/services/adoptionService.ts` | 6-stage application vetting, exclusivity locks, leases, follow-up logs |
| `fosterService` | `src/services/fosterService.ts` | Foster parent directory, placements, supply logs, foster-to-adopt |
| `volunteerService` | `src/services/volunteerService.ts`| Shift rosters, GPS check-in/out, activity notes, certificates |
| `inventoryService` | `src/services/inventoryService.ts`| SKU catalog, stock arrival/transfers, consumption logs, expiry alerts |
| `financeService` | `src/services/financeService.ts` | Expense recording, financial ledgers, account reconciliation |
| `donationsService` | `src/services/donationsService.ts`| Donation tracking, dog sponsorship pipeline, 80G tax receipt generation |
| `vehicleService` | `src/services/vehicleService.ts` | Fleet ledger, driver assignments, routine maintenance schedules |
| `lostFoundService` | `src/services/lostFoundService.ts`| Lost/found postings, attribute matching matrix, claim verification |
| `reportsService` | `src/services/reportsService.ts` | 6 core analytical reports, async PDF/CSV binary streaming |
| `auditService` | `src/services/auditService.ts` | Immutable audit log retrieval with pre/post state JSON diffs |
| `settingsService` | `src/services/settingsService.ts` | Global configuration, session timeouts, backup triggers |
| `cmsService` | `src/services/cmsService.ts` | Articles, success stories, FAQs, contact inquiries, legal pages |
| `storageService` | `src/services/storageService.ts` | Pre-signed URL upload pipeline, MIME/signature validation |
| `notificationService`| `src/services/notificationService.ts`| Broadcast alerts, notification read states, role filtering |
| `grievanceService` | `src/services/grievanceService.ts`| Public complaints, internal ticket routing, resolution logs |
| `reminderService` | `src/services/reminderService.ts`| Automated vaccination and medical checkup reminders |
| `vetService` | `src/services/vetService.ts` | Affiliated veterinary hospital directory and appointment logs |
| `dogService` | `src/services/dogService.ts` | Specialized companion animal helper operations |

---

## Environment Variables

Create a `.env.local` or `.env` file in the root directory based on `.env.example`:

| Variable Name | Description | Required | Example / Default Value | Consumed By |
| :--- | :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Base endpoint for backend API requests | Yes | `/api/v1` (dev proxy) or `https://backend-url/api/v1` | `src/api/axios.ts` |
| `VITE_FRONTEND_BASE_URL` | Canonical URL of this Admin Portal | No | `https://pawguard-admin.vercel.app` | Metadata / Redirects |
| `VITE_PUBLIC_FRONTEND_URL`| Public Service Portal base URL | No | `https://pawguard-public-web.vercel.app` | QR Collar Links |

> **Security Note:** Never commit actual API keys, database credentials, or JWT secrets to this repository. All client-side environment variables must be prefixed with `VITE_`.

---

## Local Development Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher (v20.x recommended)
- **npm:** v9.0.0 or higher
- **Git**

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Pawguard_admin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   *(Ensure `VITE_API_BASE_URL` is set to `/api/v1` for Vite dev proxying to the live backend).*

4. **Launch the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local Vite development server with Hot Module Replacement (HMR) at port `5173`. |
| `npm run build` | Compiles TypeScript declarations (`tsc -b`) and bundles the application for production using Vite. |
| `npm run preview` | Runs a local web server to preview the production build output from the `dist/` directory. |
| `npm run lint` | Runs ESLint across all TypeScript and TSX source files to enforce code style and safety rules. |
| `npx tsc --noEmit` | Executes a pure static TypeScript compiler check across the entire project without emitting artifacts. |

---

## Testing & Quality Checks

### Verification Commands

```bash
# 1. Verify TypeScript static typing (must exit with code 0)
npx tsc --noEmit

# 2. Run ESLint checks
npm run lint

# 3. Test production build bundling
npm run build
```

### Audit Verification Evidence

- **TypeScript Compilation:** 0 errors across all 24 services and 48 view components.
- **Production Build:** Passes cleanly (810 modules bundled in ~1.55 seconds).
- **Data Integrity:** 100% verified against OpenAPI 3.1.0 specifications with zero mock datasets.

---

## Security

1. **Double-Layer RBAC:** Client-side route blocking in `ProtectedRoute.tsx` plus server-side Bearer token authorization on all API requests.
2. **Session Governance:** Automatic session invalidation after 30 minutes of inactivity, synchronized across browser tabs.
3. **PII Masking:** Reporter phone numbers and residential addresses are masked (`+91 ••••• ••123`) for non-coordinator staff.
4. **Audit Logging:** Pre/post state change tracking on status changes, prescriptions, adoption approvals, and role updates.
5. **Secure Headers & Cookies:** Strict-Transport-Security, SameSite=Lax cookie normalization, and `X-Client-Type: admin` request tagging.

---

## File Uploads

File uploads are handled through `storageService.ts` using direct pre-signed URL upload flows:
- **Supported Formats:** JPEG, PNG, PDF, MP4.
- **Validation:** Client-side MIME type verification and magic byte file signature validation.
- **Payload Limits:** Maximum **50MB** combined aggregate limit for incident media uploads (up to 5 photos and video clips).

---

## Reporting & Exports

The reporting engine (`Reports.tsx` / `reportsService.ts`) supports real-time operational analysis:

| Report Name | Frequency | Target Roles | Export Formats |
| :--- | :--- | :--- | :--- |
| **Rescue Case Efficiency** | Daily / Weekly | Rescue Coordinators, Admins | PDF, CSV, Excel |
| **Shelter Capacity Audit** | Real-time Daily | Shelter Managers | PDF, CSV, Excel |
| **Medical & Vaccine Compliance** | Weekly / Monthly | Veterinarians | PDF, CSV, Excel |
| **Adoption Velocity Index** | Monthly | Adoption Officers | PDF, CSV, Excel |
| **Financial Transparency** | Monthly / Quarterly | Finance Users, Admins | PDF, CSV, Excel |
| **Inventory Valuation & Expiry** | Monthly | Inventory Managers | PDF, CSV, Excel |

---

## Deployment

The project is configured for deployment on modern static hosting platforms (such as **Vercel**):

### Production Build Settings
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** 18.x or 20.x

### Rewrites & Proxy Configuration (`vercel.json`)

```json
{
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://pawguard-backend-mqri.onrender.com/api/v1/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## Responsive Design

The PawGuard Admin Portal is built with a responsive layout:
- **Desktop (1920x1080, 1440x900):** Full multi-column data grids, interactive kennel maps, and side-by-side workflow panels.
- **Tablet (768px - 1024px):** Collapsible sidebar, responsive table cards, and touch-friendly controls.
- **Mobile (375px - 430px):** Optimized field interfaces for Rescue Agents, Volunteers, and Foster Families with single-touch action buttons and GPS triggers.
- **Display Zoom Compatibility:** Verified layout stability at 100%, 125%, and 150% browser zoom levels with zero horizontal overflow.

---

## UI/UX

- **Color Palette:**
  - Primary Base: Professional Navy Blue (`#1E3A8A`)
  - Background: Slate Grey (`#F8FAFC`, `#0F172A` in dark mode)
  - Recovery / Success Accent: Forest Green (`#16A34A`)
  - Emergency / Critical Indicator: Amber / Crimson (`#DC2626`)
- **Typography:** Inter / Roboto clean sans-serif prioritizing legibility under direct sunlight.
- **Data Tables:** High-contrast text, zebra striping, sticky table headers, and explicit status badges.
- **State Handling:** Dedicated skeleton loaders, informative empty state screens, and inline error alert banners.

---

## Project Documentation

Comprehensive operational guides and technical reports are located in the `docs/` directory:

| Documentation File | Description |
| :--- | :--- |
| `docs/Agent.md` | Architecture standards, engineering rules, and PRR requirements map |
| `docs/PAWGUARD_Admin_Portal_User_Operations_Manual.md` | Step-by-step operations manual for all staff roles |
| `docs/ALL_ROLES_AND_MODULES_FRONTEND_BACKEND_INTEGRATION_AUDIT.md` | Platform-wide 669-endpoint OpenAPI contract audit |
| `docs/FINAL_ADMIN_PORTAL_E2E_QA_REPORT.md` | Complete functional testing run sheet and test results |
| `docs/RESCUE_COORDINATOR.md` | Incident triage and dispatch operations guide |
| `docs/SHELTER_MANAGER.md` | Capacity management, kennel allocation, and care registers |
| `docs/VETERINARIAN.md` | Clinical exams, surgeries, medication, and health clearance guide |
| `docs/ADOPTION_COORDINATOR.md` | Adoption vetting, exclusivity locking, and follow-up guide |
| `docs/SUPER_ADMIN.md` | Platform governance, user provisioning, and RBAC matrix guide |
| `docs/VEHICLE_FLEET.md` | Fleet tracking, maintenance logs, and capture gear guide |
| `docs/QR_SAFETY_TAG_SYSTEM.md` | QR code safety tag generation and public pet scan specification |

---

## Git / Development Workflow

1. **Feature Development:** Create topic branches from `main` (e.g., `feature/adoption-lease-signing` or `fix/kennel-sanitation-toggle`).
2. **Local Validation:** Run static type checking and linting prior to committing:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```
3. **Build Testing:** Verify production bundle compilation:
   ```bash
   npm run build
   ```
4. **Pull Requests:** Submit PRs against `main` ensuring all quality checks pass.

---

## Troubleshooting

### 1. API Connection Failure / Network Error
- **Symptom:** UI displays "Failed to connect to backend server" or network requests return `503 Service Unavailable`.
- **Cause:** Backend instance spinning up from cold boot (e.g., Render free tier) or incorrect `VITE_API_BASE_URL`.
- **Resolution:** Verify backend health at `https://pawguard-backend-mqri.onrender.com/health`. Ensure `vite.config.ts` proxy target is reachable.

### 2. 401 Unauthorized / Immediate Logout
- **Symptom:** User is redirected to `/?expired=true` immediately upon logging in or navigating.
- **Cause:** Expired JWT token or mismatched client clock exceeding the 30-minute inactivity threshold.
- **Resolution:** Log in with valid credentials. Check browser cookies and clear `sessionStorage` if stale tokens persist.

### 3. 403 Forbidden Access
- **Symptom:** Navigating to a page redirects to `/403`.
- **Cause:** Authenticated user role lacks the required permission in `src/utils/permissionsCatalog.ts`.
- **Resolution:** Log in as Super Admin and verify role permissions under `/roles-permissions`.

### 4. Blank Dashboard / Infinite Spinner
- **Symptom:** Dashboard hangs on loading skeleton.
- **Cause:** Unhandled promise rejection in parallel data hydration (`Promise.allSettled`).
- **Resolution:** Inspect browser console for failed endpoint responses. Ensure the authenticated user profile exists in the backend database.

---

## Configuration Reference

- **Dev Server Port:** `5173` (`strictPort: true` in `vite.config.ts`)
- **API Proxy Path:** `/api` -> `https://pawguard-backend-mqri.onrender.com`
- **Default Session Timeout:** `30 minutes` (`DEFAULT_SESSION_TIMEOUT_MINUTES` in `authStorage.ts`)
- **Default Page Size:** `10` / `25` / `50` items per table page

---

## PRR Alignment

The PawGuard Admin Portal directly implements the requirements established in **PRR-PAWGUARD-2026-V1**:

- **PRR Section 2.1:** 14 Admin Portal roles with granular RBAC matrix.
- **PRR Section 3.2 & 3.3:** 6-stage rescue lifecycle with mobile field agent dashboard.
- **PRR Section 3.4:** Dog Master Profile with 360-degree historical timeline.
- **PRR Section 3.5:** Veterinary examination suite with BCS 1–9 and digital adoption health clearance.
- **PRR Section 3.6:** Multi-facility shelter management with 4-state kennel allocation.
- **PRR Section 3.7:** 6-phase adoption vetting pipeline with mandatory exclusivity locking.
- **PRR Section 3.8:** Foster placement tracking with supply dispatch registers.
- **PRR Section 3.9:** Volunteer rosters, GPS attendance, and verified service certificates.
- **PRR Section 3.11:** Financial ledgers with 80G tax receipt generation.
- **PRR Section 3.12:** Inventory SKU tracking with 60-day expiry enforcement.
- **PRR Section 4.1:** 6 core operational reports with PDF/CSV export streaming.
- **PRR Section 6.1:** Double-layer RBAC, PII masking, and pre/post state audit logging.

---

## Quick Reference

```bash
# Install Dependencies
npm install

# Start Local Dev Server (http://localhost:5173)
npm run dev

# Run TypeScript Validation
npx tsc --noEmit

# Run ESLint Check
npm run lint

# Compile Production Build
npm run build

# Preview Production Build
npm run preview
```

---

## Support / Maintenance Notes

- **Primary Maintainer:** PawGuard Engineering & Systems Governance Team
- **Backend Service Contract:** OpenAPI 3.1.0 (`/openapi.json`)
- **Documentation Reference:** `docs/PAWGUARD_Admin_Portal_User_Operations_Manual.md`

---

## License

Confidential and Proprietary. Copyright © 2026 PawGuard Animal Rescue & Adoption Foundation. All rights reserved.
