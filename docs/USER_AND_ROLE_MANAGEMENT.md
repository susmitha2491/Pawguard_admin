# User & Role Management

## Purpose
The User & Role Management module governs organization staff accounts, user access credentials, role definitions, and permission configurations across the PawGuard Admin Portal. It provides Role-Based Access Control (RBAC) to ensure staff members access only the features relevant to their operational roles.

## Roles Involved
- Super Administrator
- Rescue Centre Admin (view-only staff rosters)
- Shelter Manager (view-only shelter staff)

## Workflow
1. Super Administrators register new staff accounts, defining user profile details, email addresses, and assigned facility centres.
2. An operational role (e.g., Rescue Coordinator, Veterinarian, Shelter Manager) is assigned to the user profile.
3. Granular permission overrides are configured if specific operational access must be granted or restricted.
4. Users log into the portal and receive customized navigation menus and operational dashboards tailored to their role.
5. Account updates, role transfers, or account deactivations are managed centrally as staffing requirements evolve.

## Main Operations
- Register, edit, activate, deactivate, or delete staff user accounts.
- Assign operational roles (Super Admin, Rescue Centre Admin, Rescue Coordinator, Rescue Agent, Veterinarian, Shelter Manager, Adoption Coordinator, Foster Coordinator, Volunteer Coordinator, Inventory Manager, Finance User).
- Configure permissions catalogs and manage role-based menu visibility.
- Assign staff members to specific rescue centres or shelter facilities.
- Audit active user logins and session security.

## Status / Lifecycle
User accounts maintain account lifecycle states:

Invited → Active Account → Suspended / Deactivated

- **Invited**: Credentials issued for staff onboarding.
- **Active Account**: Authorized and actively accessing the portal.
- **Suspended / Deactivated**: Access temporarily or permanently revoked.

## Role Handoffs
- **Super Administrator → Staff Member**: Provisioned account credentials delivered for operational portal access.

## Related Process
Connects with **Audit Logs** for user security tracking and all system modules for permission enforcement.
