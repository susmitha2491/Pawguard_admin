# PAWGUARD Admin Portal — Shelter Manager Role Documentation

**Document:** `SHELTER_MANAGER.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Shelter Manager (`shelter_manager`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Shelter Manager Role

The **Shelter Manager** (`shelter_manager`) is responsible for managing day-to-day operations of an assigned shelter facility (`userShelterId`).

The role focuses on admitting rescued animals, kennel allocation, kennel reassignment and release, managing shelter capacity, updating kennel sanitation state (`Mark Clean`), and overseeing daily shelter animal care.

### Primary Responsibilities

- **Shelter Animal Admission**: Process intake and admission for rescued animals arriving from field operations.
- **Kennel Allocation & Management**: Assign admitted animals to available kennels (`KennelAssignmentModal`), reassign kennels, and release kennels upon adoption/foster transfer.
- **Capacity & Occupancy Tracking**: Monitor section architecture (quarantine, isolation, surgical, puppy, general, adoption) and facility capacity.
- **Sanitation State Maintenance**: Update kennel sanitation state (`Mark Clean`) and manage daily shelter operations.
- **Dog Master Profile Management**: Maintain shelter dog profiles, companion pet registry within shelter care, photo records, and intake details.
- **Authorized Safety Tag Operations**: View Safety Tag status, provision tags, generate QR codes, reissue/rotate tags, and revoke tags for shelter animals.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard | Operational Overview | Shelter capacity, occupied kennels, pending intakes, and medical check requests |
| Dog Master Profile (`/pets`) | Full Access | Manage shelter dog master records, companion pets, and Safety Tags |
| Shelter Management (`/shelters`, `/shelter-dogs`) | Full Shelter Access | Admit animals, assign/reassign kennels, manage sections, and update sanitation state |
| Medical Requests | Request Access | Request veterinary checkups for shelter animals |
| Notifications | System Utility | Shelter operational alerts and admission notifications |
| Staff & Users / User Management | **BLOCKED** | Reserved for Super Administrator |
| System Settings & Audit Logs | **BLOCKED** | Reserved for Super Administrator |
| Finance, Inventory, Adoptions | **BLOCKED** | Reserved for respective domain roles |

---

## 3. Shelter Admission & Kennel Workflow

```text
Rescued Animal Arrives at Shelter Facility
        ↓
Shelter Manager Processes Animal Admission
        ↓
Create / Update Dog Master Profile
        ↓
Assign Kennel Unit via KennelAssignmentModal
        ↓
Track Occupancy, Sanitation (Mark Clean), and Daily Care
        ↓
Request Veterinary Health Exam (Assigned to Veterinarian)
        ↓
Medically Cleared → Transition to Adoption / Foster Pipeline
```
