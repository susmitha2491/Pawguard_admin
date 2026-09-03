# PAWGUARD Admin Portal — Rescue Agent Role Documentation

**Document:** `RESCUE_AGENT.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Rescue Agent (`rescue_agent`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Rescue Agent Role

The **Rescue Agent** (`rescue_agent`) is a field-operational role responsible for carrying out field rescue missions assigned by the Rescue Coordinator.

The Rescue Agent receives case assignments, navigates to field locations, executes animal rescues, updates real-time operational status, provisions initial Safety Tags upon rescue, and transports rescued animals to shelter facilities.

### Primary Responsibilities

- **View Assigned Cases**: Access personal workspace of assigned field rescue cases.
- **Field Status Updates**: Update live operational stages:
  - `Start Dispatch` (`accepted` / `dispatched`)
  - `Mark En Route` (`en_route`)
  - `Mark Arrived / Located` (`arrived` / `located`)
  - `Mark Completed / Rescued` (`rescued` / `completed`)
- **Safety Tag Provisioning**: Provision initial Safety Tag for the rescued animal upon rescue completion.
- **Shelter Handover**: Transport rescued animal to shelter facility and initiate shelter admission handover.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard (`/rescue-agent-dashboard`) | Personal Workspace | View assigned cases, today's missions, and active dispatch status |
| Assigned Rescue Cases | View & Update | Access case location, reporter contact, instructions, and update field status |
| Safety Tag Provisioning | Provision Access | Provision initial Safety Tag for rescued animals |
| Notifications | System Utility | Real-time dispatch alerts and mission updates |
| Rescue Verification / Rejection | **BLOCKED** | Owned by Rescue Coordinator |
| Dispatch & Agent Assignment | **BLOCKED** | Owned by Rescue Coordinator |
| Kennel Allocation & Shelter Care | **BLOCKED** | Owned by Shelter Manager |
| System Settings & User Admin | **BLOCKED** | Reserved for Super Administrator |

---

## 3. Field Operation Workflow

```text
Dispatch Assigned by Rescue Coordinator
        ↓
Rescue Agent Receives Notification & Views Case Details
        ↓
Status Update: Start Dispatch / Mark En Route
        ↓
Agent Arrives at Field Location (Mark Arrived / Located)
        ↓
Field Rescue Executed (Mark Rescued / Completed)
        ↓
Provision Initial Safety Tag
        ↓
Transport Animal to Shelter Facility for Admission Handover
```
