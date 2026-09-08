# Inventory Management

## Purpose
The Inventory Management module maintains centralized stock control across all PawGuard facilities. It manages pharmaceuticals, medical supplies, animal food, sanitation items, rescue gear, and shelter assets, ensuring adequate inventory and preventing supply shortages.

## Roles Involved
- Super Administrator
- Inventory Manager
- Shelter Manager
- Veterinarian

## Workflow
1. Inventory items are cataloged with categories, unit types, minimum stock thresholds, and warehouse storage locations.
2. Vendor deliveries are logged into central or facility stock registries.
3. Department teams (veterinary, shelter, rescue dispatch) submit supply requisitions.
4. The Inventory Manager verifies requisitions and issues items, automatically updating stock balances.
5. Stock levels are monitored continuously, triggering low-stock alerts when thresholds are reached.
6. Expiration dates and item batches are tracked to ensure proper stock rotation.

## Main Operations
- Add, edit, and categorize inventory stock items across warehouses and facility stores.
- Record stock receipts, stock transfers between locations, and usage deductions.
- Set minimum stock alerts and receive automated low-stock warnings.
- Monitor batch numbers, lot tracking, and expiration timelines.
- Process department supply requisitions and generate purchase orders.

## Status / Lifecycle
Inventory items maintain stock status indicators:

In Stock → Low Stock Warning → Reorder Required → Stock Replenished

- **In Stock**: Sufficient stock available.
- **Low Stock Warning**: Stock fell below defined minimum threshold.
- **Reorder Required**: Requisition submitted for vendor purchase.
- **Stock Replenished**: Delivery received and stock levels updated.

## Role Handoffs
- **Veterinarian / Shelter Manager → Inventory Manager**: Supply requisitions submitted for medicines, food, or operational gear.
- **Inventory Manager → Finance User**: Verified purchase orders and vendor invoices submitted for payment.

## Related Process
Connects with **Veterinary & Medical** for pharmaceutical supplies, **Shelter Management** for animal food and sanitation, and **Finance & Donations** for purchase accounting.
