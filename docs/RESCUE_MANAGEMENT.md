# Rescue Management

## Purpose
The Rescue Management module handles emergency incident intake, triage verification, agent dispatch, vehicle allocation, field tracking, and shelter admission. It provides real-time operational visibility across all active animal rescue calls within the PawGuard network.

## Roles Involved
- Super Administrator
- Rescue Centre Admin
- Rescue Coordinator
- Rescue Agent

## Workflow
1. A citizen or field reporter submits an emergency rescue report via public channels or phone intake.
2. The Rescue Coordinator logs the report, reviews incident details, physical condition notes, and location map pins.
3. The Rescue Coordinator verifies the report, assesses priority (Low, Medium, High, Critical) or urgency, and selects an available Rescue Agent and fleet vehicle.
4. The assigned Rescue Agent accepts the dispatch and marks status as En Route while traveling to the scene.
5. Upon arrival, the agent locates the animal, updates status to Located, safely secures the animal, and updates status to Secured.
6. The agent transports the animal to the designated shelter or veterinary clinic, completing the Shelter Admission stage.

## Main Operations
- Emergency call logging with reporter contact, location landmark, physical condition, and photos.
- Incident verification, priority editing, and case rejection/closure with rationale.
- Dispatch team assignment combining Rescue Coordinator, Rescue Agent, driver, vehicle, and specialized equipment.
- Real-time lifecycle tracking via progress steppers and GPS location maps.
- Search, filter, and sort rescue tickets by status, severity, or urgency.

## Status / Lifecycle
The rescue case follows a chronological lifecycle:

Reported → Verified → Dispatched → En Route → Located → Secured → Admitted

- **Reported**: Emergency incident intake logged into the system.
- **Verified**: Incident details reviewed and confirmed by Rescue Coordinator.
- **Dispatched**: Rescue Agent and vehicle assigned to the case.
- **En Route**: Rescue team traveling to the incident location.
- **Located**: Rescue Agent arrived on scene and located the distressed animal.
- **Secured**: Animal safely captured and secured in the rescue vehicle.
- **Admitted**: Animal safely delivered and admitted to the shelter facility.

## Role Handoffs
- **Public / Reporter → Rescue Coordinator**: Incident report received for verification.
- **Rescue Coordinator → Rescue Agent**: Verified case dispatched to field agent for execution.
- **Rescue Agent → Shelter Manager / Veterinarian**: Secured animal delivered to shelter staff for intake and medical evaluation.

## Related Process
After shelter admission, the animal transitions to the **Dog Management**, **Shelter Management**, and **Veterinary & Medical** modules for intake processing, kennel assignment, and medical evaluation.
