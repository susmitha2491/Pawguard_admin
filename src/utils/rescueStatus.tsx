/** Canonical rescue lifecycle (PRR): reported -> verified -> dispatched -> located -> rescued -> admitted. */

export const RESCUE_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  submitted: { label: "Submitted", bg: "#FFFBEB", color: "#B45309" },
  reported: { label: "Submitted", bg: "#FFFBEB", color: "#B45309" },
  verified: { label: "Verified", bg: "#EFF6FF", color: "#2563EB" },
  accepted: { label: "Accepted", bg: "#FEF3C7", color: "#D97706" },
  dispatched: { label: "Dispatched", bg: "#F5F3FF", color: "#7C3AED" },
  in_progress: { label: "In Progress", bg: "#E0E7FF", color: "#4338CA" },
  en_route: { label: "En Route", bg: "#E0E7FF", color: "#4338CA" },
  located: { label: "Located", bg: "#ECFEFF", color: "#0891B2" },
  secured: { label: "Secured", bg: "#ECFDF5", color: "#059669" },
  rescued: { label: "Secured", bg: "#ECFDF5", color: "#059669" },
  admitted: { label: "Admitted", bg: "#D1FAE5", color: "#065F46" },
  completed: { label: "Completed", bg: "#D1FAE5", color: "#065F46" },
  rejected: { label: "Rejected", bg: "#FEF2F2", color: "#DC2626" },
  cancelled: { label: "Cancelled", bg: "#FEF2F2", color: "#DC2626" },
};

export const rescueStatusMeta = (status?: string | null) => {
  const meta = RESCUE_STATUS_META[String(status || "").toLowerCase()] || {
    label: status || "Unknown",
    bg: "#F1F5F9",
    color: "#475569",
  };
  return meta;
};

/** Renders a canonical rescue status as a badge element. */
export const rescueStatusBadge = (status?: string | null) => {
  const meta = rescueStatusMeta(status);
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        background: meta.bg,
        color: meta.color,
        textTransform: "capitalize",
      }}
    >
      {meta.label}
    </span>
  );
};

export interface DispatchStageInfo {
  label: string;
  bg: string;
  color: string;
}

/**
 * Dispatch status derived from the rescue request lifecycle + whether a
 * dispatch record exists.
 */
export const dispatchStage = (req?: {
  status?: string | null;
  dispatch?: unknown;
}): DispatchStageInfo => {
  const d = (req?.dispatch as Record<string, unknown>) || null;
  const dispatchStatus = String(d?.status || "").toLowerCase();
  const reqStatus = String(req?.status || "").toLowerCase();

  const statusPriority: Record<string, number> = {
    submitted: 1,
    reported: 1,
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

  const reqP = statusPriority[reqStatus] || 0;
  const disP = statusPriority[dispatchStatus] || 0;
  const effectiveStatus = disP > reqP ? dispatchStatus : reqStatus;

  if (effectiveStatus === "en_route") {
    return { label: "En Route", bg: "#E0E7FF", color: "#4338CA" };
  }
  if (effectiveStatus === "in_progress") {
    return { label: "In Progress", bg: "#E0E7FF", color: "#4338CA" };
  }
  if (effectiveStatus === "located") {
    return { label: "Located", bg: "#ECFEFF", color: "#0891B2" };
  }
  if (effectiveStatus === "secured" || effectiveStatus === "rescued") {
    return { label: "Secured", bg: "#ECFDF5", color: "#059669" };
  }
  if (effectiveStatus === "admitted") {
    return { label: "Admitted", bg: "#D1FAE5", color: "#065F46" };
  }
  if (effectiveStatus === "completed") {
    return { label: "Completed", bg: "#D1FAE5", color: "#065F46" };
  }
  if (effectiveStatus === "accepted") {
    return { label: "Accepted", bg: "#FEF3C7", color: "#D97706" };
  }
  if (effectiveStatus === "dispatched") {
    return { label: "Dispatched", bg: "#F5F3FF", color: "#7C3AED" };
  }
  if (effectiveStatus === "rejected" || effectiveStatus === "cancelled") {
    return { label: "Rejected", bg: "#FEF2F2", color: "#DC2626" };
  }
  if (effectiveStatus === "verified") {
    return { label: "Not Assigned", bg: "#F1F5F9", color: "#475569" };
  }
  return { label: "Not Assigned", bg: "#F1F5F9", color: "#475569" };
};

/** Agents assigned to a dispatch (RescueDispatchAgentResponse[]). */
export const dispatchAgentNames = (dispatch?: {
  agents?: Array<{ agent_id?: string; role?: string | null }> | null;
  assigned_driver_id?: string | null;
}): { agents: string[]; driver: string } => {
  const agents = Array.isArray(dispatch?.agents) ? dispatch.agents.map((a) => a.agent_id || "-") : [];
  return { agents, driver: dispatch?.assigned_driver_id || "" };
};
