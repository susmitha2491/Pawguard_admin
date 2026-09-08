# QR Safety Tag System

## Purpose
The QR Safety Tag System provides digital pet identity tags and Pet Passports for animals within the PawGuard network. Each physical collar tag contains a unique QR code linked to the pet's digital passport, enabling instant public scanning, emergency contact access, and rapid owner reunification.

## Roles Involved
- Super Administrator
- Rescue Centre Admin
- Rescue Coordinator
- Shelter Manager
- Veterinarian
- Pet Owners / Public Finders

## Workflow
1. A unique digital safety tag token is provisioned for a rescue animal or registered pet.
2. The system generates a scannable QR code linked to the pet's public Pet Passport gateway.
3. The physical QR tag is attached to the animal's collar upon shelter admission, foster placement, or adoption.
4. If the animal strays, a public finder scans the QR code using any smartphone camera.
5. The finder views the Pet Passport displaying emergency contacts, medical alerts, and a secure contact button.
6. If a tag is lost or damaged, authorized staff can rotate the token and issue a replacement QR tag.

## Main Operations
- Provision new digital safety tags for shelter animals or adopted pets.
- Generate high-resolution QR code graphics for physical tag printing and collar attachment.
- Display digital Pet Passports showing pet name, photo, medical alerts, and owner emergency contacts.
- Reissue, rotate, or update active security tokens for existing tags.
- Revoke or deactivate lost, stolen, or expired safety tags.

## Status / Lifecycle
Safety tags transition through security lifecycle states:

Provisioned → Active → Tag Rotated → Deactivated

- **Provisioned**: Token created and QR code generated.
- **Active**: Attached to animal collar and resolving publicly upon scan.
- **Tag Rotated**: Security token updated; old QR tag invalidated and replacement issued.
- **Deactivated**: Tag permanently revoked or disabled.

## Role Handoffs
- **Shelter Manager / Rescue Centre Admin → Pet Owner**: Physical QR safety tag handed over upon adoption or reunification.
- **Public Finder → Pet Owner / Shelter Manager**: Smartphone scan initiates immediate emergency notification.

## Related Process
Integrates directly with **Dog Management** for pet profiles, **Lost & Found** for stray recovery, and **Adoption Management** for ownership tag transfers.
