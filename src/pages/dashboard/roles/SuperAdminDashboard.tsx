import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaPaw,
  FaBuilding,
  FaTruckMedical,
  FaHeart,
  FaHouse,
  FaHandsHolding,
  FaIndianRupeeSign,
  FaMagnifyingGlass,
} from "react-icons/fa6";
import { FaRegClock, FaShieldAlt, FaSync } from "react-icons/fa";
import useExecutiveDashboard from "../../../hooks/useExecutiveDashboard";
import ExecutiveSummaryCard from "../../../components/dashboard/ExecutiveSummaryCard";
import DashboardSectionHeader from "../../../components/dashboard/DashboardSectionHeader";
import DashboardSkeleton from "../../../components/dashboard/DashboardSkeleton";
import QuickActions from "../../../components/dashboard/QuickActions";
import SystemAlerts from "../../../components/dashboard/SystemAlerts";
import DashboardNotificationsPanel from "../../../components/dashboard/DashboardNotificationsPanel";
import RecentActivitiesPanel from "../../../components/dashboard/RecentActivitiesPanel";
import DashboardNavigationCards from "../../../components/dashboard/DashboardNavigationCards";
import { getCurrentUser, getCurrentUserRole, getRoleTitle } from "../../../utils/roleUtils";
import { formatDateTime } from "../../../utils/dateUtils";

const AnalyticsCharts = lazy(() => import("../../../components/dashboard/AnalyticsCharts"));

const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

interface AdminDashboardSummaryResponse {
  users?: {
    total_users?: number;
    active_users?: number;
    verified_users?: number;
  };
  dogs?: {
    total_dogs?: number;
    adoptable_dogs?: number;
    by_status?: Record<string, number>;
  };
  rescues?: {
    total?: number;
    by_status?: Record<string, number>;
  };
  adoptions?: {
    pending?: number;
    by_status?: Record<string, number>;
    adoption_rate_pct?: number;
  };
  donations?: {
    total_donations?: number;
    total_raised?: number;
  };
  shelters?: {
    capacity?: number;
    occupied?: number;
    occupancy_pct?: number;
  };
  volunteers?: {
    total?: number;
    by_status?: Record<string, number>;
    hours_logged?: number;
  };
  grievances?: {
    open?: number;
    by_status?: Record<string, number>;
  };
  lost_found?: {
    active_lost?: number;
    active_found?: number;
  };
  notifications?: {
    unread?: number;
    total?: number;
  };
  fosters?: {
    total_fosters?: number;
    available?: number;
    active_placements?: number;
  };
}

const formatByStatus = (byStatus?: Record<string, number>): string => {
  if (!byStatus || typeof byStatus !== "object") return "";
  const entries = Object.entries(byStatus).filter(([_, count]) => typeof count === "number");
  if (entries.length === 0) return "";
  return entries.map(([status, count]) => `${count} ${status.replace(/_/g, " ")}`).join(" · ");
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const {
    summary,
    users,
    shelters,
    rescues,
    adoptions,
    volunteers,
    donations,
    inventory,
    medical,
    finance,
    activities,
    loading,
    error,
    lastUpdated,
    refreshing,
    refresh,
  } = useExecutiveDashboard();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const user = getCurrentUser();
  const displayName = user?.name || "Administrator";
  const roleTitle = getRoleTitle(getCurrentUserRole() ?? "super_admin");

  const summaryData = (summary ?? {}) as AdminDashboardSummaryResponse;

  // 1. Users
  const totalUsers = summaryData.users?.total_users ?? 0;
  const activeUsers = summaryData.users?.active_users ?? 0;
  const verifiedUsers = summaryData.users?.verified_users ?? 0;

  // 2. Dogs
  const totalDogs = summaryData.dogs?.total_dogs ?? 0;
  const adoptableDogs = summaryData.dogs?.adoptable_dogs ?? 0;
  const dogStatusBreakdown = formatByStatus(summaryData.dogs?.by_status);

  // 3. Rescues
  const totalRescues = summaryData.rescues?.total ?? 0;
  const rescueStatusBreakdown = formatByStatus(summaryData.rescues?.by_status);

  // 4. Adopted Dogs (Authoritative count from dogs registry status breakdown)
  const adoptedDogsCount = summaryData.dogs?.by_status?.adopted ?? 0;

  // 5. Shelter Capacity
  const shelterCapacity = summaryData.shelters?.capacity ?? 0;
  const shelterOccupied = summaryData.shelters?.occupied ?? 0;
  const shelterOccupancyPct = summaryData.shelters?.occupancy_pct ?? 0;

  // 6. Foster Families
  const totalFosterFamilies = summaryData.fosters?.total_fosters ?? 0;
  const availableFosterFamilies = summaryData.fosters?.available ?? 0;
  const activeFosterPlacements = summaryData.fosters?.active_placements ?? 0;

  // 7. Volunteers
  const totalVolunteers = summaryData.volunteers?.total ?? 0;
  const activeVolunteers = summaryData.volunteers?.by_status?.active ?? 0;
  const volunteerStatusBreakdown = formatByStatus(summaryData.volunteers?.by_status);
  const volunteerHoursLogged = summaryData.volunteers?.hours_logged ?? 0;

  // 8. Lost & Found
  const activeLost = summaryData.lost_found?.active_lost ?? 0;
  const activeFound = summaryData.lost_found?.active_found ?? 0;
  const totalLostFound = activeLost + activeFound;

  // 9. Donations
  const totalDonationsCount = summaryData.donations?.total_donations ?? 0;
  const totalRaisedAmount = summaryData.donations?.total_raised ?? 0;

  const kpis = [
    {
      title: "Total Users",
      value: totalUsers,
      subtitle: `${activeUsers} active · ${verifiedUsers} verified`,
      icon: <FaUsers />,
      color: "#1E3A8A",
      path: "/users",
    },
    {
      title: "Total Dogs",
      value: totalDogs,
      subtitle: `${adoptableDogs} adoptable${dogStatusBreakdown ? ` · ${dogStatusBreakdown}` : ""}`,
      icon: <FaPaw />,
      color: "#15803D",
      path: "/pets",
    },
    {
      title: "Total Rescues",
      value: totalRescues,
      subtitle: rescueStatusBreakdown || `${totalRescues} total rescues`,
      icon: <FaTruckMedical />,
      color: totalRescues > 0 ? "#DC2626" : "#1E3A8A",
      path: "/rescue-requests",
    },
    {
      title: "Adopted Dogs",
      value: adoptedDogsCount,
      subtitle: `${adoptedDogsCount} adopted dogs`,
      icon: <FaHeart />,
      color: "#15803D",
      path: "/adoptions",
    },
    {
      title: "Shelter Capacity",
      value: `${shelterOccupied} / ${shelterCapacity}`,
      subtitle: `${shelterOccupied} occupied · ${shelterOccupancyPct}% occupancy`,
      icon: <FaBuilding />,
      color: "#4F46E5",
      path: "/shelters",
    },
    {
      title: "Foster Families",
      value: totalFosterFamilies,
      subtitle: `${availableFosterFamilies} available · ${activeFosterPlacements} active placements`,
      icon: <FaHouse />,
      color: "#8B5CF6",
      path: "/fosters",
    },
    {
      title: "Total Volunteers",
      value: totalVolunteers,
      subtitle: `${volunteerStatusBreakdown || `${activeVolunteers} active`} · ${volunteerHoursLogged} hrs logged`,
      icon: <FaHandsHolding />,
      color: "#0284C7",
      path: "/volunteers",
    },
    {
      title: "Lost & Found",
      value: totalLostFound,
      subtitle: `${activeLost} active lost · ${activeFound} active found`,
      icon: <FaMagnifyingGlass />,
      color: "#EA580C",
      path: "/lost-and-found",
    },
    {
      title: "Donations",
      value: formatINR(totalRaisedAmount),
      subtitle: `${totalDonationsCount} total donations`,
      icon: <FaIndianRupeeSign />,
      color: "#0D9488",
      path: "/finance",
    },
  ];

  return (
    <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Welcome back, {displayName}</h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34D399",
                  border: "1px solid rgba(52, 211, 153, 0.4)",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <FaShieldAlt size={10} /> {roleTitle}
              </span>
            </div>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "13.5px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <FaRegClock />
              {formatDateTime(now)}
              {lastUpdated && (
                <>
                  {" · Last updated "}
                  {formatDateTime(lastUpdated)}
                </>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => refresh()}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: "#334155",
                color: "#FFF",
                border: "none",
                padding: "9px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.7 : 1,
              }}
            >
              <FaSync className={refreshing ? "dash-spin" : undefined} />
              {refreshing ? "Refreshing..." : "Refresh Summary"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            borderRadius: "10px",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#92400E",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "14px",
          marginBottom: "28px",
        }}
      >
        {kpis.map((kpi) => (
          <ExecutiveSummaryCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
            color={kpi.color}
            path={kpi.path}
            loading={loading}
          />
        ))}
      </div>

      <div style={{ marginBottom: "28px" }}>
        <DashboardSectionHeader
          title="Quick Actions"
          subtitle="Frequently used operations"
        />
        <QuickActions />
      </div>

      <div style={{ marginBottom: "28px" }}>
        <DashboardSectionHeader
          title="System Alerts"
          subtitle="Items that need your attention"
          actionLabel="View audit logs"
          actionIcon={<FaShieldAlt />}
          onAction={() => navigate("/audit-logs")}
        />
        <SystemAlerts
          inventory={inventory}
          medical={medical}
          shelters={shelters}
          rescues={rescues}
          finance={finance}
          adoptions={adoptions}
          volunteers={volunteers}
        />
      </div>

      <div style={{ marginBottom: "28px", width: "100%", minWidth: 0 }}>
        <DashboardSectionHeader
          title="Analytics"
          subtitle="Live operational insights across the platform"
        />
        <Suspense fallback={<DashboardSkeleton rows={4} />}>
          <AnalyticsCharts
            adoptions={adoptions}
            rescues={rescues}
            finance={finance}
            donations={donations}
            inventory={inventory}
            medical={medical}
            shelters={shelters}
            users={users}
            loading={loading}
          />
        </Suspense>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <DashboardSectionHeader
          title="Explore Modules"
          subtitle="Quick access shortcuts to frequently used operational areas"
        />
        <DashboardNavigationCards />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
          alignItems: "stretch",
        }}
      >
        <DashboardNotificationsPanel />
        <RecentActivitiesPanel activities={activities} loading={loading} />
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
