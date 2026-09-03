import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaExclamationTriangle,
  FaStethoscope,
  FaHeart,
  FaUsers,
  FaUserPlus,
  FaBuilding,
  FaPaw,
  FaBoxOpen,
  FaCertificate,
  FaDollarSign,
  FaLock,
  FaAmbulance,
} from "react-icons/fa";
import { useNotifications } from "../../hooks/useNotifications";
import DashboardSkeleton from "./DashboardSkeleton";
import { formatDateTime } from "../../utils/dateUtils";

const typeIcon: Record<string, React.ReactNode> = {
  emergency: <FaExclamationTriangle />,
  rescue: <FaAmbulance />,
  shelter: <FaBuilding />,
  shelter_transfer: <FaBuilding />,
  transfer_requested: <FaBuilding />,
  placement_requested: <FaBuilding />,
  lost_found: <FaPaw />,
  lost_pet_alert: <FaPaw />,
  medical: <FaStethoscope />,
  adoption: <FaHeart />,
  volunteer: <FaUsers />,
  user_created: <FaUserPlus />,
  user_updated: <FaUserPlus />,
  user_deleted: <FaUserPlus />,
  shelter_added: <FaBuilding />,
  animal_registered: <FaPaw />,
  animal_updated: <FaPaw />,
  inventory_changed: <FaBoxOpen />,
  certificate_generated: <FaCertificate />,
  finance_action: <FaDollarSign />,
  role_permission_changed: <FaLock />,
};

const typeColor = (type: string): string => {
  if (/emergency|rejected|deleted/.test(type)) return "#DC2626";
  if (/rescue|located|dispatched|secured|admitted/.test(type)) return "#1E3A8A";
  if (/medical|animal/.test(type)) return "#1E3A8A";
  if (/adoption|approved|certificate/.test(type)) return "#1E3A8A";
  if (/volunteer/.test(type)) return "#F59E0B";
  if (/finance/.test(type)) return "#16A34A";
  if (/shelter|inventory|user|role|transfer|placement/.test(type)) return "#1E3A8A";
  if (/lost/.test(type)) return "#F59E0B";
  return "#64748B";
};

const DashboardNotificationsPanel = () => {
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const recent = notifications.slice(0, 5);

  const handleOpen = async (id: string) => {
    try {
      await markAsRead(id);
    } catch {
      /* ignore */
    }
  };

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
            Notifications
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#94A3B8" }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => {
              markAllAsRead().catch(() => undefined);
            }}
            style={{
              border: "none",
              background: "#EFF6FF",
              color: "#1E3A8A",
              fontSize: "11.5px",
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: "4px" }}>
        {loading ? (
          <DashboardSkeleton rows={3} />
        ) : recent.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
            <FaBell size={26} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No notifications yet</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleOpen(n.id)}
                  style={{
                    display: "flex",
                    gap: 12,
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: n.read ? "transparent" : "#EFF6FF",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F1F5F9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = n.read ? "transparent" : "#EFF6FF";
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `${typeColor(n.type)}15`,
                      color: typeColor(n.type),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {typeIcon[n.type] ?? <FaBell />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0F172A" }}>{n.title}</span>
                      {!n.read && (
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E3A8A", flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    {(n.created_at || n.time) && (
                      <span style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                        {formatDateTime(n.created_at || n.time)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={() => navigate("/notifications")}
          style={{
            flex: 1,
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            color: "#1E3A8A",
            fontWeight: 600,
            fontSize: "12.5px",
            padding: "9px 12px",
            borderRadius: "9px",
            cursor: "pointer",
          }}
        >
          View all notifications
        </button>
        <button
          onClick={() => navigate("/notifications?action=send")}
          style={{
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            color: "#64748B",
            fontWeight: 600,
            fontSize: "12.5px",
            padding: "9px 12px",
            borderRadius: "9px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default DashboardNotificationsPanel;
