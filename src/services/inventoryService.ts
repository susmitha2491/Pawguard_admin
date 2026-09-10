import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export type ItemCategory = "pharmaceutical" | "vaccine" | "food" | "consumable" | "gear" | "office";
export type MovementType = "check_in" | "check_out" | "consumption" | "adjustment";
export type RequisitionStatus = "pending" | "approved" | "rejected" | "received";

export interface InventoryItemCreatePayload {
  name?: string;
  itemName?: string;
  category: ItemCategory | string;
  quantity?: number;
  stock?: number | string;
  unit?: string;
  reorder_threshold?: number;
  threshold?: number | string;
  expiry_date?: string | null;
  unit_cost?: number;
}

export interface InventoryItemUpdatePayload {
  name?: string | null;
  category?: ItemCategory | null;
  quantity?: number | null;
  unit?: string | null;
  reorder_threshold?: number | null;
  expiry_date?: string | null;
  unit_cost?: number | null;
}

export interface InventoryMovementCreatePayload {
  item_id: string;
  movement_type: MovementType;
  quantity: number;
  notes?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

export interface RequisitionOrderCreatePayload {
  item_id: string;
  quantity: number;
}

export interface SupplierPayload {
  id?: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  bank_details?: string | null;
  payment_terms?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface InventoryFilters {
  search?: string;
  category?: ItemCategory;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

/** Map frontend category labels to the official ItemCategory enum. */
export const toItemCategory = (category?: string): ItemCategory => {
  const c = String(category || "").toLowerCase();
  if (c.includes("vaccin")) return "vaccine";
  if (c.includes("medic") || c.includes("drug") || c.includes("pharma")) return "pharmaceutical";
  if (c.includes("food") || c.includes("kibble") || c.includes("nutrition")) return "food";
  if (c.includes("surgical") || c.includes("tool") || c.includes("gear") || c.includes("equipment")) return "gear";
  if (c.includes("office")) return "office";
  return "consumable";
};

/** Map official ItemCategory enum back to a friendly display label. */
export const fromItemCategory = (category?: string): string => {
  const c = String(category || "").toLowerCase();
  const map: Record<string, string> = {
    pharmaceutical: "Pharmaceuticals",
    vaccine: "Vaccines",
    food: "Food & Nutrition",
    consumable: "Consumables",
    gear: "Gear & Equipment",
    office: "Office Supplies",
  };
  return map[c] || c;
};

/** Normalize raw InventoryItemResponse row to standard page format. */
export const normalizeInventoryRow = (item: any): any => {
  const quantity = Number(item.quantity ?? 0);
  const threshold = Number(item.reorder_threshold ?? 0);
  return {
    id: item.id,
    sku: item.id,
    itemName: item.name,
    category: fromItemCategory(item.category),
    rawCategory: item.category as ItemCategory,
    stock: `${quantity} ${item.unit || "units"}`,
    threshold: `${threshold} ${item.unit || "units"}`,
    status: threshold > 0 && quantity <= threshold ? "Low Stock" : "In Stock",
    supplier: item.supplier || item.supplier_name || item.vendor || "—",
    quantity,
    unit: item.unit || "units",
    reorder_threshold: threshold,
    expiry_date: item.expiry_date,
    unit_cost: Number(item.unit_cost || 0),
    raw: item,
  };
};

export const inventoryService = {
  // GET /dashboards/inventory
  getInventoryDashboard: async () => {
    const response = await api.get("/dashboards/inventory");
    return response.data;
  },

  // GET /admin/dashboard/inventory-alerts
  getInventoryAlerts: async () => {
    const response = await api.get("/admin/dashboard/inventory-alerts");
    return response.data?.data ?? response.data;
  },

  // GET /inventory/items - List inventory (paginated)
  getInventory: async (params?: InventoryFilters) => {
    const response = await api.get("/inventory/items", { params });
    const body = response.data;
    const raw = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
    const rows = Array.isArray(raw) ? raw.map(normalizeInventoryRow) : [];
    return { ...body, data: rows, total: body?.meta?.total ?? body?.total ?? rows.length };
  },

  // GET /inventory/items/{item_id}
  getItemById: async (itemId: string) => {
    const response = await api.get(`/inventory/items/${itemId}`);
    return normalizeInventoryRow(response.data?.data ?? response.data);
  },

  // POST /inventory/items (InventoryItemCreate)
  createInventoryItem: async (data: InventoryItemCreatePayload) => {
    const itemName = data.name || data.itemName || "Item";
    const quantity = Number(data.quantity !== undefined ? data.quantity : data.stock || 0);
    const threshold = Number(data.reorder_threshold !== undefined ? data.reorder_threshold : data.threshold || 10);
    const response = await api.post("/inventory/items", {
      name: itemName,
      category: toItemCategory(String(data.category)),
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: data.unit || "units",
      reorder_threshold: Number.isFinite(threshold) ? threshold : 10,
      expiry_date: data.expiry_date || null,
      unit_cost: Number(data.unit_cost || 0),
    });
    await publishActionEvent({
      module: "inventory",
      action: "create",
      title: "New Inventory Item Cataloged",
      message: `Item ${itemName} added to stock catalog.`,
      targetRoles: ["super_admin", "inventory_manager", "shelter_manager", "rescue_centre_admin"],
    });
    return response.data;
  },

  // PUT /inventory/items/{item_id} (InventoryItemUpdate)
  updateInventoryItem: async (itemId: string, data: InventoryItemUpdatePayload) => {
    const response = await api.put(`/inventory/items/${itemId}`, data);
    await publishActionEvent({
      module: "inventory",
      action: "update",
      title: "Inventory Item Updated",
      message: `Item ${itemId} updated.`,
      targetRoles: ["super_admin", "inventory_manager", "shelter_manager"],
    });
    return response.data;
  },

  // DELETE /inventory/items/{item_id}
  deleteInventoryItem: async (itemId: string) => {
    const response = await api.delete(`/inventory/items/${itemId}`);
    await publishActionEvent({
      module: "inventory",
      action: "delete",
      title: "Inventory Item Removed",
      message: `Item ${itemId} deleted.`,
      targetRoles: ["super_admin", "inventory_manager"],
    });
    return response.data;
  },

  // POST /inventory/items/bulk/delete
  bulkDeleteItems: async (itemIds: string[]) => {
    const response = await api.post("/inventory/items/bulk/delete", {
      ids: itemIds,
      item_ids: itemIds,
    });
    return response.data;
  },

  // POST /inventory/movements (InventoryMovementCreate)
  recordMovement: async (payload: InventoryMovementCreatePayload) => {
    const response = await api.post("/inventory/movements", payload);
    await publishActionEvent({
      module: "inventory",
      action: "update",
      title: "Stock Movement Recorded",
      message: `Recorded ${payload.quantity} units movement (${payload.movement_type}) for item ${payload.item_id}.`,
      targetRoles: ["super_admin", "inventory_manager", "shelter_manager", "veterinarian"],
    });
    return response.data;
  },

  // Backwards-compatible alias for issuing stock
  issueStockItem: async (itemId: string, quantity: number, movement_type: MovementType = "consumption", notes?: string) => {
    return inventoryService.recordMovement({
      item_id: itemId,
      movement_type,
      quantity: Number(quantity),
      notes: notes || "Stock issued",
    });
  },

  // GET /inventory/items/{item_id}/movements
  getItemMovements: async (itemId: string, params?: { movement_type?: MovementType; page?: number; page_size?: number }) => {
    const response = await api.get(`/inventory/items/${itemId}/movements`, { params });
    return response.data;
  },

  // POST /inventory/requisitions (RequisitionOrderCreate)
  createPurchaseOrder: async (data: RequisitionOrderCreatePayload) => {
    const response = await api.post("/inventory/requisitions", {
      item_id: data.item_id,
      quantity: Number(data.quantity),
    });
    await publishActionEvent({
      module: "inventory",
      action: "create",
      title: "Purchase Requisition Issued",
      message: `Requisition order generated for item ${data.item_id} (qty ${data.quantity}).`,
      targetRoles: ["super_admin", "inventory_manager", "finance_user"],
    });
    return response.data;
  },

  // GET /inventory/requisitions
  getRequisitions: async (params?: { status?: RequisitionStatus; page?: number; page_size?: number }) => {
    const response = await api.get("/inventory/requisitions", { params });
    return response.data;
  },

  // PUT /inventory/requisitions/{req_id}/status (RequisitionStatusUpdate)
  updateRequisitionStatus: async (requisitionId: string, status: RequisitionStatus) => {
    const response = await api.put(`/inventory/requisitions/${requisitionId}/status`, { status });
    await publishActionEvent({
      module: "inventory",
      action: "update",
      title: `Requisition ${status.toUpperCase()}`,
      message: `Requisition ${requisitionId} status set to ${status}.`,
      targetRoles: ["super_admin", "inventory_manager", "finance_user", "shelter_manager"],
    });
    return response.data;
  },

  // Dedicated workflow helper methods calling actual backend contract
  approveRequisition: async (requisitionId: string) => {
    return inventoryService.updateRequisitionStatus(requisitionId, "approved");
  },

  rejectRequisition: async (requisitionId: string) => {
    return inventoryService.updateRequisitionStatus(requisitionId, "rejected");
  },

  receiveRequisition: async (requisitionId: string) => {
    return inventoryService.updateRequisitionStatus(requisitionId, "received");
  },

  // POST /inventory/requisitions/bulk/status
  bulkUpdateRequisitions: async (requisitionIds: string[], status: RequisitionStatus) => {
    const response = await api.post("/inventory/requisitions/bulk/status", {
      ids: requisitionIds,
      requisition_ids: requisitionIds,
      status,
    });
    return response.data;
  },

  // Supplier Management APIs
  // GET /inventory/suppliers
  getSuppliers: async (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const response = await api.get("/inventory/suppliers", { params });
    const body = response.data;
    const raw = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
    return { ...body, data: raw };
  },

  // GET /inventory/suppliers/{id}
  getSupplierById: async (supplierId: string) => {
    const response = await api.get(`/inventory/suppliers/${supplierId}`);
    return response.data?.data ?? response.data;
  },

  // POST /inventory/suppliers (SupplierCreate)
  createSupplier: async (data: SupplierPayload) => {
    const response = await api.post("/inventory/suppliers", data);
    await publishActionEvent({
      module: "inventory",
      action: "create",
      title: "Supplier Registered",
      message: `Supplier ${data.name} registered.`,
      targetRoles: ["super_admin", "inventory_manager"],
    });
    return response.data;
  },

  // PUT /inventory/suppliers/{id} (SupplierUpdate)
  updateSupplier: async (supplierId: string, data: SupplierPayload) => {
    const response = await api.put(`/inventory/suppliers/${supplierId}`, data);
    await publishActionEvent({
      module: "inventory",
      action: "update",
      title: "Supplier Details Updated",
      message: `Supplier ${supplierId} updated.`,
      targetRoles: ["super_admin", "inventory_manager"],
    });
    return response.data;
  },

  // DELETE /inventory/suppliers/{id}
  deleteSupplier: async (supplierId: string) => {
    const response = await api.delete(`/inventory/suppliers/${supplierId}`);
    return response.data;
  },
};

export default inventoryService;
