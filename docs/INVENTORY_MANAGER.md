# PAWGUARD Admin Portal — Inventory Manager Role Documentation

**Document:** `INVENTORY_MANAGER.md`
**Portal:** PAWGUARD Admin Portal
**Role:** Inventory Manager (`inventory_manager`)
**Purpose:** Complete role, access, workflow, module, and dashboard reference

---

## 1. About the Inventory Manager Role

The **Inventory Manager** (`inventory_manager`) is responsible for managing shelter supplies, medical inventory, pharmacy stock, vendor relationships, purchase requisitions, and expiry monitoring.

### Primary Responsibilities

- **Inventory & Stock Management**: Maintain stock levels for food, bedding, rescue equipment, sanitation supplies, and general shelter goods.
- **Pharmacy & Medical Stock**: Track veterinary pharmaceuticals, vaccines, surgical supplies, and monitor medicine expiry dates.
- **Vendor & Supplier Management**: Maintain supplier directories, log purchase orders, and track deliveries.
- **Low Stock & Expiry Alerts**: Receive automatic low-stock notifications and manage stock reorder points.

---

## 2. Authorized Modules & Access Matrix

| Module | Access Level | Description |
|---|---|---|
| Dashboard (`/inventory-dashboard`) | Inventory Overview | Stock levels, low stock alerts, medicine expiry warnings, recent orders |
| Inventory & Pharmacy (`/inventory`) | Full Access | Manage items, stock categories, pharmacy inventory, vendors, and purchase requisitions |
| Notifications | System Utility | Stock alerts and reorder notifications |
| Staff & User Admin | **BLOCKED** | Reserved for Super Administrator |
| Rescue Verification & Dispatch | **BLOCKED** | Reserved for Rescue Coordinator |
| Kennel Allocation | **BLOCKED** | Reserved for Shelter Manager |
| Medical Examinations | **BLOCKED** | Reserved for Veterinarian |
