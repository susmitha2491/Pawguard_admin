import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheckDouble, FaExclamationTriangle, FaStethoscope, FaHeart, FaUserCheck, FaSpinner, FaTimesCircle } from "react-icons/fa";
import useNotifications from "../../hooks/useNotifications";
import type { NotificationItem } from "../../types/auth";
import { formatDateTime } from "../../utils/dateUtils";

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Use the notifications hook with auto-refresh every 30 seconds
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useNotifications({ autoRefresh: true, refreshInterval: 30000 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      void markAsRead(item.id);
    }
    setIsOpen(false);
    const targetUrl = item.data?.action_url || (item as any).action_url;
    if (targetUrl) {
      navigate(targetUrl);
    } else if (item.type === "medical") {
      navigate("/veterinarian-dashboard?tab=shelter_requests");
    } else if (item.type === "adoption") {
      navigate("/adoptions");
    } else if ((item.type as string) === "shelter") {
      navigate("/shelter-dogs");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(notificationId);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "emergency":
        return <FaExclamationTriangle style={{ color: "#DC2626" }} />;
      case "medical":
      case "medical_updated":
        return <FaStethoscope style={{ color: "#1E3A8A" }} />;
      case "adoption":
      case "adoption_submitted":
      case "adoption_approved":
      case "adoption_rejected":
        return <FaHeart style={{ color: "#F59E0B" }} />;
      case "volunteer":
        return <FaUserCheck style={{ color: "#16A34A" }} />;
      case "system":
      case "user_created":
      case "user_updated":
      case "user_deleted":
      case "shelter_added":
      case "animal_registered":
      case "animal_updated":
      case "inventory_changed":
      case "certificate_generated":
      case "finance_action":
      case "role_permission_changed":
        return <FaBell style={{ color: "#1E3A8A" }} />;
      default:
        return <FaBell style={{ color: "#1E3A8A" }} />;
    }
  };

  const formatTime = (notification: NotificationItem): string => {
    return formatDateTime(notification.created_at || notification.time);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          transition: "all 0.2s ease",
          cursor: "pointer",
          padding: 0,
        }}
        title="Notifications"
      >
        {loading ? (
          <FaSpinner size={18} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <>
            <FaBell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "2px 6px",
                  lineHeight: 1,
                  boxShadow: "0 0 0 2px #FFFFFF",
                  minWidth: "20px",
                  textAlign: "center",
                }}
              >
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: "-90px",
            width: "380px",
            maxWidth: "calc(100vw - 24px)",
            background: "#FFFFFF",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #E2E8F0",
            zIndex: 1000,
            overflow: "hidden",
            boxSizing: "border-box",
            animation: "slideDown 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span style={{ background: "#EFF6FF", color: "#1E3A8A", fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px" }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && !loading && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent",
                  color: "#1E3A8A",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.color = "#1E3A8A";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.color = "#1E3A8A";
                }}
              >
                <FaCheckDouble size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div style={{ maxHeight: "320px", overflowY: "auto", overflowX: "hidden" }}>
            {loading && !notifications.length ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#94A3B8" }}>
                <FaSpinner size={20} style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
                <p style={{ margin: 0 }}>Loading notifications...</p>
              </div>
            ) : error ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <FaTimesCircle size={24} style={{ color: "#DC2626", marginBottom: "12px" }} />
                <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>
                  Failed to load
                </p>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#94A3B8" }}>
                  {error}
                </p>
                <button
                  onClick={refresh}
                  style={{
                    background: "#1E3A8A",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.background = "#1E3A8A";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.background = "#1E3A8A";
                  }}
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#94A3B8" }}>
                <FaBell size={20} style={{ opacity: 0.5, marginBottom: "8px" }} />
                <p style={{ margin: 0 }}>No notifications</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px" }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #F1F5F9",
                    background: item.read ? "#FFFFFF" : "#EFF6FF",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    transition: "background 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!item.read) {
                      (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.read) {
                      (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF";
                    }
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: "#F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getIcon(item.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: "11px", color: "#94A3B8", flexShrink: 0 }}>
                        {formatTime(item)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748B", lineHeight: 1.4, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {item.message}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNotification(e, item.id)}
                    style={{
                      background: "transparent",
                      color: "#94A3B8",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px",
                      transition: "color 0.2s ease",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#DC2626";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
                    }}
                    title="Delete notification"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #F1F5F9",
                background: "#F8FAFC",
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <button
                onClick={refresh}
                style={{
                  background: "transparent",
                  color: "#1E3A8A",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#EFF6FF";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = "transparent";
                }}
              >
                Refresh
              </button>
              <span style={{ color: "#CBD5E1" }}>|</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate("/notifications");
                }}
                style={{
                  background: "transparent",
                  color: "#1E3A8A",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#EFF6FF";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = "transparent";
                }}
              >
                View all
              </button>
            </div>
          )}
        </div>
      )}

      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default NotificationDropdown;
