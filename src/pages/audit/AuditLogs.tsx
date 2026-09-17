import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaTerminal,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUserLock,
  FaEye,
  FaFileDownload,
  FaFilter,
  FaSync,
  FaSearch,
  FaCopy,
  FaCheck,
  FaUserShield,
  FaServer,
  FaExchangeAlt,
  FaFingerprint,
} from "react-icons/fa";
import auditService from "../../services/auditService";
import { formatDateTime } from "../../utils/dateUtils";

export interface FormattedAuditLog {
  id: string;
  rawTimestamp: string;
  timestamp: string;
  user: string;
  userId: string;
  role: string;
  action: string;
  eventType: string;
  entityType: string;
  entityId: string;
  ip: string;
  status: string;
  previousState: unknown;
  newState: unknown;
  rawItem: unknown;
  [key: string]: unknown;
}

interface StateDiffItem {
  field: string;
  before: string;
  after: string;
}

const computeStateDiff = (prev: unknown, next: unknown): StateDiffItem[] => {
  if (!prev || !next || typeof prev !== "object" || typeof next !== "object") {
    return [];
  }

  const prevObj = prev as Record<string, unknown>;
  const nextObj = next as Record<string, unknown>;
  const allKeys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));
  const diffs: StateDiffItem[] = [];

  for (const key of allKeys) {
    const valBefore = prevObj[key];
    const valAfter = nextObj[key];

    const strBefore = valBefore === undefined ? "(undefined)" : JSON.stringify(valBefore);
    const strAfter = valAfter === undefined ? "(undefined)" : JSON.stringify(valAfter);

    if (strBefore !== strAfter) {
      diffs.push({
        field: key,
        before: valBefore === undefined ? "—" : typeof valBefore === "object" ? JSON.stringify(valBefore) : String(valBefore),
        after: valAfter === undefined ? "—" : typeof valAfter === "object" ? JSON.stringify(valAfter) : String(valAfter),
      });
    }
  }

  return diffs;
};

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<FormattedAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedLog, setSelectedLog] = useState<FormattedAuditLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const { addToast } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (eventTypeFilter) params.event_type = eventTypeFilter;

      const response = await auditService.getAuditLogs(params);
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.items)
        ? response.items
        : [];

      const formatted: FormattedAuditLog[] = list.map((item: any) => {
        const rawTs = item.timestamp || item.created_at || item.time || new Date().toISOString();
        return {
          id: String(item.id || item.entry_id || item.log_id || item._id || Math.random()),
          rawTimestamp: rawTs,
          timestamp: formatDateTime(rawTs),
          user: String(item.user || item.username || item.admin || item.email || item.user_id || "System Action"),
          userId: String(item.user_id || item.user || "system"),
          role: String(item.role || item.role_name || "super_admin"),
          action: String(item.action || item.event || item.event_type || item.description || item.message || "Operation Executed"),
          eventType: String(item.event_type || item.action || "audit_event"),
          entityType: String(item.entity_type || item.resource || item.module || "system"),
          entityId: String(item.entity_id || item.target_id || "—"),
          ip: String(item.ip || item.ip_address || "127.0.0.1"),
          status: String(item.status || item.result || "SUCCESS").toUpperCase(),
          previousState: item.previous_state ?? item.old_val ?? item.pre_state ?? null,
          newState: item.new_state ?? item.new_val ?? item.post_state ?? null,
          rawItem: item,
        };
      });

      const sortedFormatted = [...formatted].sort((a, b) => {
        const timeA = new Date(a.rawTimestamp).getTime();
        const timeB = new Date(b.rawTimestamp).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setLogs(sortedFormatted);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load audit logs from backend.");
      addToast("Could not load audit logs from server.", "error");
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, addToast]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: "csv" | "json") => {
    try {
      setIsExporting(true);
      const data = await auditService.exportAuditLogs(format, {
        event_type: eventTypeFilter || undefined,
      });

      if (format === "csv") {
        const blob = data instanceof Blob ? data : new Blob([String(data)], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pawguard_audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const str = JSON.stringify(data, null, 2);
        const blob = new Blob([str], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pawguard_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      addToast(`Audit logs exported successfully (${format.toUpperCase()})!`, "success");
    } catch {
      addToast("Failed to export audit logs from server.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyId = (idText: string) => {
    if (!idText) return;
    navigator.clipboard.writeText(idText);
    setCopiedId(true);
    addToast("Audit record ID copied to clipboard!", "success");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleOpenDetail = (log: FormattedAuditLog) => {
    setSelectedLog(log);
    setCopiedId(false);
    setIsDetailModalOpen(true);
  };

  // Search filtering
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      return (
        log.user.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.role.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q) ||
        log.ip.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery]);

  const successful = filteredLogs.filter((l) => l.status === "SUCCESS").length;
  const flagged = filteredLogs.length - successful;
  const uniqueUsers = new Set(filteredLogs.map((l) => l.user).filter(Boolean)).size;

  const stats = [
    { title: "Total Audit Records", value: String(filteredLogs.length), trend: "Immutable transaction trail", color: "#2563EB", icon: <FaTerminal /> },
    { title: "Verified Success", value: String(successful), trend: "Normal system operations", color: "#10B981", icon: <FaCheckCircle /> },
    { title: "Flagged / Failed", value: String(flagged), trend: "Security anomalies / retries", color: "#EF4444", icon: <FaExclamationTriangle /> },
    { title: "Unique Actors Tracked", value: String(uniqueUsers), trend: "Active administrative accounts", color: "#6366F1", icon: <FaUserLock /> },
  ];

  const columns = [
    { key: "timestamp", title: "Timestamp" },
    {
      key: "user",
      title: "Actor / Admin",
      render: (v: string, row: FormattedAuditLog) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{v}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>IP: {row.ip}</div>
        </div>
      ),
    },
    {
      key: "role",
      title: "Role",
      render: (v: string) => (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "4px",
            background: "#EFF6FF",
            color: "#1D4ED8",
            textTransform: "capitalize",
          }}
        >
          {v || "super_admin"}
        </span>
      ),
    },
    {
      key: "action",
      title: "Action Code & Target",
      render: (v: string, row: FormattedAuditLog) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A", textTransform: "uppercase", fontSize: "12.5px" }}>{v}</div>
          {row.entityType && row.entityType !== "system" && (
            <div style={{ fontSize: "11.5px", color: "#6366F1", marginTop: "2px" }}>
              Target: <strong style={{ textTransform: "capitalize" }}>{row.entityType}</strong> ({row.entityId})
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (v: string) => {
        const isSuccess = v === "SUCCESS";
        return (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: "999px",
              background: isSuccess ? "#D1FAE5" : "#FEE2E2",
              color: isSuccess ? "#047857" : "#DC2626",
              border: isSuccess ? "1px solid #A7F3D0" : "1px solid #FCA5A5",
            }}
          >
            {v}
          </span>
        );
      },
    },
    {
      key: "id",
      title: "Action",
      render: (_: string, row: FormattedAuditLog) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetail(row);
          }}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#2563EB",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <FaEye /> View
        </button>
      ),
    },
  ];

  const stateDiffs = useMemo(() => {
    if (!selectedLog) return [];
    return computeStateDiff(selectedLog.previousState, selectedLog.newState);
  }, [selectedLog]);

  return (
    <div>
      {/* Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>
                Security Audit &amp; Governance Event Logs
              </h1>
              <span
                style={{
                  background: "rgba(37, 99, 235, 0.2)",
                  color: "#60A5FA",
                  border: "1px solid rgba(96, 165, 250, 0.4)",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                PRR 6.1.2 Compliant
              </span>
            </div>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px" }}>
              Central immutable transaction trail: critical system mutations, administrative overrides, access logs, and state history.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={isExporting}
              style={{
                padding: "9px 15px",
                borderRadius: "8px",
                border: "1px solid #475569",
                background: "#334155",
                color: "#FFF",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: isExporting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaFileDownload /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExport("json")}
              disabled={isExporting}
              style={{
                padding: "9px 15px",
                borderRadius: "8px",
                border: "1px solid #475569",
                background: "#334155",
                color: "#FFF",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: isExporting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaFileDownload /> Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Real-Time Audit Event Stream
          </h3>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Event Type Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FaFilter size={12} color="#64748B" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                <option value="">All Event Types</option>
                <option value="login_success">Login Success</option>
                <option value="animal_registered">Animal Registered</option>
                <option value="safety_tag_provisioned">Safety Tag Provisioned</option>
                <option value="rescue_dispatched">Rescue Dispatched</option>
                <option value="medical_clearance">Medical Clearance</option>
                <option value="adoption_submitted">Adoption Submitted</option>
                <option value="inventory_changed">Inventory Changed</option>
                <option value="role_permission_changed">Role / RBAC Changed</option>
                <option value="settings_updated">Settings Updated</option>
              </select>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "10px", top: "11px", color: "#94A3B8" }} size={12} />
              <input
                type="text"
                placeholder="Search actor, action, IP, UUID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: "8px 12px 8px 30px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "240px" }}
              />
            </div>

            <button
              type="button"
              onClick={() => void fetchLogs()}
              disabled={loading}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaSync style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#64748B", padding: "20px 0" }}>Fetching server-side audit logs...</p>
        ) : error ? (
          <p style={{ color: "#EF4444", padding: "20px 0" }}>{error}</p>
        ) : filteredLogs.length === 0 ? (
          <p style={{ color: "#64748B", padding: "20px 0" }}>No matching audit log entries found on the server.</p>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            onRowClick={(row) => handleOpenDetail(row)}
            onView={(row) => handleOpenDetail(row)}
          />
        )}
      </div>

      {/* READ-ONLY AUDIT EVENT INSPECTION MODAL */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Audit Event Details"
        maxWidth="760px"
      >
        {selectedLog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "4px 0" }}>
            {/* Header Event Banner */}
            <div
              style={{
                background: selectedLog.status === "SUCCESS" ? "#F0FDF4" : "#FEF2F2",
                border: selectedLog.status === "SUCCESS" ? "1px solid #BBF7D0" : "1px solid #FECACA",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: selectedLog.status === "SUCCESS" ? "#166534" : "#991B1B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Action Code
                  </span>
                </div>
                <h2
                  style={{
                    margin: "2px 0 4px",
                    fontSize: "19px",
                    fontWeight: 800,
                    color: selectedLog.status === "SUCCESS" ? "#14532D" : "#7F1D1D",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {selectedLog.action}
                </h2>
                <div style={{ fontSize: "13px", color: selectedLog.status === "SUCCESS" ? "#15803D" : "#B91C1C" }}>
                  Event Type: <strong style={{ fontFamily: "monospace" }}>{selectedLog.eventType}</strong>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "999px",
                    background: selectedLog.status === "SUCCESS" ? "#DCFCE7" : "#FEE2E2",
                    color: selectedLog.status === "SUCCESS" ? "#15803D" : "#B91C1C",
                    border: selectedLog.status === "SUCCESS" ? "1px solid #86EFAC" : "1px solid #FCA5A5",
                  }}
                >
                  {selectedLog.status === "SUCCESS" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                  {selectedLog.status}
                </span>
              </div>
            </div>

            {/* SECTION 1: Event Summary */}
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaServer /> 1. Event Summary
              </div>
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Action Code
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginTop: "2px", fontFamily: "monospace" }}>
                    {selectedLog.action}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Event Type
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {selectedLog.eventType}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Entity / Resource
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A", marginTop: "2px", textTransform: "capitalize" }}>
                    {selectedLog.entityType || "system"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Entity ID
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "2px", fontFamily: "monospace" }}>
                    {selectedLog.entityId || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Actor / User Information */}
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaUserShield /> 2. Actor / User Information
              </div>
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    User / Administrator
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                    {selectedLog.user}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    User ID
                  </div>
                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", marginTop: "2px", fontFamily: "monospace" }}>
                    {selectedLog.userId || "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Assigned Role
                  </div>
                  <div style={{ marginTop: "3px" }}>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: "4px",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        border: "1px solid #DBEAFE",
                        textTransform: "capitalize",
                      }}
                    >
                      {selectedLog.role || "super_admin"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Event Metadata & Network */}
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaFingerprint /> 3. Event Metadata &amp; Network Information
              </div>
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Timestamp (Formatted)
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                    {selectedLog.timestamp}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px", fontFamily: "monospace" }}>
                    ISO: {selectedLog.rawTimestamp}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Client IP Address
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginTop: "2px", fontFamily: "monospace" }}>
                    {selectedLog.ip || "127.0.0.1"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                    Audited for Super Admin Security
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: State Change (Pre-State vs Post-State) */}
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaExchangeAlt /> 4. State Change (Pre-State &amp; Post-State Snapshots)
              </div>

              {/* Field-Level Differences Table (if structured diff exists) */}
              {stateDiffs.length > 0 && (
                <div style={{ marginBottom: "14px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#334155", borderBottom: "1px solid #CBD5E1" }}>Field</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#991B1B", borderBottom: "1px solid #CBD5E1" }}>Previous Value</th>
                        <th style={{ padding: "8px 12px", fontWeight: 700, color: "#166534", borderBottom: "1px solid #CBD5E1" }}>New Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stateDiffs.map((d, i) => (
                        <tr key={i} style={{ borderBottom: i < stateDiffs.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: "#0F172A" }}>{d.field}</td>
                          <td style={{ padding: "8px 12px", color: "#B91C1C", fontFamily: "monospace", wordBreak: "break-all" }}>{d.before}</td>
                          <td style={{ padding: "8px 12px", color: "#15803D", fontFamily: "monospace", wordBreak: "break-all" }}>{d.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Raw JSON Code Blocks */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* PREVIOUS STATE */}
                <div style={{ background: "#0F172A", borderRadius: "10px", padding: "14px", color: "#F8FAFC", border: "1px solid #334155" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    PREVIOUS STATE (PRE-STATE)
                  </div>
                  {selectedLog.previousState ? (
                    <pre style={{ margin: 0, fontSize: "11.5px", fontFamily: "monospace", maxHeight: "180px", overflowY: "auto", color: "#FECACA", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {typeof selectedLog.previousState === "string" ? selectedLog.previousState : JSON.stringify(selectedLog.previousState, null, 2)}
                    </pre>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic", padding: "8px 0" }}>
                      Not available (Initial creation / No prior state)
                    </div>
                  )}
                </div>

                {/* NEW STATE */}
                <div style={{ background: "#0F172A", borderRadius: "10px", padding: "14px", color: "#F8FAFC", border: "1px solid #334155" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#86EFAC", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    NEW STATE (POST-STATE)
                  </div>
                  {selectedLog.newState ? (
                    <pre style={{ margin: 0, fontSize: "11.5px", fontFamily: "monospace", maxHeight: "180px", overflowY: "auto", color: "#BBF7D0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {typeof selectedLog.newState === "string" ? selectedLog.newState : JSON.stringify(selectedLog.newState, null, 2)}
                    </pre>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic", padding: "8px 0" }}>
                      Not available (Deletion / No post state)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5: Audit Record Traceability */}
            <div
              style={{
                background: "#F1F5F9",
                borderRadius: "10px",
                padding: "12px 16px",
                border: "1px solid #CBD5E1",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                  Audit Record Identifier (UUID)
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A", fontFamily: "monospace", marginTop: "2px" }}>
                  {selectedLog.id}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopyId(selectedLog.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: copiedId ? "#166534" : "#2563EB",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiedId ? <FaCheck /> : <FaCopy />} {copiedId ? "Copied" : "Copy ID"}
              </button>
            </div>

            {/* Modal Footer Action */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                paddingTop: "10px",
                borderTop: "1px solid #E2E8F0",
              }}
            >
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
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

export default AuditLogs;