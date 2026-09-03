import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaTruckMedical,
  FaBuilding,
  FaStethoscope,
  FaHeart,
  FaHouse,
  FaHandsHolding,
  FaBoxOpen,
  FaDollarSign,
  FaCar,
  FaClipboardList,
  FaGear,
  FaShieldHalved,
  FaListCheck,
} from "react-icons/fa6";
import { FaClock } from "react-icons/fa";
import DashboardSectionHeader from "./DashboardSectionHeader";
import DashboardSkeleton from "./DashboardSkeleton";
import type { ActivityEntry } from "../../types/dashboard";
import { formatDateTime } from "../../utils/dateUtils";

interface RecentActivitiesPanelProps {
  activities: ActivityEntry[];
  loading?: boolean;
}

const moduleColor = (module: string): string => {
  const m = module.toLowerCase();
  if (/user|admin|role|permission/.test(m)) return "#1E3A8A";
  if (/rescue|dispatch/.test(m)) return "#DC2626";
  if (/shelter|kennel|facility/.test(m)) return "#1E3A8A";
  if (/medical|vet|vaccin|exam/.test(m)) return "#1E3A8A";
  if (/adoption/.test(m)) return "#1E3A8A";
  if (/foster/.test(m)) return "#16A34A";
  if (/volunteer|shift/.test(m)) return "#F59E0B";
  if (/inventory|stock/.test(m)) return "#F97316";
  if (/finance|donation|payment/.test(m)) return "#1E3A8A";
  if (/vehicle|car/.test(m)) return "#64748B";
  if (/certificate/.test(m)) return "#F59E0B";
  if (/audit|log/.test(m)) return "#64748B";
  return "#64748B";
};

const moduleIcon = (module: string): React.ReactNode => {
  const m = module.toLowerCase();
  if (/user|admin|role|permission/.test(m)) return <FaUser />;
  if (/rescue|dispatch/.test(m)) return <FaTruckMedical />;
  if (/shelter|kennel|facility/.test(m)) return <FaBuilding />;
  if (/medical|vet|vaccin|exam/.test(m)) return <FaStethoscope />;
  if (/adoption/.test(m)) return <FaHeart />;
  if (/foster/.test(m)) return <FaHouse />;
  if (/volunteer|shift/.test(m)) return <FaHandsHolding />;
  if (/inventory|stock/.test(m)) return <FaBoxOpen />;
  if (/finance|donation|payment/.test(m)) return <FaDollarSign />;
  if (/vehicle|car/.test(m)) return <FaCar />;
  if (/certificate/.test(m)) return <FaClipboardList />;
  if (/audit|log/.test(m)) return <FaListCheck />;
  if (/settings/.test(m)) return <FaGear />;
  if (/security/.test(m)) return <FaShieldHalved />;
  return <FaListCheck />;
};

const statusColor = (status: string): string => {
  const s = status.toLowerCase();
  if (/success|approved|completed|resolved|created/.test(s)) return "#16A34A";
  if (/pending|in progress|assigned/.test(s)) return "#F59E0B";
  if (/failed|rejected|deleted|cancelled/.test(s)) return "#DC2626";
  return "#64748B";
};

const RecentActivitiesPanel = ({ activities, loading }: RecentActivitiesPanelProps) => {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        display: "flex",
        flexDirection: "column",
        height: "440px",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <DashboardSectionHeader
          title="Recent Activities"
          subtitle="Latest platform-wide activity"
          actionLabel="View all logs"
          onAction={() => navigate("/audit-logs")}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: "4px" }}>
        {loading ? (
          <DashboardSkeleton rows={6} />
        ) : activities.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
            <FaListCheck size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No recent activity recorded</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {activities.slice(0, 15).map((a) => {
              const color = moduleColor(a.module);
              return (
                <li
                  key={String(a.id)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "9px 8px",
                    borderRadius: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `${color}15`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {moduleIcon(a.module)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, color: "#0F172A", lineHeight: 1.35 }}>
                      {a.action}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748B" }}>
                      {a.user} · {a.module}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: "10.5px", color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <FaClock size={9} />
                        {formatDateTime(a.time)}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: `${statusColor(a.status)}15`,
                          color: statusColor(a.status),
                        }}
                      >
                        {a.status}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RecentActivitiesPanel;
