import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaEnvelopeOpen,
  FaTrash,
  FaPaperPlane,
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
import { useToast } from "../../context/ToastContext";
import SendNotificationModal from "../../components/notifications/SendNotificationModal";
import NotificationDetailModal from "../../components/notifications/NotificationDetailModal";
import { formatDateTime } from "../../utils/dateUtils";
import type { NotificationItem } from "../../types/auth";

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
  if (/emergency|rejected|deleted/.test(type)) return "#EF4444";
  if (/rescue|located|dispatched|secured|admitted/.test(type)) return "#7C3AED";
  if (/medical|animal/.test(type)) return "#06B6D4";
  if (/adoption|approved|certificate/.test(type)) return "#EC4899";
  if (/volunteer/.test(type)) return "#F59E0B";
  if (/finance/.test(type)) return "#10B981";
  if (/shelter|inventory|user|role|transfer|placement/.test(type)) return "#2563EB";
  if (/lost/.test(type)) return "#F59E0B";
  return "#64748B";
};

const Notifications = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [isSendModalOpen, setIsSendModalOpen] = useState(() => searchParams.get("action") === "send");
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { addToast } = useToast();

  // Inbox Notifications state
  const {
    notifications,
    loading: inboxLoading,
    error: inboxError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({ autoRefresh: true, refreshInterval: 30000 });

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (searchParams.get("action") === "send") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const notifId = searchParams.get("id");
    if (notifId && notifications.length > 0) {
      const match = notifications.find((n) => n.id === notifId);
      if (match) {
        setSelectedNotification(match);
        setIsDetailModalOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [searchParams, notifications]);

  // Handle Inbox Notification Actions
  const handleOpenInboxItem = async (n: NotificationItem) => {
    try {
      if (!n.read) {
        await markAsRead(n.id);
      }
    } catch {
      /* ignore mark error */
    }
    setSelectedNotification(n);
    setIsDetailModalOpen(true);
  };

  const handleNavigateToEntity = (route: string) => {
    navigate(route);
  };

  const handleDeleteInboxItem = async (id: string) => {
    try {
      await deleteNotification(id);
      addToast("Notification removed", "success");
    } catch {
      addToast("Failed to remove notification", "error");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      addToast("All notifications marked as read", "success");
    } catch {
      addToast("Failed to update notifications", "error");
    }
  };

  return (
    <div>
      {/* Banner Header */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Notifications</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          {unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.`
            : "You're all caught up."}
        </p>
      </div>

      {/* Action Controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            borderRadius: "9px",
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            color: unreadCount === 0 ? "#CBD5E1" : "#2563EB",
            fontWeight: 600,
            fontSize: "13px",
            cursor: unreadCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          <FaEnvelopeOpen /> Mark all read
        </button>
        <button
          onClick={() => setIsSendModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            borderRadius: "9px",
            border: "none",
            background: "#2563EB",
            color: "#FFF",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          <FaPaperPlane /> Send Notification
        </button>
      </div>

      {inboxError && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "10px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", fontSize: "13px" }}>
          {inboxError}
        </div>
      )}

      {/* Operational Notification Inbox */}
      <div className="soft-card" style={{ padding: "20px" }}>
        {inboxLoading ? (
          <p style={{ color: "#64748B", textAlign: "center", padding: "30px 0" }}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
            <FaBell size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: "15px" }}>No notifications yet</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {notifications.map((n) => {
              const color = typeColor(n.type);
              return (
                <li
                  key={n.id}
                  onClick={() => handleOpenInboxItem(n)}
                  style={{
                    display: "flex",
                    gap: "14px",
                    alignItems: "flex-start",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: n.read ? "#F8FAFC" : "#EFF6FF",
                    border: `1px solid ${n.read ? "#E2E8F0" : "#BFDBFE"}`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "11px",
                      background: `${color}15`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {typeIcon[n.type] ?? <FaBell />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{n.title}</span>
                      {!n.read && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#2563EB", color: "#FFF", flexShrink: 0 }}>
                          New
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                      {n.message || (n as any).body}
                    </div>
                    {(n.created_at || n.time) && (
                      <span style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "4px", display: "inline-block" }}>
                        {formatDateTime(n.created_at || n.time)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenInboxItem(n); }}
                        title="Mark as read & open"
                        style={{ border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#2563EB", padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: 13 }}
                      >
                        <FaEnvelopeOpen />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteInboxItem(n.id); }}
                      title="Delete"
                      style={{ border: "1px solid #FECACA", background: "#FEF2F2", color: "#EF4444", padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: 13 }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Send Notification Modal */}
      <SendNotificationModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} />

      {/* Notification Detail Modal */}
      <NotificationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        notification={selectedNotification}
        onNavigateToEntity={handleNavigateToEntity}
        onMarkAsRead={async (id) => {
          try {
            await markAsRead(id);
            if (selectedNotification && selectedNotification.id === id) {
              setSelectedNotification({ ...selectedNotification, read: true });
            }
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
};

export default Notifications;
