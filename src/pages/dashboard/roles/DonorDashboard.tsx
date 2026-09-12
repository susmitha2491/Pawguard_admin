import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { Modal } from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import reportsService from "../../../services/reportsService";
import {
  FaHeart,
  FaCoins,
  FaFileInvoice,
  FaAward,
  FaPaw,
  FaCalendarAlt,
  FaSearch,
  FaDownload,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaUndo,
  FaDog,
  FaInfoCircle,
  FaReceipt,
  FaHandHoldingHeart,
} from "react-icons/fa";
import donationsService from "../../../services/donationsService";
import dashboardService from "../../../services/dashboardService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime, formatDateOnly } from "../../../utils/dateUtils";
import { getStoredUser } from "../../../utils/authStorage";
import { resolveImageUrl, getDogPhotoUrl } from "../../../utils/imageUtils";

/** Currency formatter for Indian Rupee (₹) */
const formatINR = (val: unknown): string => {
  const n = Number(String(val ?? "").replace(/[^0-9.]/g, ""));
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (val?: string | number | Date | null): string => formatDateOnly(val);

/** Calculates donor recognition tier based on cumulative contribution */
const getDonorTier = (totalAmount: number): { name: string; color: string } => {
  if (totalAmount >= 50000) return { name: "Gold Patron", color: "#F59E0B" };
  if (totalAmount >= 25000) return { name: "Silver Patron", color: "#64748B" };
  if (totalAmount >= 5000) return { name: "Bronze Patron", color: "#D97706" };
  if (totalAmount > 0) return { name: "Supporter", color: "#16A34A" };
  return { name: "New Patron", color: "#3B82F6" };
};

/** Helper to render status badges for donations & sponsorships */
const renderStatusBadge = (statusRaw?: string) => {
  const s = String(statusRaw || "completed").toLowerCase().trim();

  if (["success", "completed", "paid", "captured", "settled", "successful", "active"].includes(s)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 700,
          background: "#DCFCE7",
          color: "#15803D",
        }}
      >
        <FaCheckCircle size={11} /> {s === "active" ? "Active" : "Completed"}
      </span>
    );
  }

  if (["pending", "in_progress", "processing"].includes(s)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 700,
          background: "#FEF3C7",
          color: "#B45309",
        }}
      >
        <FaClock size={11} /> Pending
      </span>
    );
  }

  if (["refunded", "refund", "returned"].includes(s)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 700,
          background: "#F1F5F9",
          color: "#475569",
        }}
      >
        <FaUndo size={11} /> Refunded
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 700,
        background: "#FEE2E2",
        color: "#B91C1C",
      }}
    >
      <FaTimesCircle size={11} /> {s === "cancelled" ? "Cancelled" : s === "failed" ? "Failed" : s}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  background: "#FFF",
  color: "#0F172A",
};

export type DonorTab = "overview" | "donations" | "sponsorships" | "receipts";

const DonorDashboard: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = getStoredUser<any>();

  // Active Tab from URL search params: overview, donations, sponsorships, receipts
  const activeTab: DonorTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab && ["donations", "sponsorships", "receipts"].includes(tab)) {
      return tab as DonorTab;
    }
    // Backward compatibility: if URL requested profile, map gracefully to receipts
    if (tab === "profile") {
      return "receipts";
    }
    return "overview";
  }, [searchParams]);

  const setTab = (newTab: DonorTab) => {
    if (newTab === "overview") {
      searchParams.delete("tab");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab: newTab });
    }
  };

  // Main State
  const [history, setHistory] = useState<any[]>([]);
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [donorProfile, setDonorProfile] = useState<any | null>(null);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for Donation History Tab
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  // Make Contribution Modal State
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false);
  const [donationForm, setDonationForm] = useState({
    amount: "2500",
    donation_type: "one_time" as "one_time" | "sponsorship",
    purpose: "General Animal Rescue & Medical Fund",
    notes: "",
  });

  // Sponsored Dog View Modal
  const [selectedDog, setSelectedDog] = useState<any | null>(null);

  // Downloading receipt state tracker
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Fetch all donor self-service data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [historyRes, sponsorshipsRes, profileRes, dashRes] = await Promise.allSettled([
        donationsService.getDonationHistory(),
        donationsService.getMySponsorships(),
        donationsService.getMyDonorProfile(),
        dashboardService.getDonorDashboard(),
      ]);

      const historyList =
        historyRes.status === "fulfilled"
          ? Array.isArray(historyRes.value)
            ? historyRes.value
            : (historyRes.value as any)?.data || []
          : [];

      const sponsorshipsList =
        sponsorshipsRes.status === "fulfilled"
          ? Array.isArray(sponsorshipsRes.value)
            ? sponsorshipsRes.value
            : (sponsorshipsRes.value as any)?.data || []
          : [];

      const profileObj = profileRes.status === "fulfilled" ? profileRes.value : null;
      const dashObj = dashRes.status === "fulfilled" ? dashRes.value : null;

      setHistory(historyList);
      setSponsorships(sponsorshipsList);
      setDonorProfile(profileObj);
      setDashboardData(dashObj);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Unable to load your donation information. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useDataSync(fetchDashboard);

  // Calculated Summary Metrics (supported by authenticated donor's own records)
  const completedDonations = useMemo(() => {
    return history.filter((item) => {
      const s = String(item.status || "").toLowerCase().trim();
      return (
        ["success", "completed", "paid", "captured", "settled", "successful", "pending"].includes(s) || !s
      );
    });
  }, [history]);

  const totalDonatedAmount = useMemo(() => {
    if (dashboardData?.total_donations_amount !== undefined) {
      return Number(dashboardData.total_donations_amount);
    }
    return completedDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [dashboardData, completedDonations]);

  const totalDonationsCount = useMemo(() => {
    if (dashboardData?.total_donations_count !== undefined) {
      return Number(dashboardData.total_donations_count);
    }
    return completedDonations.length;
  }, [dashboardData, completedDonations]);

  const activeSponsorshipsCount = useMemo(() => {
    if (dashboardData?.active_sponsorships_count !== undefined) {
      return Number(dashboardData.active_sponsorships_count);
    }
    return sponsorships.filter((s) => String(s.status || "active").toLowerCase() === "active").length;
  }, [dashboardData, sponsorships]);

  const latestDonation = useMemo(() => {
    if (completedDonations.length === 0) return null;
    return [...completedDonations].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    })[0];
  }, [completedDonations]);

  const donorName =
    donorProfile?.user?.full_name ||
    donorProfile?.user?.name ||
    currentUser?.full_name ||
    currentUser?.name ||
    "Valued Patron";

  const tier = getDonorTier(totalDonatedAmount);

  // Summary Metrics Cards Data
  const stats = [
    {
      title: "Total Donated",
      value: loading ? "..." : formatINR(totalDonatedAmount),
      trend: "Cumulative Contributions",
      color: "#16A34A",
      icon: <FaCoins />,
    },
    {
      title: "Total Donations",
      value: loading ? "..." : String(totalDonationsCount),
      trend: `${completedDonations.length} Successful`,
      color: "#1E3A8A",
      icon: <FaHeart />,
    },
    {
      title: "Active Sponsorships",
      value: loading ? "..." : String(activeSponsorshipsCount),
      trend: "Dogs in Foster/Shelter",
      color: "#D97706",
      icon: <FaPaw />,
    },
    {
      title: "Latest Donation",
      value: loading
        ? "..."
        : latestDonation
        ? `${formatINR(latestDonation.amount)}`
        : "None yet",
      trend: latestDonation?.date ? formatDate(latestDonation.date) : "Make a contribution",
      color: "#7C3AED",
      icon: <FaCalendarAlt />,
    },
  ];

  // Handler for making a contribution
  const handleCreateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(donationForm.amount);
    if (!amountNum || amountNum <= 0) {
      addToast("Please enter a valid donation amount.", "error");
      return;
    }

    try {
      setIsSubmittingDonation(true);
      await donationsService.createDonation({
        amount: amountNum,
        currency: "INR",
        donation_type: donationForm.donation_type,
        purpose: donationForm.purpose,
        notes: donationForm.notes || donationForm.purpose,
      });

      addToast("Thank you! Your donation has been recorded successfully.", "success");
      setIsDonationModalOpen(false);
      setDonationForm({
        amount: "2500",
        donation_type: "one_time",
        purpose: "General Animal Rescue & Medical Fund",
        notes: "",
      });
      await fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to submit donation. Please try again.",
        "error"
      );
    } finally {
      setIsSubmittingDonation(false);
    }
  };

  // Handler for single receipt download
  const handleDownloadReceipt = async (donation: any) => {
    const donationId = donation.id || donation.txId;
    if (!donationId) {
      addToast("Receipt identifier not found.", "error");
      return;
    }

    try {
      setDownloadingReceiptId(donationId);
      addToast("Preparing tax receipt download...", "info");

      const res = await donationsService.downloadReceiptFile(donationId);

      if (res instanceof Blob) {
        const url = window.URL.createObjectURL(res);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PawGuard_Receipt_${donation.transactionId || donationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast("Receipt downloaded successfully!", "success");
      } else if (res?.download_url || res?.url) {
        window.open(res.download_url || res.url, "_blank");
        addToast("Receipt opened in new tab.", "success");
      } else {
        // Fallback report generation
        await reportsService.generateAndDownloadReport({
          report_type: "donation",
          format: "pdf",
        });
        addToast("Donation statement downloaded!", "success");
      }
    } catch (err: any) {
      addToast(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Receipt is being generated. You can also download your full donation statement.",
        "info"
      );
      // Fallback
      await reportsService.generateAndDownloadReport({
        report_type: "donation",
        format: "pdf",
      });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Filtered donation records
  const filteredDonations = useMemo(() => {
    return history.filter((item) => {
      // Search filter
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const tx = String(item.transactionId || item.id || "").toLowerCase();
        const purpose = String(item.notes || item.purpose || item.campaignId || "").toLowerCase();
        const name = String(item.donorName || "").toLowerCase();
        if (!tx.includes(query) && !purpose.includes(query) && !name.includes(query)) {
          return false;
        }
      }

      // Type filter
      if (historyTypeFilter !== "all") {
        const type = String(item.type || item.donation_type || "").toLowerCase();
        if (historyTypeFilter === "one_time" && type !== "one_time") return false;
        if (historyTypeFilter === "sponsorship" && type !== "sponsorship") return false;
        if (historyTypeFilter === "recurring" && type !== "recurring") return false;
      }

      // Status filter
      if (historyStatusFilter !== "all") {
        const s = String(item.status || "").toLowerCase();
        if (historyStatusFilter === "completed" && !["success", "completed", "paid"].includes(s) && s !== "") {
          return false;
        }
        if (historyStatusFilter === "pending" && s !== "pending") return false;
        if (historyStatusFilter === "refunded" && s !== "refunded") return false;
        if (historyStatusFilter === "failed" && s !== "failed") return false;
      }

      return true;
    });
  }, [history, historySearch, historyTypeFilter, historyStatusFilter]);

  // Table Columns for Donation History
  const donationColumns = [
    {
      key: "date",
      title: "Date",
      render: (_val: any, row: any) => (
        <span style={{ fontWeight: 600, color: "#334155" }}>
          {row?.date ? formatDateTime(row.date) : "-"}
        </span>
      ),
    },
    {
      key: "amount",
      title: "Contribution",
      render: (_val: any, row: any) => (
        <span style={{ fontWeight: 800, color: "#16A34A", fontSize: "14px" }}>
          {formatINR(row?.amount)}
        </span>
      ),
    },
    {
      key: "type",
      title: "Type",
      render: (_val: any, row: any) => {
        const t = String(row?.type || row?.donation_type || "one_time").toLowerCase();
        const label =
          t === "sponsorship"
            ? "Dog Sponsorship"
            : t === "recurring"
            ? "Monthly Giving"
            : "One-Time Donation";
        return (
          <span
            style={{
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "6px",
              background: t === "sponsorship" ? "#FEF3C7" : "#F1F5F9",
              color: t === "sponsorship" ? "#92400E" : "#475569",
              fontWeight: 600,
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "purpose",
      title: "Purpose / Cause",
      render: (_val: any, row: any) => (
        <span style={{ color: "#1E293B", fontWeight: 500 }}>
          {row?.notes || row?.purpose || "General Animal Welfare & Rescue Fund"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (_val: any, row: any) => renderStatusBadge(row?.status || row?.rawStatus),
    },
    {
      key: "receipt",
      title: "Tax Receipt",
      render: (_val: any, row: any) => {
        const rId = row?.id || row?.txId || row?.transactionId;
        return (
          <button
            type="button"
            onClick={() => handleDownloadReceipt(row)}
            disabled={!rId || downloadingReceiptId === rId}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#1E3A8A",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
            }}
            title="Download Tax Receipt"
          >
            <FaDownload size={11} />
            {downloadingReceiptId === rId ? "Loading..." : "Tax Receipt"}
          </button>
        );
      },
    },
  ];

  // Table Columns for Receipts Tab
  const receiptColumns = [
    {
      key: "date",
      title: "Donation Date",
      render: (_val: any, row: any) => (
        <span style={{ fontWeight: 600, color: "#334155" }}>
          {row?.date ? formatDate(row.date) : "-"}
        </span>
      ),
    },
    {
      key: "txId",
      title: "Receipt / Ref ID",
      render: (_val: any, row: any) => (
        <span style={{ fontFamily: "monospace", color: "#475569", fontSize: "12px", fontWeight: 600 }}>
          {row?.transactionId || row?.id || row?.txId || "-"}
        </span>
      ),
    },
    {
      key: "amount",
      title: "Amount",
      render: (_val: any, row: any) => (
        <span style={{ fontWeight: 800, color: "#16A34A", fontSize: "14px" }}>
          {formatINR(row?.amount)}
        </span>
      ),
    },
    {
      key: "purpose",
      title: "Contribution Fund",
      render: (_val: any, row: any) => (
        <span style={{ color: "#1E293B", fontWeight: 500 }}>
          {row?.notes || row?.purpose || "General Animal Rescue Fund"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Receipt Status",
      render: () => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#15803D",
          }}
        >
          <FaCheckCircle size={12} /> Available
        </span>
      ),
    },
    {
      key: "action",
      title: "Download",
      render: (_val: any, row: any) => {
        const rId = row?.id || row?.txId || row?.transactionId;
        return (
          <button
            type="button"
            onClick={() => handleDownloadReceipt(row)}
            disabled={!rId || downloadingReceiptId === rId}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#1E3A8A",
              color: "#FFF",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaDownload size={11} />
            {downloadingReceiptId === rId ? "Downloading..." : "PDF Receipt"}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header with Personalized Welcome & Patron Tier */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",
          padding: "24px 28px",
          borderRadius: "14px",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              Welcome back, {donorName}
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 800,
                background: "rgba(255, 255, 255, 0.15)",
                color: "#FDE047",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              <FaAward /> {tier.name}
            </span>
          </div>
          <p style={{ margin: 0, color: "#CBD5E1", fontSize: "14px" }}>
            Track your contributions, active dog sponsorships, and download your donation tax receipts.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsDonationModalOpen(true)}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#16A34A",
              color: "#FFF",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
              transition: "transform 0.15s ease",
            }}
          >
            <FaHeart /> Make a Contribution
          </button>
          <button
            type="button"
            onClick={async () => {
              addToast("Generating comprehensive donation statement PDF...", "info");
              await reportsService.generateAndDownloadReport({ report_type: "donation", format: "pdf" });
              addToast("Donation statement downloaded!", "success");
            }}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              background: "rgba(255, 255, 255, 0.1)",
              color: "#FFF",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backdropFilter: "blur(4px)",
            }}
          >
            <FaFileInvoice /> Annual Tax Statement
          </button>
        </div>
      </div>

      {/* Error Alert */}
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
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <FaInfoCircle /> {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "2px solid #E2E8F0",
          paddingBottom: "12px",
          marginBottom: "20px",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("overview")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: activeTab === "overview" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
            background: activeTab === "overview" ? "#EFF6FF" : "#FFFFFF",
            color: activeTab === "overview" ? "#1E3A8A" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <FaAward /> Overview
        </button>

        <button
          type="button"
          onClick={() => setTab("donations")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: activeTab === "donations" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
            background: activeTab === "donations" ? "#EFF6FF" : "#FFFFFF",
            color: activeTab === "donations" ? "#1E3A8A" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <FaCoins /> My Donations ({history.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("sponsorships")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: activeTab === "sponsorships" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
            background: activeTab === "sponsorships" ? "#EFF6FF" : "#FFFFFF",
            color: activeTab === "sponsorships" ? "#1E3A8A" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <FaPaw /> My Sponsorships ({sponsorships.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("receipts")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: activeTab === "receipts" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
            background: activeTab === "receipts" ? "#EFF6FF" : "#FFFFFF",
            color: activeTab === "receipts" ? "#1E3A8A" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <FaReceipt /> Tax Receipts ({completedDonations.length})
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Tax-Deductible Donation Receipts Information Banner */}
          <div
            className="soft-card"
            style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
              border: "1px solid #BFDBFE",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", maxWidth: "700px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "#1E3A8A",
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  flexShrink: 0,
                }}
              >
                <FaFileInvoice />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px", color: "#1E3A8A", fontSize: "15px", fontWeight: 700 }}>
                  Tax-Deductible Donation Receipts
                </h4>
                <p style={{ margin: 0, color: "#1E293B", fontSize: "13px", lineHeight: "1.5" }}>
                  Official donation receipts and annual contribution statements are generated automatically for all completed contributions. You can view, print, or download them at any time from the Tax Receipts tab.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTab("receipts")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #1E3A8A",
                background: "#FFF",
                color: "#1E3A8A",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaReceipt /> View Tax Receipts
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            <QuickActionCard
              icon={<FaHandHoldingHeart />}
              title="Make a Contribution"
              subtitle="Support emergency rescues"
              color="#16A34A"
              onClick={() => setIsDonationModalOpen(true)}
            />
            <QuickActionCard
              icon={<FaPaw />}
              title="Sponsored Animals"
              subtitle="View dog profiles & progress"
              color="#D97706"
              onClick={() => setTab("sponsorships")}
            />
            <QuickActionCard
              icon={<FaReceipt />}
              title="Tax Receipts"
              subtitle="Download PDF donation receipts"
              color="#1E3A8A"
              onClick={() => setTab("receipts")}
            />
          </div>

          {/* Active Sponsorships Preview (if any) */}
          {sponsorships.length > 0 && (
            <div className="soft-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  Active Dog Sponsorships
                </h3>
                <button
                  type="button"
                  onClick={() => setTab("sponsorships")}
                  style={{ background: "none", border: "none", color: "#1E3A8A", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                >
                  View All ({sponsorships.length}) →
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                {sponsorships.slice(0, 3).map((spon: any) => {
                  const dog = spon.dog || {};
                  const photo = getDogPhotoUrl(dog);
                  return (
                    <div
                      key={spon.id}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        padding: "16px",
                        background: "#FAFAFA",
                        display: "flex",
                        gap: "14px",
                        alignItems: "center",
                      }}
                    >
                      {photo ? (
                        <img
                          src={resolveImageUrl(photo)}
                          alt={dog.name || "Sponsored Dog"}
                          style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "10px",
                            background: "#E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94A3B8",
                            fontSize: "24px",
                          }}
                        >
                          <FaDog />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                            {dog.name || "Sponsored Dog"}
                          </h4>
                          {renderStatusBadge(spon.status)}
                        </div>
                        <p style={{ margin: "2px 0 6px", fontSize: "12px", color: "#64748B" }}>
                          {dog.breed || "Shelter Dog"} • {dog.age ? `${dog.age} yrs` : "Adult"}
                        </p>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#16A34A" }}>
                          {formatINR(spon.monthly_amount || spon.amount)}{" "}
                          <span style={{ fontSize: "11px", fontWeight: 500, color: "#64748B" }}>/ month</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Donations (Latest 5) */}
          <div className="soft-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  Recent Contributions
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Your latest contributions to animal care, rescue and rehabilitation
                </p>
              </div>

              {history.length > 5 && (
                <button
                  type="button"
                  onClick={() => setTab("donations")}
                  style={{ background: "none", border: "none", color: "#1E3A8A", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                >
                  View Complete History ({history.length}) →
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#EFF6FF",
                    color: "#1E3A8A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    fontSize: "22px",
                  }}
                >
                  <FaCoins />
                </div>
                <h4 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  No donations yet
                </h4>
                <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: "13px" }}>
                  Your contribution history will appear here after you make your first donation.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDonationModalOpen(true)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#16A34A",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Make First Contribution
                </button>
              </div>
            ) : (
              <DataTable
                columns={donationColumns}
                data={history.slice(0, 5)}
                loading={loading}
                hideSearch={true}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COMPLETE DONATION HISTORY */}
      {activeTab === "donations" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                My Contribution History
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                Complete log of all contributions made from your donor account
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {/* Search Bar */}
              <div style={{ position: "relative" }}>
                <FaSearch
                  size={13}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search receipt ID, cause..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    padding: "8px 12px 8px 32px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                    width: "220px",
                  }}
                />
              </div>

              {/* Type Filter */}
              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  background: "#FFF",
                  color: "#334155",
                  fontWeight: 500,
                }}
              >
                <option value="all">All Contribution Types</option>
                <option value="one_time">One-Time Donations</option>
                <option value="sponsorship">Dog Sponsorships</option>
                <option value="recurring">Monthly Giving</option>
              </select>

              {/* Status Filter */}
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  background: "#FFF",
                  color: "#334155",
                  fontWeight: 500,
                }}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {filteredDonations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                  fontSize: "22px",
                }}
              >
                <FaCoins />
              </div>
              <h4 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                {history.length === 0 ? "No donations yet" : "No matching donations found"}
              </h4>
              <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: "13px" }}>
                {history.length === 0
                  ? "Your donation history will appear here after you make a contribution."
                  : "Try clearing your search query or adjusting your filters."}
              </p>
            </div>
          ) : (
            <DataTable
              columns={donationColumns}
              data={filteredDonations}
              loading={loading}
              hideSearch={true}
            />
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE SPONSORSHIPS */}
      {activeTab === "sponsorships" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="soft-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  My Dog Sponsorships
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Dogs you are actively sponsoring for food, housing, and veterinary care
                </p>
              </div>

              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                  fontWeight: 700,
                  fontSize: "12px",
                }}
              >
                {sponsorships.length} Sponsored Animal{sponsorships.length === 1 ? "" : "s"}
              </span>
            </div>

            {sponsorships.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "#FEF3C7",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                    fontSize: "24px",
                  }}
                >
                  <FaPaw />
                </div>
                <h4 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  No active sponsorships
                </h4>
                <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: "13px", maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
                  You are not currently sponsoring a dog. Sponsoring a rescue animal covers their monthly nutrition,
                  vaccinations, medical treatments, and shelter care.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDonationModalOpen(true)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FaHeart /> Start a Sponsorship
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "20px",
                }}
              >
                {sponsorships.map((spon: any) => {
                  const dog = spon.dog || {};
                  const photo = getDogPhotoUrl(dog);

                  return (
                    <div
                      key={spon.id}
                      style={{
                        borderRadius: "14px",
                        border: "1px solid #E2E8F0",
                        background: "#FFF",
                        overflow: "hidden",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Dog Image Header */}
                      <div style={{ position: "relative", height: "160px", background: "#F1F5F9" }}>
                        {photo ? (
                          <img
                            src={resolveImageUrl(photo)}
                            alt={dog.name || "Sponsored Dog"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#94A3B8",
                              fontSize: "42px",
                            }}
                          >
                            <FaDog />
                          </div>
                        )}

                        <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                          {renderStatusBadge(spon.status)}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ padding: "18px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                          <h4 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                            {dog.name || "Sponsored Dog"}
                          </h4>
                          <span style={{ fontSize: "15px", fontWeight: 800, color: "#16A34A" }}>
                            {formatINR(spon.monthly_amount || spon.amount)}
                            <span style={{ fontSize: "11px", fontWeight: 500, color: "#64748B" }}> / mo</span>
                          </span>
                        </div>

                        <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#64748B" }}>
                          {dog.breed || "Shelter Dog"} • {typeof dog.gender === "string" && dog.gender ? `${dog.gender.charAt(0).toUpperCase() + dog.gender.slice(1)}` : "Dog"} • {dog.age ? `${dog.age} years old` : "Adult"}
                        </p>

                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            marginBottom: "14px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "#64748B" }}>Sponsorship Started:</span>
                            <span style={{ fontWeight: 600, color: "#1E293B" }}>
                              {spon.started_at ? formatDate(spon.started_at) : "Active"}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#64748B" }}>Next Renewal Date:</span>
                            <span style={{ fontWeight: 600, color: "#1E3A8A" }}>
                              {spon.next_charge_date ? formatDate(spon.next_charge_date) : "Continuous"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedDog(dog)}
                          style={{
                            marginTop: "auto",
                            width: "100%",
                            padding: "9px",
                            borderRadius: "8px",
                            border: "1px solid #1E3A8A",
                            background: "#EFF6FF",
                            color: "#1E3A8A",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <FaPaw /> View Dog Details & Medical History
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TAX RECEIPTS / DOCUMENTS */}
      {activeTab === "receipts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Banner with Annual PDF Statement */}
          <div
            className="soft-card"
            style={{
              padding: "20px 24px",
              borderRadius: "12px",
              background: "#FFF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px", color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                Donation Tax Receipts & Statements
              </h3>
              <p style={{ margin: 0, color: "#64748B", fontSize: "13px" }}>
                Download official computerized tax-deductible receipts and annual contribution statements.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                addToast("Generating complete consolidated tax statement...", "info");
                await reportsService.generateAndDownloadReport({ report_type: "donation", format: "pdf" });
                addToast("Consolidated tax statement downloaded!", "success");
              }}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#1E3A8A",
                color: "#FFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaDownload /> Download Annual Statement (PDF)
            </button>
          </div>

          <div className="soft-card" style={{ padding: "20px" }}>
            {completedDonations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#EFF6FF",
                    color: "#1E3A8A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    fontSize: "22px",
                  }}
                >
                  <FaFileInvoice />
                </div>
                <h4 style={{ margin: "0 0 6px", color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
                  No tax receipts available
                </h4>
                <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: "13px" }}>
                  Receipts are automatically generated for all completed financial contributions.
                </p>
              </div>
            ) : (
              <DataTable
                columns={receiptColumns}
                data={completedDonations}
                loading={loading}
                hideSearch={false}
              />
            )}
          </div>
        </div>
      )}

      {/* MAKE DONATION MODAL */}
      <Modal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        title="Make a Contribution to Animal Rescue"
      >
        <form onSubmit={handleCreateDonation} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px" }}>
            Your support directly funds emergency veterinary treatment, nutrition, vaccinations, and shelter for rescued dogs.
          </p>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
              Select Contribution Amount (₹) *
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "10px" }}>
              {["1000", "2500", "5000", "10000"].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDonationForm({ ...donationForm, amount: amt })}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: donationForm.amount === amt ? "2px solid #16A34A" : "1px solid #CBD5E1",
                    background: donationForm.amount === amt ? "#DCFCE7" : "#FFF",
                    color: donationForm.amount === amt ? "#15803D" : "#334155",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ₹{Number(amt).toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#64748B" }}>
                ₹
              </span>
              <input
                type="number"
                required
                min={100}
                placeholder="Or enter custom amount in ₹"
                value={donationForm.amount}
                onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
                style={{ ...inputStyle, paddingLeft: "28px", fontWeight: 700, fontSize: "15px", color: "#16A34A" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Contribution Purpose / Cause
            </label>
            <select
              value={donationForm.purpose}
              onChange={(e) => setDonationForm({ ...donationForm, purpose: e.target.value })}
              style={inputStyle}
            >
              <option value="General Animal Rescue & Medical Fund">General Animal Rescue & Medical Fund</option>
              <option value="Emergency Veterinary Surgeries & Critical Care">Emergency Veterinary Surgeries & Critical Care</option>
              <option value="Daily Nutrition & Shelter Feeding Program">Daily Nutrition & Shelter Feeding Program</option>
              <option value="Puppy Nursery & Vaccination Protocol">Puppy Nursery & Vaccination Protocol</option>
              <option value="Winter Shelter Warming & Bedding">Winter Shelter Warming & Bedding</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Contribution Frequency
            </label>
            <div style={{ display: "flex", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="freq"
                  checked={donationForm.donation_type === "one_time"}
                  onChange={() => setDonationForm({ ...donationForm, donation_type: "one_time" })}
                />
                <span>One-Time Contribution</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="freq"
                  checked={donationForm.donation_type === "sponsorship"}
                  onChange={() => setDonationForm({ ...donationForm, donation_type: "sponsorship" })}
                />
                <span>Monthly Recurring Giving</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Message of Support (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Wishing a speedy recovery to all shelter dogs"
              value={donationForm.notes}
              onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              fontSize: "12px",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaFileInvoice style={{ color: "#16A34A", fontSize: "14px" }} />
            <span>Your tax-deductible donation receipt will be generated after the contribution is successfully completed.</span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsDonationModalOpen(false)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFF",
                color: "#475569",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingDonation}
              style={{
                padding: "9px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#16A34A",
                color: "#FFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: isSubmittingDonation ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaHeart /> {isSubmittingDonation ? "Recording..." : `Confirm Contribution (${formatINR(donationForm.amount)})`}
            </button>
          </div>
        </form>
      </Modal>

      {/* SPONSORED DOG DETAILS MODAL */}
      <Modal
        isOpen={Boolean(selectedDog)}
        onClose={() => setSelectedDog(null)}
        title={selectedDog?.name ? `${selectedDog.name} — Sponsored Animal Profile` : "Sponsored Dog Details"}
      >
        {selectedDog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              {getDogPhotoUrl(selectedDog) ? (
                <img
                  src={resolveImageUrl(getDogPhotoUrl(selectedDog))}
                  alt={selectedDog.name}
                  style={{ width: "90px", height: "90px", borderRadius: "12px", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "12px",
                    background: "#F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94A3B8",
                    fontSize: "36px",
                  }}
                >
                  <FaDog />
                </div>
              )}

              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  {selectedDog.name || "Sponsored Dog"}
                </h3>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#64748B" }}>
                  {selectedDog.breed || "Shelter Dog"} • {selectedDog.gender ? `${selectedDog.gender}` : "Dog"} • {selectedDog.age ? `${selectedDog.age} yrs` : "Adult"}
                </p>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: "#DCFCE7",
                    color: "#15803D",
                  }}
                >
                  Sponsored by You
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                <div>
                  <strong style={{ color: "#334155" }}>Microchip / Tag ID:</strong>
                  <div style={{ color: "#64748B", fontFamily: "monospace" }}>{selectedDog.microchip_number || selectedDog.id || "Assigned"}</div>
                </div>
                <div>
                  <strong style={{ color: "#334155" }}>Health & Vaccination:</strong>
                  <div style={{ color: "#16A34A", fontWeight: 600 }}>{selectedDog.medical_status || "Up to date"}</div>
                </div>
              </div>

              <div>
                <strong style={{ color: "#334155" }}>Shelter Location:</strong>
                <div style={{ color: "#64748B" }}>{selectedDog.shelter_name || selectedDog.facility_name || "PawGuard Main Shelter & Recovery Wing"}</div>
              </div>
            </div>

            {selectedDog.description && (
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                  Rescue Story & Bio
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
                  {selectedDog.description}
                </p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedDog(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DonorDashboardErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("DonorDashboard caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#FFF", borderRadius: "14px", border: "1px solid #E2E8F0", margin: "20px 0" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEF2F2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "24px" }}>
            <FaInfoCircle />
          </div>
          <h3 style={{ margin: "0 0 8px", color: "#0F172A", fontSize: "18px", fontWeight: 700 }}>
            Unable to load Donor Dashboard
          </h3>
          <p style={{ margin: "0 0 20px", color: "#64748B", fontSize: "14px", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
            An unexpected error occurred while displaying your donation portal. Please try refreshing.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: "#1E3A8A",
              color: "#FFF",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const WrappedDonorDashboard: React.FC = () => (
  <DonorDashboardErrorBoundary>
    <DonorDashboard />
  </DonorDashboardErrorBoundary>
);

export default WrappedDonorDashboard;
