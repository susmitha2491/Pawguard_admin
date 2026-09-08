import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaBoxes,
  FaPills,
  FaTruck,
  FaExclamationTriangle,
  FaPlusCircle,
  FaTrash,
  FaClipboardList,
  FaEdit,
  FaMinusCircle,
  FaHistory,
} from "react-icons/fa";
import inventoryService, {
  type ItemCategory,
  type MovementType,
  type RequisitionStatus,
  type SupplierPayload,
} from "../../services/inventoryService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";

export interface InventoryRow {
  id: string;
  sku: string;
  itemName: string;
  category: string;
  rawCategory: ItemCategory;
  stock: string;
  threshold: string;
  status: string;
  supplier: string;
  quantity: number;
  unit: string;
  reorder_threshold: number;
  expiry_date?: string | null;
  unit_cost: number;
  [key: string]: unknown;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
};

const CategoryBadge = ({ category }: { category: string }) => {
  return (
    <span
      style={{
        backgroundColor: "#F1F5F9",
        color: "#334155",
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        display: "inline-block",
      }}
    >
      {category}
    </span>
  );
};

const StockStatusBadge = ({ status }: { status: string }) => {
  const isLow = status === "Low Stock";
  return (
    <span
      style={{
        backgroundColor: isLow ? "#FEE2E2" : "#ECFDF5",
        color: isLow ? "#B91C1C" : "#047857",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 800,
        display: "inline-block",
      }}
    >
      {isLow ? "LOW STOCK" : "IN STOCK"}
    </span>
  );
};

const emptyItemForm = {
  name: "",
  category: "" as ItemCategory,
  quantity: "" as unknown as number,
  unit: "",
  reorder_threshold: "" as unknown as number,
  unit_cost: "" as unknown as number,
  expiry_date: "",
};

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Search & Pagination & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(() => searchParams.get("action") === "add");
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isReqListModalOpen, setIsReqListModalOpen] = useState(false);
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);

  // Forms state
  const [itemForm, setItemForm] = useState(emptyItemForm);

  const openAddItemModal = () => {
    setItemForm(emptyItemForm);
    setIsAddItemModalOpen(true);
  };

  const closeAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setItemForm(emptyItemForm);
  };

  const [editItemForm, setEditItemForm] = useState({
    id: "",
    name: "",
    category: "" as ItemCategory,
    quantity: 0,
    unit: "",
    reorder_threshold: 0,
    unit_cost: 0,
    expiry_date: "",
  });

  const [poForm, setPoForm] = useState({
    item_id: "",
    quantity: 100,
  });

  const [movementForm, setMovementForm] = useState({
    item_id: "",
    quantity: 10,
    movement_type: "consumption" as MovementType,
    notes: "Routine medical round stock issuance",
  });

  const [supplierForm, setSupplierForm] = useState<SupplierPayload>({
    id: "",
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [invRes, reqRes, supRes] = await Promise.allSettled([
        inventoryService.getInventory(),
        inventoryService.getRequisitions(),
        inventoryService.getSuppliers(),
      ]);

      if (invRes.status === "fulfilled") {
        setInventory(invRes.value?.data || []);
      }
      if (reqRes.status === "fulfilled") {
        const raw = Array.isArray(reqRes.value) ? reqRes.value : reqRes.value?.data ?? [];
        setRequisitions(raw);
      }
      if (supRes.status === "fulfilled") {
        const raw = Array.isArray(supRes.value) ? supRes.value : supRes.value?.data ?? [];
        setSuppliers(raw);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load inventory dataset.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Derived filtered items
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.rawCategory === categoryFilter;
      const matchesStock =
        stockStatusFilter === "all" ||
        (stockStatusFilter === "low_stock" && item.status === "Low Stock") ||
        (stockStatusFilter === "in_stock" && item.status === "In Stock");

      if (!matchesCategory || !matchesStock) return false;

      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      const searchable = [item.id, item.itemName, item.category, item.supplier].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [inventory, categoryFilter, stockStatusFilter, debouncedSearch]);

  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, page]);

  // Derived metrics
  const totalItemsCount = inventory.length;
  const lowStockCount = inventory.filter((i) => i.status === "Low Stock").length;
  const totalStockValue = inventory.reduce((sum, i) => sum + i.quantity * (i.unit_cost || 0), 0);
  const pendingReqsCount = requisitions.filter((r) => r.status === "pending").length;

  const stats = [
    { title: "Catalog Items", value: `${totalItemsCount}`, trend: "Products", color: "#2563EB", icon: <FaBoxes /> },
    { title: "Low Stock Alerts", value: `${lowStockCount}`, trend: "Requires Restock", color: "#EF4444", icon: <FaExclamationTriangle /> },
    { title: "Total Inventory Value", value: `₹${totalStockValue.toFixed(2)}`, trend: "Asset Valuation", color: "#10B981", icon: <FaPills /> },
    { title: "Pending Requisitions", value: `${pendingReqsCount}`, trend: "Purchase Orders", color: "#F59E0B", icon: <FaClipboardList /> },
  ];

  // Action Handlers
  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await inventoryService.createInventoryItem({
        ...itemForm,
        quantity: Number(itemForm.quantity || 0),
        reorder_threshold: Number(itemForm.reorder_threshold || 0),
        unit_cost: Number(itemForm.unit_cost || 0),
      });
      addToast("Cataloged new inventory item!", "success");
      closeAddItemModal();
      fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to create inventory item.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItemForm.id) return;
    try {
      setIsSubmitting(true);
      await inventoryService.updateInventoryItem(editItemForm.id, editItemForm);
      addToast("Inventory item updated successfully!", "success");
      setIsEditModalOpen(false);
      fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to update item.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.item_id) {
      addToast("Select an inventory item to record movement.", "error");
      return;
    }

    const targetItem = inventory.find((i) => i.id === movementForm.item_id);
    if (
      targetItem &&
      ["consumption", "check_out"].includes(movementForm.movement_type) &&
      movementForm.quantity > targetItem.quantity
    ) {
      addToast(
        `Cannot issue stock: Requested quantity (${movementForm.quantity} ${targetItem.unit}) exceeds current available stock (${targetItem.quantity} ${targetItem.unit}).`,
        "error"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await inventoryService.recordMovement(movementForm);

      if (targetItem && ["consumption", "check_out"].includes(movementForm.movement_type)) {
        const remaining = targetItem.quantity - movementForm.quantity;
        if (targetItem.reorder_threshold > 0 && remaining <= targetItem.reorder_threshold) {
          addToast(`⚠️ Low Stock Alert: Remaining balance for ${targetItem.itemName} is ${remaining} ${targetItem.unit}.`, "info");
        }
      }

      addToast("Stock movement logged successfully!", "success");
      setIsIssueModalOpen(false);
      fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to log movement.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.item_id) {
      addToast("Select an inventory item for requisition.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await inventoryService.createPurchaseOrder(poForm);
      addToast("Purchase requisition order generated!", "success");
      setIsPoModalOpen(false);
      fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to issue requisition.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequisitionStatus = async (reqId: string, status: RequisitionStatus) => {
    try {
      setIsSubmitting(true);
      if (status === "approved") {
        await inventoryService.approveRequisition(reqId);
      } else if (status === "rejected") {
        await inventoryService.rejectRequisition(reqId);
      } else if (status === "received") {
        await inventoryService.receiveRequisition(reqId);
      } else {
        await inventoryService.updateRequisitionStatus(reqId, status);
      }

      if (status === "received") {
        const targetReq = requisitions.find((r) => String(r.id) === String(reqId));
        if (targetReq && targetReq.item_id && targetReq.quantity) {
          await inventoryService.recordMovement({
            item_id: targetReq.item_id,
            movement_type: "check_in",
            quantity: Number(targetReq.quantity),
            notes: `Stock restocked from fulfilled requisition PO #${String(reqId).slice(0, 8)}`,
          }).catch(() => null);
        }
      }

      addToast(`Requisition status set to ${status.toUpperCase()} successfully!`, "success");
      await fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        (err?.response?.status === 404
          ? "Requisition not found in backend database."
          : err?.response?.status === 403
          ? "Permission denied. You do not have authorization to update requisitions."
          : err?.message || "Failed to update requisition status.");
      addToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (supplierForm.id) {
        await inventoryService.updateSupplier(supplierForm.id, supplierForm);
        addToast("Supplier profile updated!", "success");
      } else {
        await inventoryService.createSupplier(supplierForm);
        addToast("Registered new supplier!", "success");
      }
      setIsSupplierModalOpen(false);
      fetchInventoryData();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to save supplier.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to remove this item from the inventory catalog?")) return;
    try {
      setIsSubmitting(true);
      await inventoryService.deleteInventoryItem(itemId);
      addToast("Inventory item deleted.", "success");
      fetchInventoryData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to delete item.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchMovements = async (item: InventoryRow) => {
    setSelectedItem(item);
    try {
      setMovements([]);
      setIsMovementsModalOpen(true);
      const res = await inventoryService.getItemMovements(item.id);
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setMovements(list);
    } catch {
      setMovements([]);
    }
  };

  const columns: Column<InventoryRow>[] = [
    {
      key: "id",
      title: "Item ID",
      render: (_v, row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{row.id.slice(0, 8)}</span>,
    },
    {
      key: "itemName",
      title: "Item Name",
      render: (_v, row) => (
        <div>
          <strong style={{ color: "#0F172A" }}>{row.itemName}</strong>
          {row.expiry_date && <div style={{ fontSize: "11px", color: "#64748B" }}>Expires: {row.expiry_date}</div>}
        </div>
      ),
    },
    {
      key: "category",
      title: "Category",
      render: (_v, row) => <CategoryBadge category={row.category} />,
    },
    {
      key: "stock",
      title: "Quantity in Stock",
      render: (_v, row) => <strong>{row.stock}</strong>,
    },
    {
      key: "status",
      title: "Stock Status",
      render: (_v, row) => <StockStatusBadge status={row.status} />,
    },
    {
      key: "unit_cost",
      title: "Unit Cost",
      render: (_v, row) => <span>₹{row.unit_cost.toFixed(2)}</span>,
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Inventory &amp; Supplies Management</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Monitor stock levels, log pharmaceutical &amp; food consumption movements, issue purchase requisitions, and manage vendors.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="manage_inventory">
          <QuickActionCard icon={<FaPlusCircle />} title="Catalog Item" subtitle="New stock entry" color="#2563EB" onClick={openAddItemModal} />
        </Can>
        <Can permission="manage_inventory">
          <QuickActionCard icon={<FaMinusCircle />} title="Record Movement" subtitle="Dispense / Issue" color="#10B981" onClick={() => setIsIssueModalOpen(true)} />
        </Can>
        <Can permission="manage_inventory">
          <QuickActionCard icon={<FaClipboardList />} title="Issue Requisition" subtitle="Order restock" color="#F59E0B" onClick={() => setIsPoModalOpen(true)} />
        </Can>
        <Can permission="manage_inventory">
          <QuickActionCard icon={<FaTruck />} title="Supplier Directory" subtitle="Vendor profiles" color="#6366F1" onClick={() => setIsSupplierModalOpen(true)} />
        </Can>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Main Inventory Card */}
      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Stock Catalog &amp; Supplies Directory
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>Loading...</span>}
        </div>

        <DataTable
          columns={columns}
          data={paginatedInventory}
          module="inventory"
          serverMode={true}
          totalCount={filteredInventory.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          searchValue={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          leftHeaderControls={
            <>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="all">All Categories</option>
                <option value="pharmaceutical">Pharmaceuticals</option>
                <option value="vaccine">Vaccines</option>
                <option value="food">Food &amp; Nutrition</option>
                <option value="consumable">Consumables</option>
                <option value="gear">Gear &amp; Equipment</option>
                <option value="office">Office Supplies</option>
              </select>
              <select
                value={stockStatusFilter}
                onChange={(e) => {
                  setStockStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="all">All Stock Statuses</option>
                <option value="low_stock">Low Stock Alerts</option>
                <option value="in_stock">In Stock</option>
              </select>
              <button
                onClick={() => setIsReqListModalOpen(true)}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FaClipboardList color="#F59E0B" /> Requisitions ({requisitions.length})
              </button>
            </>
          }
          onRowClick={(row: InventoryRow) => void handleFetchMovements(row)}
          renderRowActions={(row: InventoryRow) => (
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button
                onClick={() => void handleFetchMovements(row)}
                title="Stock Movement Log"
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <FaHistory /> Audit
              </button>
              <Can permission="manage_inventory">
                <button
                  onClick={() => {
                    setSelectedItem(row);
                    setEditItemForm({
                      id: row.id,
                      name: row.itemName,
                      category: row.rawCategory,
                      quantity: row.quantity,
                      unit: row.unit,
                      reorder_threshold: row.reorder_threshold,
                      unit_cost: row.unit_cost,
                      expiry_date: row.expiry_date || "",
                    });
                    setIsEditModalOpen(true);
                  }}
                  title="Edit Item"
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontSize: "12px", cursor: "pointer" }}
                >
                  <FaEdit /> Edit
                </button>
              </Can>
              <Can permission="manage_inventory">
                <button
                  onClick={() => void handleDeleteItem(row.id)}
                  title="Delete Item"
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", cursor: "pointer" }}
                >
                  <FaTrash />
                </button>
              </Can>
            </div>
          )}
        />
      </div>

      {/* Catalog New Item Modal */}
      <Modal isOpen={isAddItemModalOpen} onClose={closeAddItemModal} title="Catalog New Inventory Item">
        <form onSubmit={handleAddItemSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Item Name *</label>
            <input type="text" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Category *</label>
              <select required value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as ItemCategory })} style={inputStyle}>
                <option value="">Select Category *</option>
                <option value="pharmaceutical">Pharmaceuticals</option>
                <option value="vaccine">Vaccines</option>
                <option value="food">Food &amp; Nutrition</option>
                <option value="consumable">Consumables</option>
                <option value="gear">Gear &amp; Equipment</option>
                <option value="office">Office Supplies</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Unit Type *</label>
              <input type="text" placeholder="e.g. vials, kg, boxes" required value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Initial Quantity *</label>
              <input type="number" min="0" required value={itemForm.quantity ?? ""} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Reorder Threshold *</label>
              <input type="number" min="0" required value={itemForm.reorder_threshold ?? ""} onChange={(e) => setItemForm({ ...itemForm, reorder_threshold: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Unit Cost (₹) *</label>
              <input type="number" min="0" step="0.01" required value={itemForm.unit_cost ?? ""} onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Expiry Date (Optional)</label>
            <input type="date" value={itemForm.expiry_date} onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={closeAddItemModal} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Catalog Item"}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Inventory Item">
        <form onSubmit={handleEditItemSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Item Name</label>
            <input type="text" value={editItemForm.name} onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Category</label>
              <select value={editItemForm.category} onChange={(e) => setEditItemForm({ ...editItemForm, category: e.target.value as ItemCategory })} style={inputStyle}>
                <option value="pharmaceutical">Pharmaceuticals</option>
                <option value="vaccine">Vaccines</option>
                <option value="food">Food &amp; Nutrition</option>
                <option value="consumable">Consumables</option>
                <option value="gear">Gear &amp; Equipment</option>
                <option value="office">Office Supplies</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Quantity</label>
              <input type="number" min="0" value={editItemForm.quantity} onChange={(e) => setEditItemForm({ ...editItemForm, quantity: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Updating..." : "Save Changes"}</button>
          </div>
        </form>
      </Modal>

      {/* Record Stock Movement Modal */}
      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title="Record Stock Movement / Dispense">
        <form onSubmit={handleMovementSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Select Item *</label>
            <select required value={movementForm.item_id} onChange={(e) => setMovementForm({ ...movementForm, item_id: e.target.value })} style={inputStyle}>
              <option value="">Choose item...</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>{item.itemName} ({item.stock})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Movement Type *</label>
              <select value={movementForm.movement_type} onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value as MovementType })} style={inputStyle}>
                <option value="consumption">Medical Consumption</option>
                <option value="check_out">Check Out / Dispense</option>
                <option value="check_in">Check In / Restock</option>
                <option value="adjustment">Stock Adjustment</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Quantity *</label>
              <input type="number" min="1" required value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Reference</label>
            <textarea value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsIssueModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Logging..." : "Log Movement"}</button>
          </div>
        </form>
      </Modal>

      {/* Requisition Order Modal */}
      <Modal isOpen={isPoModalOpen} onClose={() => setIsPoModalOpen(false)} title="Issue Purchase Requisition Order">
        <form onSubmit={handlePoSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Item to Reorder *</label>
            <select required value={poForm.item_id} onChange={(e) => setPoForm({ ...poForm, item_id: e.target.value })} style={inputStyle}>
              <option value="">Select inventory item...</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>{item.itemName} (Current Stock: {item.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Requisition Quantity *</label>
            <input type="number" min="1" required value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsPoModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#F59E0B", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Issuing..." : "Issue Requisition"}</button>
          </div>
        </form>
      </Modal>

      {/* Requisition List Drawer Modal */}
      <Modal isOpen={isReqListModalOpen} onClose={() => setIsReqListModalOpen(false)} title="Purchase Requisitions Roster">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto" }}>
          {requisitions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748B" }}>No requisitions logged yet.</div>
          ) : (
            requisitions.map((req) => {
              const matchedItem = inventory.find((inv) => String(inv.id) === String(req.item_id));
              const itemName = matchedItem?.itemName || "Inventory Item";
              const unit = matchedItem?.unit || "units";
              const supplier = matchedItem?.supplier || "—";
              const status = String(req.status || "pending").toLowerCase();

              const getBadgeStyle = () => {
                switch (status) {
                  case "approved":
                    return { bg: "#ECFDF5", color: "#047857" };
                  case "received":
                    return { bg: "#EFF6FF", color: "#1D4ED8" };
                  case "rejected":
                    return { bg: "#FEE2E2", color: "#B91C1C" };
                  default:
                    return { bg: "#FEF3C7", color: "#B45309" };
                }
              };
              const badge = getBadgeStyle();

              return (
                <div key={req.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A" }}>{itemName}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", background: "#E2E8F0", padding: "2px 8px", borderRadius: "4px" }}>
                        Qty: {req.quantity} {unit}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div>
                        <strong>PO Reference:</strong> PO-{String(req.id).slice(0, 8)}{" "}
                        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8" }} title={`UUID: ${req.id}`}>
                          ({req.id})
                        </span>
                      </div>
                      <div>
                        <strong>Supplier:</strong> {supplier} &bull; <strong>Requester ID:</strong> {String(req.requester_id || "—").slice(0, 8)}
                      </div>
                      <div>
                        <strong>Issued:</strong> {formatDateTime(req.created_at)}
                        {req.updated_at && req.updated_at !== req.created_at && (
                          <span> &bull; <strong>Updated:</strong> {formatDateTime(req.updated_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", padding: "4px 10px", borderRadius: "6px", background: badge.bg, color: badge.color }}>
                      {status}
                    </span>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                      {status === "pending" && (
                        <>
                          <button
                            onClick={() => void handleRequisitionStatus(req.id, "approved")}
                            disabled={isSubmitting}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#10B981", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => void handleRequisitionStatus(req.id, "rejected")}
                            disabled={isSubmitting}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#EF4444", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {status === "approved" && (
                        <>
                          <button
                            onClick={() => void handleRequisitionStatus(req.id, "received")}
                            disabled={isSubmitting}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Mark Received
                          </button>
                          <button
                            onClick={() => void handleRequisitionStatus(req.id, "rejected")}
                            disabled={isSubmitting}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#EF4444", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* Audit Log Movements Modal */}
      <Modal isOpen={isMovementsModalOpen} onClose={() => setIsMovementsModalOpen(false)} title={`Stock Movement History: ${selectedItem?.itemName || ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "60vh", overflowY: "auto" }}>
          {movements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748B" }}>No movement logs found for this item.</div>
          ) : (
            movements.map((m) => (
              <div key={m.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "13px" }}>
                  <span style={{ textTransform: "capitalize", color: "#2563EB" }}>{m.movement_type}</span>
                  <span style={{ color: "#047857" }}>{m.quantity} units</span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>{m.notes || "No notes recorded."} &bull; {formatDateTime(m.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Supplier Modal */}
      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Supplier Directory & Vendors">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {suppliers.length > 0 && (
            <div style={{ marginBottom: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>Registered Vendors</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
                {suppliers.map((s) => (
                  <div key={s.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "10px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ fontSize: "13px" }}>{s.name}</strong>
                      {s.contact_person && <span style={{ fontSize: "12px", color: "#64748B" }}> ({s.contact_person})</span>}
                    </div>
                    <span style={{ fontSize: "12px", color: "#2563EB" }}>{s.phone || s.email || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSupplierSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Supplier Name *</label>
            <input type="text" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Contact Person</label>
              <input type="text" value={supplierForm.contact_person || ""} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Phone</label>
              <input type="text" value={supplierForm.phone || ""} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Email</label>
            <input type="email" value={supplierForm.email || ""} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsSupplierModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#6366F1", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Save Supplier"}</button>
          </div>
        </form>
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;
