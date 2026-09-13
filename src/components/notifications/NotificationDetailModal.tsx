import React from "react";
import Modal from "../common/Modal";
import type { NotificationItem } from "../../types/auth";
import { formatDateTime } from "../../utils/dateUtils";
import { resolveNotificationRoute } from "../../utils/notificationUtils";
import {
  FaBell,
  FaCalendarAlt,
  FaCheckCircle,
  FaEnvelopeOpen,
  FaExternalLinkAlt,
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
  FaInfoCircle,
} from "react-icons/fa";

interface NotificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: NotificationItem | null;
  onNavigateToEntity?: (route: string) => void;
  onMarkAsRead?: (id: string) => void;
}

const typeIconMap: Record<string, React.ReactNode> = {
  emergency: <FaExclamationTriangle />,
  rescue: <FaAmbulance />,
  shelter: <FaBuilding />,
  shelter_transfer: <FaBuilding />,
  transfer_requested: <FaBuilding />,
  placement_requested: <FaBuilding />,
  lost_found: <FaPaw />,
  lost_pet_alert: <FaPaw />,
  medical: <FaStethoscope />,
  medical_reminder: <FaStethoscope />,
  adoption: <FaHeart />,
  volunteer: <FaUsers />,
  user_created: <FaUserPlus />,
  user_updated: <FaUserPlus />,
  user_deleted: <FaUserPlus />,
  shelter_added: <FaBuilding />,
  animal_registered: <FaPaw />,
  animal_updated: <FaPaw />,
  inventory_changed: <FaBoxOpen />,
  inventory_alert: <FaBoxOpen />,
  certificate_generated: <FaCertificate />,
  finance_action: <FaDollarSign />,
  role_permission_changed: <FaLock />,
};

const getCategoryColor = (type?: string): string => {
  const t = String(type || "").toLowerCase();
  if (/emergency|rejected|deleted/.test(t)) return "#DC2626";
  if (/rescue|located|dispatched|secured|admitted/.test(t)) return "#1E3A8A";
  if (/medical|animal/.test(t)) return "#1E3A8A";
  if (/adoption|approved|certificate/.test(t)) return "#1E3A8A";
  if (/volunteer/.test(t)) return "#F59E0B";
  if (/finance/.test(t)) return "#16A34A";
  if (/shelter|inventory|user|role|transfer|placement/.test(t)) return "#1E3A8A";
  if (/lost/.test(t)) return "#F59E0B";
  return "#64748B";
};

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  isOpen,
  onClose,
  notification,
  onNavigateToEntity,
  onMarkAsRead,
}) => {
  if (!notification) return null;

  const { route: resolvedRoute, isValid: hasValidRoute } = resolveNotificationRoute(notification);
  const color = getCategoryColor(notification.type);
  const notifData = notification.data || {};

  const handleNavigate = () => {
    if (hasValidRoute && resolvedRoute && onNavigateToEntity) {
      onNavigateToEntity(resolvedRoute);
      onClose();
    }
  };

  const formattedTime = formatDateTime(notification.created_at || notification.time);

  // Extract extra data entries to show in metadata section
  const metadataEntries = Object.entries(notifData).filter(
    ([key, value]) =>
      key !== "action_url" &&
      value !== null &&
      value !== undefined &&
      typeof value !== "object"
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notification Information">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header Header Info Card */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            padding: "16px",
            borderRadius: "12px",
            background: `${color}0A`,
            border: `1px solid ${color}30`,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              background: `${color}18`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {typeIconMap[notification.type] ?? <FaBell />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: color,
                  color: "#FFF",
                  letterSpacing: "0.5px",
                }}
              >
                {notification.type.replace(/_/g, " ")}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: notification.read ? "#F1F5F9" : "#DBEAFE",
                  color: notification.read ? "#64748B" : "#1E3A8A",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {notification.read ? (
                  <>
                    <FaCheckCircle size={10} /> Read
                  </>
                ) : (
                  <>
                    <FaEnvelopeOpen size={10} /> Unread
                  </>
                )}
              </span>
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
              {notification.title}
            </h3>
          </div>
        </div>

        {/* Timestamp & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#64748B" }}>
          <FaCalendarAlt size={12} />
          <span>Received: </span>
          <strong style={{ color: "#334155" }}>{formattedTime}</strong>
        </div>

        {/* Notification Body / Message */}
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            fontSize: "14px",
            color: "#334155",
            lineHeight: 1.6,
            wordBreak: "break-word",
          }}
        >
          {notification.message || (notification as any).body || "No additional text content provided."}
        </div>

        {/* Fallback Banner if Target Entity / Route is Unavailable */}
        {!hasValidRoute && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              color: "#92400E",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FaInfoCircle size={18} style={{ flexShrink: 0, color: "#D97706" }} />
            <div>
              <div style={{ fontWeight: 700 }}>Notification details are recorded above.</div>
              <div style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>
                Direct entity navigation is unavailable or the related record is no longer accessible.
              </div>
            </div>
          </div>
        )}

        {/* Metadata Details (if present) */}
        {metadataEntries.length > 0 && (
          <div
            style={{
              background: "#F1F5F9",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "12.5px",
            }}
          >
            <div style={{ fontWeight: 700, color: "#475569", marginBottom: "8px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
              Related Metadata Parameters
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {metadataEntries.map(([k, v]) => (
                <div key={k} style={{ background: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                  <span style={{ color: "#64748B", display: "block", fontSize: "11px" }}>{k.replace(/_/g, " ")}:</span>
                  <strong style={{ color: "#0F172A", wordBreak: "break-all" }}>{String(v)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          {!notification.read && onMarkAsRead && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#2563EB",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaEnvelopeOpen size={12} /> Mark as Read
            </button>
          )}

          {hasValidRoute && resolvedRoute && onNavigateToEntity && (
            <button
              type="button"
              onClick={handleNavigate}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#1E3A8A",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaExternalLinkAlt size={12} /> Go to Related Record ({resolvedRoute.replace("/", "").replace(/-/g, " ")})
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#475569",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default NotificationDetailModal;
