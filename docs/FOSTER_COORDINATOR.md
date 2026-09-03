# PAWGUARD Admin Portal — Foster Coordinator Role Documentation

**Document:** `FOSTER_COORDINATOR.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Foster Coordinator (`foster_coordinator`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Foster Coordinator Role

The **Foster Coordinator** (`foster_coordinator`) is the internal Admin Portal role responsible for managing foster family registrations, home vetting, foster placement applications, animal placements, and foster care monitoring.

### Distinction: Role vs Workflow Participant

- **Foster Coordinator**: The internal Admin Portal user/role responsible for administering foster care operations, evaluating applications, matching animals, and monitoring placements.
- **Foster Family / Foster Caregiver**: External workflow participants and approved temporary care homes that provide home environments for animals.

### Primary Responsibilities

- **Foster Family & Caregiver Management**: Register, vet, approve, and maintain profiles of external foster families, caregivers, and temporary care homes.
- **Foster Applications & Placements**: Process placement applications, match eligible animals with suitable foster homes, and manage foster agreements.
- **Foster Care Monitoring**: Conduct periodic check-ins, monitor placement durations, and log medical/care updates during foster stay.
- **Dog Master Profile Access**: Access profiles of animals assigned to or eligible for foster care.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard (`/foster-dashboard`) | Foster Overview | Active foster placements, pending foster applications, available foster homes |
| Dog Master Profile (`/pets`) | View Access | Review profiles of animals in or eligible for foster care |
| Foster Management (`/fosters`) | Full Access | Manage foster families, placement applications, active foster care, and returns |
| Notifications | System Utility | Placement alerts and check-in reminders |
| User Admin, RBAC, Settings | **BLOCKED** | Reserved for Super Administrator |
| Rescue Verification & Dispatch | **BLOCKED** | Operational owner: Rescue Coordinator |
| Kennel Allocation | **BLOCKED** | Operational owner: Shelter Manager |
