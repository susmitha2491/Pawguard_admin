# Shelter Management

## Purpose
The Shelter Management module oversees physical shelter facilities, section layouts, ward assignments, kennel capacity, and daily resident housing across all PawGuard shelter locations.

## Roles Involved
- Super Administrator
- Rescue Centre Admin
- Shelter Manager
- Veterinarian
- Inventory Manager

## Workflow
1. Shelter administrators configure shelter facilities, physical addresses, contact info, and total housing capacity.
2. Facility sections (General Ward, Medical Isolation, Puppy Suite, Quarantine, Quarantine Recovery) and individual kennels are defined.
3. Incoming animals are assigned to available kennels based on physical condition, age, and behavioral compatibility.
4. Shelter staff perform daily feedings, health checks, and kennel sanitation, logging updates in the system.
5. Animals transition between wards (e.g., from Medical Isolation to General Ward) as health improves.
6. Upon adoption or foster placement, kennels are cleared and prepared for new intakes.

## Main Operations
- Manage facility profiles, operational rules, ward layouts, and capacity limits.
- Assign and reassign animals to specific kennels and wards.
- Track kennel sanitation states (Clean, Needs Cleaning, Disinfected).
- Monitor real-time facility occupancy statistics and available housing capacity.
- Manage shelter staff duty assignments and facility maintenance logs.

## Status / Lifecycle
Kennels and facility sections maintain operational statuses:

Available → Occupied → Cleaning Required → Disinfected

- **Available**: Ready for animal assignment.
- **Occupied**: Currently housing a resident animal.
- **Cleaning Required**: Animal moved or daily cleaning due.
- **Disinfected**: Sanitized and ready for immediate reassignment.

## Role Handoffs
- **Rescue Agent → Shelter Manager**: Animal delivered to shelter for kennel assignment.
- **Shelter Manager → Veterinarian**: Animal placed in medical isolation ward for clinical observation.
- **Shelter Manager → Adoption Coordinator**: Animal housing status updated upon adoption checkout.

## Related Process
Integrates with **Dog Management** for individual pet tracking, **Veterinary & Medical** for isolation placement, and **Inventory Management** for food and sanitation supply allocation.
