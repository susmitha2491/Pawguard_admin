# PAWGUARD Admin Portal — Veterinarian Role Documentation

**Document:** `VETERINARIAN.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Veterinarian (`veterinarian`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Veterinarian Role

The **Veterinarian** (`veterinarian`) is responsible for clinical exams, medical diagnoses, treatments, vaccinations, surgeries, medical records, and issuing medical clearances (`Medically Cleared`).

### Primary Responsibilities

- **Clinical Examinations & Diagnosis**: Perform health exams on rescued and shelter animals.
- **Treatments & Medications**: Prescribe treatments, record medical notes, and log clinical interventions.
- **Medical Clearances**: Evaluate animal health fitness and issue official health clearance (`Medically Cleared` / `is_fit_for_adoption = true`).
- **Medical Records Management**: Create, view, and update comprehensive medical histories (`/medical-records`).
- **Partner Vet Network**: Collaborate with staff veterinarians and partner clinic networks.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard (`/veterinarian-dashboard`) | Medical Overview | Shelter medical requests, pending exams, and clearance Queue |
| Dog Master Profile (`/pets`) | View Access | Review animal profiles and medical history |
| Medical Records (`/medical-records`) | Full Access | Create/edit medical exams, treatments, vaccination records, and issue clearances |
| Veterinary Network | View Access | View partner clinic networks and staff veterinarians |
| Notifications | System Utility | Medical request alerts and clinical updates |
| User Admin, RBAC, Settings | **BLOCKED** | Reserved for Super Administrator |
| Finance, Inventory, Dispatch | **BLOCKED** | Reserved for respective domain roles |

---

## 3. Medical Clearance Workflow

```text
Shelter Manager / Rescue Team Requests Medical Exam
        ↓
Veterinarian Receives Request on Dashboard
        ↓
Conducts Clinical Examination & Records Diagnosis / Treatment
        ↓
Issues Health Clearance (Medically Cleared)
        ↓
Animal Marked Fit for Adoption / Foster Placement
```
