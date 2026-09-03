# PAWGUARD Admin Portal — Rescue Centre Admin Role Documentation

**Document:** `RESCUE_ADMIN.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Rescue Centre Admin (`rescue_centre_admin`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Rescue Centre Admin Role

The **Rescue Centre Admin** (`rescue_centre_admin`) is a centre/branch-level operational management role responsible for overseeing operations within an assigned Rescue Operations Centre (`rescue_centre_id`).

Unlike the Super Administrator, who manages global platform administration, the Rescue Centre Admin focuses on operational administration, facility oversight, fleet monitoring, and operational reporting for their assigned centre.

### Primary Responsibilities

- **Centre Operational Oversight**: Monitor daily rescue operations, case volume, and response metrics for the assigned rescue centre.
- **Shelter Operational Administration**: Maintain operational visibility of assigned shelter facilities, section layout, kennel occupancy, and capacity status.
- **Vehicle Fleet Management**: Register, inspect, edit, and update the operational status (`Available`, `Maintenance`, `Out of Service`) of rescue vehicles assigned to the centre.
- **Dog Master Profile Operational Access**: View dog profiles, rescue intake details, and lifecycle timelines for dogs belonging to the centre (companion pets are strictly excluded).
- **Authorized Safety Tag Operations**: View Safety Tag status, provision initial tags, display/generate QR codes (`${VITE_PUBLIC_FRONTEND_URL}/scan?token=${raw_token}`), reissue/rotate tags, and revoke/deactivate tags for centre dogs.
- **Operational Reports & Analytics**: Access centre-scoped rescue, dispatch, shelter, vehicle, and operational metrics.

### Access Principles & Role Boundaries

The Rescue Centre Admin receives access to **7 client-visible modules**:

1. **Dashboard** (`/rescue-centre-admin-dashboard`)
2. **Rescue Management** (`/rescues`)
3. **Dispatch Management** (`/dispatch-management`)
4. **Dog Master Profile** (`/pets`)
5. **Shelter Management** (`/shelters`, `/shelter-dogs`)
6. **Vehicle Fleet Management** (`/vehicle-management`)
7. **Reports & Analytics** (`/reports`)
*(Notifications are accessible as a system utility)*

#### Restricted & Out-of-Scope Modules

The Rescue Centre Admin is **STRICTLY BLOCKED** from accessing:

- **Staff & Users / User Management** (`/users`) — Reserved for Super Administrator.
- **Roles & Permissions / RBAC** — Reserved for Super Administrator.
- **Audit Logs & System Settings** — Reserved for Super Administrator.
- **Finance & Donations** (`/donations`) — Reserved for Finance User & Super Administrator.
- **Inventory & Pharmacy** (`/inventory`) — Reserved for Inventory Manager & Super Administrator.
- **Adoption Management** (`/adoptions`) — Reserved for Adoption Coordinator & Super Administrator.
- **Foster Management** (`/fosters`) — Reserved for Foster Coordinator & Super Administrator.
- **Volunteer Management** (`/volunteers`) — Reserved for Volunteer Coordinator & Super Administrator.
- **Medical Records** (`/medical-records`) — Reserved for Veterinarian & Super Administrator.

#### Explicit Action Boundaries

The Rescue Centre Admin **DOES NOT** perform:

- **Rescue Verification, Rejection, Agent/Vehicle Assignment, & Dispatch Decisions**: Rescue Coordinator is the operational owner of rescue verification, rejection, agent assignment, vehicle assignment, and dispatch decisions. Super Administrator retains global administrative authority.
- **Field Rescue Execution or Field Status Updates**: Rescue Agent is the field operational owner.
- **Day-to-Day Kennel Allocation & Sanitation**: Shelter Manager is the operational owner of kennel allocation and shelter operations.
- **Medical & Clinical Clearances**: Veterinarian is the clinical operational owner.

---

## 2. Rescue Centre Admin Dashboard

The Rescue Centre Admin Dashboard provides an operational overview restricted strictly to the assigned rescue centre (`rescue_centre_id`).

### Key Metrics & Cards

- **Total Rescue Calls**: Total rescue requests logged for the centre.
- **Pending Calls**: Unverified/unassigned requests awaiting Rescue Coordinator review.
- **Active Dispatches**: In-progress field rescue operations.
- **Shelter Occupancy**: Current dogs in care vs total facility capacity.
- **Fleet Status**: Available, assigned, and maintenance vehicles.

### Centre Scope & Security Rule

All dashboard queries pass `rescue_centre_id: currentCentreId`. If an account does not have an assigned rescue centre, data access is blocked with `"No Rescue Centre Assigned"`. Unscoped global system totals are never exposed.

---

## 3. Module Breakdown

### A. Rescue & Dispatch Management

- Monitor rescue cases and active dispatches in real-time.
- View field agent assignments, assigned vehicles, and GPS rescue progress.
- Log incoming call reports (`Log Report`).
- *Action Guard*: Cannot verify/reject requests or create/reassign dispatches (Coordinator responsibility).

### B. Dog Master Profile (`/pets`)

- Access operational profiles for rescued animals belonging to the centre.
- View registration details, rescue case origin, shelter placement, and medical status.
- Excludes companion pets (`is_companion_pet = false`).

### C. Safety Tag Workflow

- **Source of Truth**: Backend persistent state (SHA-256 hash & 8-char `token_prefix`). Plaintext `raw_token` is returned ONCE upon provisioning response.
- **QR Encoding**: Encodes `${VITE_PUBLIC_FRONTEND_URL}/scan?token=${raw_token}` (default `https://pawguard-public-web.vercel.app/scan?token=<raw_token>`).
- **Reissue / Rotate**: Invalidates old token, issues new raw token, generates new QR.
- **Revoke / Deactivate**: Sets status to `INACTIVE`, invalidating public resolution.

### D. Shelter Management (`/shelters`, `/shelter-dogs`)

- Centre-level operational oversight of shelter facilities, section layout, capacity, and occupancy stats within `rescue_centre_id`.
- View shelter dog records and facility metrics.
- *Action Guard*: Cannot allocate kennels (`KennelAssignmentModal`) or update sanitation states (`Mark Clean`), which belong to Shelter Manager.

### E. Vehicle Fleet Management (`/vehicle-management`)

- Register new vehicles for the centre (`payload.rescue_centre_id = currentCentreId`).
- Edit vehicle specifications and update operational status (`Available`, `Maintenance`, `Out of Service`).
- Delete or deactivate centre fleet units.
- *Action Guard*: Vehicle assignment to active rescue missions is handled by Rescue Coordinator during dispatch.

### F. Reports & Analytics (`/reports`)

- Access centre-scoped operational reports for rescues, dispatches, shelter occupancy, and fleet utilization.
- Restricts cross-centre data, financial reports, audit logs, and user metrics.

---

## 4. End-to-End Workflow & Role Handoffs

```text
Public Rescue Request
        ↓
Rescue Coordinator (Verifies request, assigns Agent & Vehicle, creates Dispatch)
        ↓
Rescue Agent (Accepts dispatch, field status updates: En Route → Arrived → Rescued)
        ↓
Shelter Manager (Admits animal to shelter, assigns Kennel, manages care)
        ↓
Veterinarian (Conducts exam, administers treatment, issues Medical Clearance)
        ↓
Adoption / Foster Coordinator (Manages placement lifecycle)
```

Throughout this workflow, the **Rescue Centre Admin** provides continuous operational oversight, resource management, fleet maintenance, and reporting for their assigned centre.

---

## 5. Summary Matrix

| Capability | Rescue Centre Admin | Rescue Coordinator | Rescue Agent | Shelter Manager | Veterinarian | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Centre Fleet Management | **YES** | View | View | No | No | **YES** |
| Centre Shelter Oversight | **YES** | View | No | **YES** | View | **YES** |
| Dog Master Profile | **YES** | View | View | **YES** | **YES** | **YES** |
| Safety Tag Ops | **YES** | **YES** | Provision | **YES** | No | **YES** |
| Request Verification | No | **YES** | No | No | No | **YES** |
| Agent/Vehicle Dispatch | No | **YES** | No | No | No | **YES** |
| Field Rescue Execution | No | No | **YES** | No | No | **YES** |
| Kennel Allocation | No | No | No | **YES** | No | **YES** |
| Medical Clearance | No | No | No | No | **YES** | **YES** |
| User & RBAC Admin | No | No | No | No | No | **YES** |
