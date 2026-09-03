import { useState, useEffect } from "react";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { useToast } from "../../../context/ToastContext";
import reportsService from "../../../services/reportsService";
import { FaHeart, FaCoins, FaFileInvoice, FaAward } from "react-icons/fa";
import donationsService from "../../../services/donationsService";
import { useDataSync } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";

const formatINR = (val: unknown): string => {
  const n = Number(String(val ?? "").replace(/[^0-9.]/g, ""));
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const getDonorTier = (totalAmount: number): string => {
  if (totalAmount >= 50000) return "Gold Patron";
  if (totalAmount >= 10000) return "Silver Patron";
  if (totalAmount > 0) return "Bronze Patron";
  return "Patron";
};

const DonorDashboard = () => {
  const { addToast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [historyRes, summaryRes] = await Promise.allSettled([
        donationsService.getDonationHistory(),
        donationsService.getDonationSummary(),
      ]);

      const historyList = historyRes.status === "fulfilled"
        ? (Array.isArray(historyRes.value) ? historyRes.value : (historyRes.value as any)?.data || [])
        : [];
      const summaryObj = summaryRes.status === "fulfilled" ? summaryRes.value : null;

      setHistory(historyList);
      setSummaryData(summaryObj);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load donor portal data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useDataSync(fetchDashboard);

  const totalContributions = Number(
    summaryData?.total_donations_amount ??
    summaryData?.totalContributions ??
    history.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  const rescuesFunded = Number(
    summaryData?.rescues_funded ??
    summaryData?.rescuesFunded ??
    history.length
  );

  const donorTier = summaryData?.donor_tier || getDonorTier(totalContributions);

  const stats = [
    { title: "Total Contributions", value: loading ? "..." : formatINR(totalContributions), trend: "Contributions", color: "#16A34A", icon: <FaCoins /> },
    { title: "Rescues Funded", value: loading ? "..." : String(rescuesFunded), trend: "Impact", color: "#1E3A8A", icon: <FaHeart /> },
    { title: "Donor Tier", value: loading ? "..." : donorTier, trend: "Tier", color: "#F59E0B", icon: <FaAward /> },
  ];

  const columns = [
    { key: "txId", title: "Receipt ID" },
    { key: "campaign", title: "Funded Campaign / Purpose" },
    { key: "amount", title: "Contribution (₹)" },
    { key: "date", title: "Date" },
    { key: "status", title: "Status" },
  ];

  const formattedData = history.map((item: any) => ({
    txId: item.transactionId || item.id || "-",
    campaign: item.notes || item.purpose || item.campaignId || "General Rescue Contribution",
    amount: formatINR(item.amount),
    date: item.date ? formatDateTime(item.date) : "-",
    status: item.status || "completed",
  }));

  return (
    <div>
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Donor Patron Portal</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Donor contribution portal: track financial impact, view funded animal rescues, and download tax exemption receipts.
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
        <QuickActionCard icon={<FaHeart />} title="Make New Donation" subtitle="Sponsor emergency rescue" color="#16A34A" onClick={() => addToast("Open the Finance module to make a donation", "info")} />
        <QuickActionCard icon={<FaFileInvoice />} title="Download Tax Receipts" subtitle="Export donation report" color="#1E3A8A" onClick={async () => {
          addToast("Generating donation report PDF...", "info");
          await reportsService.generateAndDownloadReport({ report_type: "donation", format: "pdf" });
          addToast("Donation report downloaded!", "success");
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            My Contribution History & Impact Record
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading donor record...</span>}
        </div>
        <DataTable columns={columns} data={formattedData} />
      </div>
    </div>
  );
};

export default DonorDashboard;

