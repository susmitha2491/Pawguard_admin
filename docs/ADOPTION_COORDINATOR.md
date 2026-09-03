# PAWGUARD Admin Portal — Adoption Coordinator Role Documentation

**Document:** `ADOPTION_COORDINATOR.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Adoption Coordinator (`adoption_coordinator`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Adoption Coordinator Role

The **Adoption Coordinator** (`adoption_coordinator`) is responsible for managing the end-to-end adoption lifecycle for animals cleared for adoption.

### Primary Responsibilities

- **Adoption Application Management**: Review incoming adoption applications, verify applicant details, conduct background checks, and track application status.
- **Applicant Verification & Home Visits**: Schedule and record home visits, applicant interviews, and suitability assessments.
- **Adoption Approvals & Contracts**: Approve qualified adoption applications, generate adoption agreements, and log adoption fees.
- **Dog Master Profile Access**: View adoptable animal profiles (`is_adoptable = true` / `is_fit_for_adoption = true`).
- **Post-Adoption Follow-ups**: Conduct post-adoption wellness checkups and maintain adoption history.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard (`/adoption-dashboard`) | Adoption Overview | Application pipeline, pending reviews, approved adoptions, and follow-ups |
| Dog Master Profile (`/pets`) | View Access | Review adoptable animal profiles |
| Adoption Management (`/adoptions`) | Full Access | Review applications, verify applicants, approve adoptions, and manage contracts |
| Notifications | System Utility | Application alerts and follow-up reminders |
| Staff & User Admin | **BLOCKED** | Reserved for Super Administrator |
| Rescue Verification & Dispatch | **BLOCKED** | Reserved for Rescue Coordinator |
| Kennel Allocation | **BLOCKED** | Reserved for Shelter Manager |
| Medical Clearances | **BLOCKED** | Reserved for Veterinarian |
