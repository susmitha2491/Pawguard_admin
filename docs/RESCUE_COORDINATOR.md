# PAWGUARD Admin Portal — Rescue Coordinator Role Documentation

**Document:** `RESCUE_COORDINATOR.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Rescue Coordinator (`rescue_coordinator`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Rescue Coordinator Role

The **Rescue Coordinator** (`rescue_coordinator`) is an operational role responsible for managing rescue requests, reviewing reports, verifying requests, rejecting invalid/duplicate/unlocatable requests with rationale, creating dispatches, and assigning field agents and vehicles.

The Rescue Coordinator focuses on **operational coordination and dispatch decisions**.

### Primary Responsibilities

- **Rescue Request Review & Verification**: Inspect incoming rescue requests and mark requests as `VERIFIED` or `REJECTED` (with mandatory rejection rationale).
- **Rescue Dispatch Creation**: Create dispatch records (`+ New Dispatch`) for verified rescue cases.
- **Field Agent Assignment**: Assign available field rescue agents (`rescue_agent`) to dispatch cases and handle agent reassignments.
- **Vehicle Selection & Assignment**: Select available rescue vehicles from the fleet (`Available`) and assign/reassign vehicles to dispatch missions.
- **Dispatch Management**: Monitor live dispatch progress, update dispatch instructions, or cancel dispatches (`CANCELLED`) when required.
- **Authorized Safety Tag Operations**: View Safety Tag status and provision/reissue Safety Tags where authorized.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard | Operational Overview | Real-time rescue Queue, active dispatches, and agent availability |
| Rescue Queue / Rescue Management (`/rescues`) | Full Coordinator Access | Verify requests, reject requests with rationale, open details |
| Dispatch Management (`/dispatch-management`) | Full Coordinator Access | Create dispatches, assign/reassign agents and vehicles, cancel dispatches |
| Rescue Cases | View & Manage | Track rescue lifecycle from reported to shelter handover |
| Notifications | System Utility | Operational alerts and status notifications |
| Staff & Users / User Management | **BLOCKED** | Reserved for Super Administrator |
| System Settings & Audit Logs | **BLOCKED** | Reserved for Super Administrator |
| Finance, Inventory, Medical Records | **BLOCKED** | Reserved for respective domain roles |

---

## 3. Rescue Request & Dispatch Workflow

```text
Public Rescue Request Received (REPORTED)
        ↓
Rescue Coordinator Reviews Request Details & Location
        ↓
Decision: VERIFIED or REJECTED (with rationale)
        ↓
If VERIFIED: Coordinator Creates Dispatch
        ↓
Selects Available Field Agent & Rescue Vehicle
        ↓
Dispatch Issued (DISPATCHED / EN_ROUTE)
        ↓
Rescue Agent Accepts & Executes Field Operation (LOCATED → RESCUED)
        ↓
Transport to Shelter & Handover (ADMITTED)
```

### Action Boundaries & Ownership

- **Operational Ownership**: Rescue Coordinator is the operational owner of rescue verification, rejection, agent assignment, vehicle assignment, and dispatch decisions. Super Administrator retains global administrative authority.
- **Field Status Updates (`En Route`, `Arrived`, `Completed`)**: Executed by **Rescue Agent** in the field.
- **Shelter Admission & Kennel Allocation**: Shelter Manager is the operational owner of shelter admission and kennel allocation.
- **Fleet Management & Operational Oversight**: Managed by **Rescue Centre Admin**.
