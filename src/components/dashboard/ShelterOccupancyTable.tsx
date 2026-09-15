import { useMemo } from "react";
import { FaBuilding } from "react-icons/fa";
import DashboardSectionHeader from "./DashboardSectionHeader";
import DashboardSkeleton from "./DashboardSkeleton";
import type { AnyRecord } from "../../types/dashboard";

interface ShelterOccupancyTableProps {
  shelters: AnyRecord[];
  dogs?: AnyRecord[];
  loading?: boolean;
}

export interface ShelterOccupancyRow {
  id: string;
  name: string;
  occupied: number;
  capacity: number;
  occupancyPct: number;
  status: string;
  facilityType: string;
}

const ShelterOccupancyTable = ({ shelters, dogs = [], loading }: ShelterOccupancyTableProps) => {
  const processedShelters = useMemo(() => {
    if (!Array.isArray(shelters) || shelters.length === 0) return [];

    const seenIds = new Set<string>();

    return shelters
      .filter((s) => {
        if (!s || typeof s !== "object") return false;
        const id = String(s.id ?? s.facility_id ?? s.name);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .map((s): ShelterOccupancyRow => {
        const id = String(s.id ?? s.facility_id ?? s.name);
        let rawName = String(s.name || s.facility_name || s.shelter_name || s.title || "").trim();
        if (!rawName || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawName)) {
          const fallbackName = String(s.facility_name || s.shelter_name || s.address || s.location || "").trim();
          rawName = fallbackName && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackName)
            ? fallbackName
            : "Main Shelter Facility";
        }
        const name = rawName;
        const capacity = Math.max(0, Number(s.total_capacity ?? s.capacity ?? s.max_capacity ?? 0));

        // Count real active dogs assigned to this shelter if not provided explicitly by backend
        let occupied = Number(s.occupied ?? s.current_occupancy ?? s.occupied_count ?? s.dogs_count ?? -1);
        if (occupied < 0) {
          occupied = dogs.filter((d) => {
            if (!d || typeof d !== "object") return false;
            const dShelterId = String(d.shelter_id ?? d.facility_id ?? d.shelterId ?? d.organization_id ?? "");
            if (dShelterId !== id) return false;
            const status = String(d.status ?? d.current_status ?? "").toLowerCase();
            return !/adopted|transferred|deceased|fostered/i.test(status);
          }).length;
        }

        const occupancyPct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
        const status = String(s.status ?? "active").toLowerCase();
        const facilityType = String(s.facility_type ?? "shelter").replace(/_/g, " ");

        return {
          id,
          name,
          occupied,
          capacity,
          occupancyPct: Math.min(100, occupancyPct),
          status,
          facilityType,
        };
      });
  }, [shelters, dogs]);

  const getProgressColor = (pct: number): string => {
    if (pct >= 90) return "#DC2626"; // Red for high capacity / critical
    if (pct >= 75) return "#F59E0B"; // Amber for medium-high
    return "#16A34A"; // Green for normal capacity
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
    >
      <DashboardSectionHeader
        title="Shelter Occupancy & Capacity"
        subtitle="Real-time animal occupancy and facility capacity across active shelters"
      />

      {loading ? (
        <DashboardSkeleton rows={4} />
      ) : processedShelters.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "#94A3B8",
            background: "#F8FAFC",
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
          }}
        >
          <FaBuilding size={28} style={{ marginBottom: "8px", opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#475569" }}>
            No active shelter facility records found.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94A3B8" }}>
            Shelter facilities registered in the platform will appear here with live capacity tracking.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <th style={thStyle}>Shelter Facility</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Occupied</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Capacity</th>
                <th style={{ ...thStyle, width: "35%" }}>Occupancy &amp; Visual Bar</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {processedShelters.map((s) => {
                const color = getProgressColor(s.occupancyPct);
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748B", textTransform: "capitalize" }}>
                        {s.facilityType}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: "#0F172A" }}>
                      {s.occupied}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600, color: "#64748B" }}>
                      {s.capacity > 0 ? s.capacity : "Unspecified"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            flex: 1,
                            height: "8px",
                            background: "#E2E8F0",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${s.capacity > 0 ? s.occupancyPct : 0}%`,
                              height: "100%",
                              background: color,
                              borderRadius: "999px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color, minWidth: "38px" }}>
                          {s.capacity > 0 ? `${s.occupancyPct}%` : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: s.status === "active" ? "#EFF6FF" : "#FEF2F2",
                          color: s.status === "active" ? "#1E40AF" : "#991B1B",
                          textTransform: "capitalize",
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 700,
  color: "#475569",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};

export default ShelterOccupancyTable;
