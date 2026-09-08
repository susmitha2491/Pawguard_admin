# Vehicle Fleet Management

## Purpose
The Vehicle Fleet Management module oversees rescue ambulances, specialized animal transport vans, and operational vehicles within the PawGuard network. It manages vehicle registrations, equipment inventory checklists, maintenance schedules, and active dispatch availability.

## Roles Involved
- Super Administrator
- Rescue Centre Admin
- Rescue Coordinator
- Rescue Agent

## Workflow
1. Fleet vehicles are registered in the system with license numbers, vehicle models, capacity limits, and assigned rescue centres.
2. Vehicles are equipped with specialized rescue gear (pet carriers, stretchers, first aid kits, animal restraints, oxygen support).
3. Fleet administrators perform routine inspections and update vehicle operational status (Available, Assigned, Maintenance, Out of Service).
4. The Rescue Coordinator reviews available vehicles when dispatching emergency field rescue calls.
5. Assigned vehicles navigate to rescue scenes and return animals safely to shelter facilities.
6. Service dates, fuel logs, and equipment replenishment needs are recorded following dispatches.

## Main Operations
- Register, edit, and deactivate fleet vehicles assigned to rescue facilities.
- Track vehicle availability status (Available, Assigned, On Route, Maintenance, Out of Service).
- Manage onboard specialized rescue equipment checklists and carrier capacities.
- Log vehicle maintenance schedules, inspection dates, and insurance renewals.
- Monitor active vehicle dispatches and fuel utilization.

## Status / Lifecycle
Fleet vehicles maintain operational status states:

Available → Assigned → On Route → Maintenance → Out of Service

- **Available**: Inspected, fully equipped, and ready for emergency dispatch.
- **Assigned**: Allocated to an active rescue mission.
- **On Route**: Currently executing field transport.
- **Maintenance**: Under routine servicing or repair.
- **Out of Service**: Temporarily decommissioned.

## Role Handoffs
- **Rescue Centre Admin → Rescue Coordinator**: Fully equipped vehicles made available for dispatch selection.
- **Rescue Coordinator → Rescue Agent**: Vehicle assigned to field agent for emergency rescue transit.

## Related Process
Connects directly with **Rescue Management** for emergency dispatch allocation and **Reports & Analytics** for fleet utilization reporting.
