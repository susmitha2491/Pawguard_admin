import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable, { type Column } from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import {
  FaBoxes,
  FaPills,
  FaExclamationTriangle,
  FaTruck,
  FaCalendarTimes,
} from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import inventoryService from "../../../services/inventoryService";
import { useDataSync } from "../../../utils/dataSync";

const numericValue = (val: unknown): number => {
  const n = Number(String(val ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const getExpiryInfo = (expiryStr?: string | null) => {
  if (!expiryStr) return { status: "NO EXPIRY", diffDays: 999 };
  const expDate = new Date(expiryStr);
  const now = new Date();
  expDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { status: "EXPIRED", diffDays };
  }
  if (diffDays <= 30) {
    return { status: "EXPIRING SOON", diffDays };
  }
  return { status: "VALID", diffDays };
};

const isLowStock = (item: any): boolean => {
  const status = String(item.status || "").toLowerCase();
  if (status.includes("low")) return true;
  const stock = item.quantity ?? numericValue(item.stock);
  const threshold = item.reorder_threshold ?? numericValue(item.threshold);
  if (threshold > 0 && stock <= threshold && stock >= 0) return true;
  return false;
};

const InventoryManagerDashboard = () => {
  const navigate = useNavigate();
  const [inventoryData, setInventoryData] = useState<Record<string, unknown>[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [alertsData, setAlertsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard summary, inventory alerts, and catalog in parallel
      const [dashRes, alertRes, invRes] = await Promise.allSettled([
        dashboardService.getInventoryDashboard(),
        inventoryService.getInventoryAlerts(),
        inventoryService.getInventory(),
      ]);

      let summaryObj: any = null;
      if (dashRes.status === "fulfilled" && dashRes.value) {
        summaryObj = dashRes.value?.data || dashRes.value;
      }

      let alertsObj: any = null;
      if (alertRes.status === "fulfilled" && alertRes.value) {
        alertsObj = alertRes.value?.data || alertRes.value;
      }

      let itemsList: any[] = [];
      if (invRes.status === "fulfilled" && invRes.value) {
        itemsList = Array.isArray(invRes.value?.data)
          ? invRes.value.data
          : Array.isArray(invRes.value)
          ? invRes.value
          : [];
      } else if (summaryObj) {
        itemsList = Array.isArray(summaryObj?.items)
          ? summaryObj.items
          : Array.isArray(summaryObj?.inventory)
          ? summaryObj.inventory
          : [];
      }

      setSummaryData(summaryObj);
      setAlertsData(alertsObj);
      setInventoryData(itemsList);
    } catch (err: any) {
      console.error("Inventory Dashboard Fetch Error:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to load inventory stock metrics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventoryDashboardData();
  }, [fetchInventoryDashboardData]);

  useDataSync(fetchInventoryDashboardData);

  // Derived Fallback Calculations from real inventory items
  const totalItemsCount = useMemo(() => {
    if (summaryData?.total_items !== undefined && summaryData?.total_items !== null && Number(summaryData.total_items) > 0) {
      return Number(summaryData.total_items);
    }
    return inventoryData.length;
  }, [inventoryData, summaryData]);

  const totalStockQuantitySum = useMemo(
    () =>
      inventoryData.reduce(
        (sum, item) => sum + (item.quantity !== undefined ? Number(item.quantity) : numericValue(item.stock)),
        0
      ),
    [inventoryData]
  );

  const lowStockCount = useMemo(
    () => {
      if (alertsData?.low_stock_count !== undefined) return Number(alertsData.low_stock_count);
      if (alertsData?.low_stock_alerts !== undefined) return Number(alertsData.low_stock_alerts);
      if (summaryData?.low_stock_alerts !== undefined && summaryData?.low_stock_alerts !== null && Number(summaryData.low_stock_alerts) > 0) {
        return Number(summaryData.low_stock_alerts);
      }
      return inventoryData.filter(isLowStock).length;
    },
    [inventoryData, summaryData, alertsData]
  );

  const medicineCount = useMemo(
    () => {
      if (summaryData?.medicines_stock !== undefined && summaryData?.medicines_stock !== null && Number(summaryData.medicines_stock) > 0) {
        return Number(summaryData.medicines_stock);
      }
      return inventoryData.filter(
        (item) =>
          String(item.category || "").toLowerCase().includes("medic") ||
          String(item.category || "").toLowerCase().includes("vaccin") ||
          String(item.category || "").toLowerCase().includes("drug") ||
          String(item.supplier || "").toLowerCase().includes("pharma")
      ).length;
    },
    [inventoryData, summaryData]
  );

  const expiredCount = useMemo(
    () => {
      if (alertsData?.expired_count !== undefined) return Number(alertsData.expired_count);
      return inventoryData.filter((i) => getExpiryInfo(i.expiry_date as string).status === "EXPIRED").length;
    },
    [inventoryData, alertsData]
  );

  const expiringSoonCount = useMemo(
    () => {
      if (alertsData?.expiring_soon_count !== undefined) return Number(alertsData.expiring_soon_count);
      return inventoryData.filter((i) => getExpiryInfo(i.expiry_date as string).status === "EXPIRING SOON").length;
    },
    [inventoryData, alertsData]
  );

  const stats = [
    {
      title: "Total Catalog Items",
      value: loading ? "..." : `${totalItemsCount} Items`,
      trend: `${totalStockQuantitySum} Total Units`,
      color: "#1E3A8A",
      icon: <FaBoxes />,
      onClick: () => navigate("/inventory"),
    },
    {
      title: "Medicines & Vaccines",
      value: loading ? "..." : `${medicineCount} Stock`,
      trend: "Pharmacy supply",
      color: "#16A34A",
      icon: <FaPills />,
      onClick: () => navigate("/inventory"),
    },
    {
      title: "Low Stock Alerts",
      value: loading ? "..." : `${lowStockCount} Items`,
      trend: "Action Required",
      color: "#DC2626",
      icon: <FaExclamationTriangle />,
      onClick: () => navigate("/inventory?tab=low_stock"),
    },
    {
      title: "Expiring / Expired",
      value: loading ? "..." : `${expiredCount + expiringSoonCount} Items`,
      trend: `${expiredCount} Expired, ${expiringSoonCount} Soon`,
      color: "#F59E0B",
      icon: <FaCalendarTimes />,
      onClick: () => navigate("/inventory?tab=expiring_soon"),
    },
  ];

  const columns: Column<any>[] = [
    {
      key: "sku",
      title: "Batch / Item Code",
      render: (v: string, r: any) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>
          {v ? String(v).slice(0, 13) : r.id ? String(r.id).slice(0, 13) : "-"}
        </span>
      ),
    },
    {
      key: "itemName",
      title: "Item Name",
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{v || r.name || "Stock Item"}</div>
          {r.unit_cost !== undefined && r.unit_cost !== null && (
            <div style={{ fontSize: "11px", color: "#64748B" }}>
              Unit Cost: ${Number(r.unit_cost).toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    { key: "category", title: "Category" },
    {
      key: "stock",
      title: "Current Stock",
      render: (v: unknown, row: any) => {
        const qty = row.quantity !== undefined ? row.quantity : numericValue(v);
        const unit = row.unit || "units";
        const thresh = row.reorder_threshold !== undefined ? row.reorder_threshold : numericValue(row.threshold);
        return (
          <div>
            <div style={{ fontWeight: 700, color: isLowStock(row) ? "#DC2626" : "#0F172A" }}>
              {qty} {unit}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Min: {thresh} {unit}</div>
          </div>
        );
      },
    },
    {
      key: "status",
      title: "Stock Status",
      render: (_: unknown, row: any) => (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: "999px",
            background: isLowStock(row) ? "#FEE2E2" : "#D1FAE5",
            color: isLowStock(row) ? "#991B1B" : "#065F46",
          }}
        >
          {isLowStock(row) ? "LOW STOCK" : "IN STOCK"}
        </span>
      ),
    },
  ];

  const formattedInventory = useMemo(
    () =>
      inventoryData.map((item: any) => ({
        id: item.id ?? item.sku ?? item.code ?? "",
        sku: item.id ?? item.sku ?? item.code ?? "",
        itemName: item.name ?? item.item_name ?? item.itemName ?? "Item",
        category: item.category ?? "General",
        stock: item.stock !== undefined ? item.stock : item.quantity !== undefined ? item.quantity : 0,
        quantity: item.quantity !== undefined ? item.quantity : numericValue(item.stock),
        unit: item.unit || "units",
        threshold: item.threshold ?? item.reorder_threshold ?? 10,
        reorder_threshold: item.reorder_threshold ?? numericValue(item.threshold),
        status: item.status ?? (isLowStock(item) ? "LOW STOCK" : "IN STOCK"),
        expiry_date: item.expiry_date,
        unit_cost: item.unit_cost,
      })),
    [inventoryData]
  );

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Inventory &amp; Stock Control Hub</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Inventory management: monitor pharmaceutical supplies, food kibble stock, medical equipment, and vendor purchase logs.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaBoxes />} title="Add Inventory Item" subtitle="Register new item" color="#1E3A8A" onClick={() => navigate("/inventory?action=add")} />
        <QuickActionCard icon={<FaTruck />} title="Issue Purchase Order" subtitle="Order from vendor" color="#16A34A" onClick={() => navigate("/inventory")} />
        <QuickActionCard icon={<FaExclamationTriangle />} title="Low Stock Audit" subtitle="Review depleted items" color="#DC2626" onClick={() => navigate("/inventory?tab=low_stock")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Pharmaceutical &amp; Supply Stock Catalog ({formattedInventory.length})
          </h3>
          {loading && <span style={{ fontSize: "12px", color: "#1E3A8A", fontWeight: 600 }}>Syncing stock catalog...</span>}
        </div>
        <DataTable columns={columns} data={formattedInventory} loading={loading} emptyMessage="No inventory items found." />
      </div>
    </div>
  );
};

export default InventoryManagerDashboard;
