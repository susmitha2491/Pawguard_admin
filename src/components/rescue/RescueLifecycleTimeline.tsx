import React from "react";
import { rescueStatusBadge } from "../../utils/rescueStatus.tsx";
import { formatDateTime } from "../../utils/dateUtils";
import {
  FaCheck,
  FaClock,
  FaExclamationTriangle,
  FaAmbulance,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaHospital,
  FaClipboardCheck,
} from "react-icons/fa";

export interface RescueLifecycleTimelineProps {
  rescue: Record<string, unknown> | null;
  compact?: boolean;
}

export const RescueLifecycleTimeline: React.FC<RescueLifecycleTimelineProps> = ({
  rescue,
  compact = false,
}) => {
  if (!rescue) return null;

  const rawItem = (rescue.raw || rescue.rawItem || rescue) as Record<string, unknown>;
  const dispatchObj = (rescue.dispatch || rawItem.dispatch) as Record<string, unknown> | null;

  const rawStatus = String(rawItem.status || rescue.status || "").toLowerCase();
  const dispatchStatus = String(dispatchObj?.status || "").toLowerCase();

  const statusPriority: Record<string, number> = {
    submitted: 1,
    reported: 1,
    new: 1,
    pending: 1,
    awaiting_triage: 1,
    verified: 2,
    dispatched: 3,
    accepted: 4,
    en_route: 5,
    in_progress: 5,
    located: 6,
    secured: 7,
    rescued: 7,
    admitted: 8,
    completed: 9,
    rejected: 0,
    cancelled: 0,
  };

  const reqP = statusPriority[rawStatus] || 0;
  const disP = statusPriority[dispatchStatus] || 0;
  const effectivePriority = Math.max(reqP, disP);

  const isRejected =
    rawStatus === "rejected" ||
    rawStatus === "cancelled" ||
    dispatchStatus === "rejected" ||
    dispatchStatus === "cancelled";

  // Extract Timestamps safely
  const createdAt = (rescue.created_at || rawItem.created_at) as string | undefined;
  const dispatchedAt = (rescue.dispatched_at || rawItem.dispatched_at || dispatchObj?.dispatched_at) as string | undefined;
  const enRouteAt = (rescue.en_route_at || rawItem.en_route_at || dispatchObj?.en_route_at) as string | undefined;
  const locatedAt = (rescue.located_at || rawItem.located_at || dispatchObj?.located_at) as string | undefined;
  const rescuedAt = (rescue.rescued_at || rawItem.rescued_at || dispatchObj?.rescued_at || rawItem.secured_at) as string | undefined;
  const admittedAt = (rescue.admitted_at || rawItem.admitted_at || dispatchObj?.admitted_at) as string | undefined;
  const updatedAt = (rescue.updated_at || rawItem.updated_at) as string | undefined;

  const assignedAgent =
    rescue.assigned_agent_name ||
    rescue.dispatch_agents ||
    dispatchObj?.assigned_driver_id ||
    rawItem.assigned_agent_id;
  const assignedVehicle =
    rescue.assigned_vehicle_number ||
    rescue.dispatch_vehicle ||
    dispatchObj?.vehicle_id ||
    rawItem.assigned_vehicle_id;
  const hasDispatch = Boolean(dispatchObj || assignedAgent || assignedVehicle);

  const stages = [
    {
      id: "reported",
      title: "Reported",
      subtitle: "Incident Submitted",
      icon: <FaClock size={11} />,
      done: true,
      time: createdAt ? formatDateTime(createdAt) : "-",
    },
    {
      id: "verified",
      title: "Verified",
      subtitle: "Coordinator Triage",
      icon: <FaClipboardCheck size={11} />,
      done: effectivePriority >= 2,
      time: effectivePriority >= 2 ? (updatedAt ? formatDateTime(updatedAt) : createdAt ? formatDateTime(createdAt) : "-") : "-",
    },
    {
      id: "dispatched",
      title: "Dispatched",
      subtitle: "Team & Vehicle Assigned",
      icon: <FaAmbulance size={11} />,
      done: hasDispatch || effectivePriority >= 3,
      time: dispatchedAt ? formatDateTime(dispatchedAt) : "-",
    },
    {
      id: "en_route",
      title: "En Route",
      subtitle: "Agent In Transit",
      icon: <FaAmbulance size={11} />,
      done: effectivePriority >= 5,
      time: enRouteAt ? formatDateTime(enRouteAt) : (dispatchedAt ? formatDateTime(dispatchedAt) : "-"),
    },
    {
      id: "located",
      title: "Located",
      subtitle: "Animal Found",
      icon: <FaMapMarkerAlt size={11} />,
      done: Boolean(locatedAt && locatedAt !== "-") || effectivePriority >= 6,
      time: locatedAt ? formatDateTime(locatedAt) : "-",
    },
    {
      id: "secured",
      title: "Secured",
      subtitle: "Animal Rescued",
      icon: <FaShieldAlt size={11} />,
      done: Boolean(rescuedAt && rescuedAt !== "-") || effectivePriority >= 7,
      time: rescuedAt ? formatDateTime(rescuedAt) : locatedAt ? formatDateTime(locatedAt) : "-",
    },
    {
      id: "admitted",
      title: "Admitted",
      subtitle: "Shelter Intake",
      icon: <FaHospital size={11} />,
      done: Boolean(admittedAt && admittedAt !== "-") || effectivePriority >= 8,
      time: admittedAt ? formatDateTime(admittedAt) : "-",
    },
  ];

  let activeIndex = stages.findIndex((s) => !s.done);
  if (activeIndex === -1) {
    activeIndex = stages.length - 1;
  }

  const activeStage = stages[activeIndex];

  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: "12px",
        border: "1px solid #E2E8F0",
        padding: compact ? "12px" : "16px",
        marginBottom: "16px",
      }}
    >
      {/* Header / Summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <strong style={{ fontSize: "14px", color: "#0F172A" }}>
            Rescue Case Lifecycle Tracking
          </strong>
          {rescueStatusBadge(rawStatus)}
        </div>

        {isRejected ? (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#FEF2F2",
              color: "#DC2626",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaExclamationTriangle size={11} /> Case Closed / Rejected
          </span>
        ) : (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#EFF6FF",
              color: "#1E40AF",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #BFDBFE",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#2563EB",
                display: "inline-block",
              }}
            />
            Active Stage: {activeStage?.title || "Monitoring"}
          </span>
        )}
      </div>

      {/* Horizontal Stepper Flow */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          position: "relative",
          marginBottom: "14px",
        }}
      >
        {stages.map((stage, idx) => {
          const isDone = stage.done && !isRejected;
          const isActive = idx === activeIndex && !isRejected;

          let circleBg = "#E2E8F0";
          let circleColor = "#64748B";
          let circleBorder = "none";

          if (isDone) {
            circleBg = "#10B981";
            circleColor = "#FFFFFF";
          } else if (isActive) {
            circleBg = "#2563EB";
            circleColor = "#FFFFFF";
            circleBorder = "3px solid #BFDBFE";
          } else if (isRejected) {
            circleBg = "#F1F5F9";
            circleColor = "#94A3B8";
          }

          return (
            <div
              key={stage.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
              }}
            >
              {/* Connector Line behind circle */}
              {idx < stages.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: "13px",
                    left: "50%",
                    width: "100%",
                    height: "3px",
                    background: stages[idx + 1].done && !isRejected ? "#10B981" : "#E2E8F0",
                    zIndex: 0,
                  }}
                />
              )}

              {/* Circle Node */}
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: circleBg,
                  color: circleColor,
                  border: circleBorder,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                  zIndex: 1,
                  boxShadow: isActive ? "0 0 0 3px rgba(37, 99, 235, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {isDone ? <FaCheck size={11} /> : idx + 1}
              </div>

              {/* Label */}
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "11.5px",
                  fontWeight: isActive ? 800 : isDone ? 700 : 600,
                  color: isActive ? "#1E40AF" : isDone ? "#0F172A" : "#94A3B8",
                  lineHeight: 1.2,
                }}
              >
                {stage.title}
              </div>

              {/* Subtitle / Active Tag */}
              {isActive && (
                <span
                  style={{
                    marginTop: "2px",
                    fontSize: "9px",
                    fontWeight: 800,
                    color: "#2563EB",
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                  }}
                >
                  Active Now
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Chronological List */}
      <div
        style={{
          borderTop: "1px solid #E2E8F0",
          paddingTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {stages.map((stage, idx) => {
          const isDone = stage.done && !isRejected;
          const isActive = idx === activeIndex && !isRejected;

          return (
            <div
              key={stage.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: "6px",
                background: isActive
                  ? "#EFF6FF"
                  : isDone
                  ? "#F1F5F9"
                  : "transparent",
                border: isActive ? "1px solid #BFDBFE" : "1px solid transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: isDone ? "#10B981" : isActive ? "#2563EB" : "#CBD5E1",
                    color: "#FFF",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  {isDone ? "✓" : idx + 1}
                </span>
                <div>
                  <span
                    style={{
                      fontSize: "12.5px",
                      fontWeight: isActive || isDone ? 700 : 500,
                      color: isDone || isActive ? "#0F172A" : "#64748B",
                    }}
                  >
                    {stage.title}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748B",
                      marginLeft: "8px",
                    }}
                  >
                    — {stage.subtitle}
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: isDone ? 600 : 400,
                  color: isDone ? "#334155" : "#94A3B8",
                }}
              >
                {isDone && stage.time && stage.time !== "-" ? stage.time : isActive ? "In Progress" : "Pending"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RescueLifecycleTimeline;
