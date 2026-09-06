import { useState, useEffect, useCallback } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import DataTable, { type Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import { usePermissions } from "../../context/PermissionContext";
import {
  FaSearchLocation,
  FaCheckCircle,
  FaExclamationCircle,
  FaPlus,
  FaBroadcastTower,
  FaHandshake,
  FaTrash,
  FaMapMarkerAlt,
  FaUser,
  FaMicrochip,
  FaClock,
  FaSpinner,
  FaEye,
  FaQrcode,
} from "react-icons/fa";
import lostFoundService, {
  type Species,
  type ReportKind,
  type ReporterProfile,
} from "../../services/lostFoundService";
import dogService from "../../services/dogService";
import petService from "../../services/petService";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";
import QrScannerModal from "../../components/dashboard/QrScannerModal";

const PAGE_SIZE = 8;

const SPECIES_OPTIONS: Species[] = ["dog"];
const STATUS_OPTIONS = ["active", "resolved", "expired"];

type CardFilter = "total" | "lost" | "found" | "resolved";

const toNumOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const trimOrNull = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

const shortId = (id: string): string =>
  id && id.length > 8 ? `${id.slice(0, 8)}\u2026` : id || "-";

import { formatDateTime } from "../../utils/dateUtils";

const formatDate = (iso?: string | null): string => formatDateTime(iso);

const formatCoord = (v: number | string | null | undefined): string => {
  if (v === undefined || v === null || v === "" || v === "-") return "-";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n.toFixed(5) : "-";
};

const extractError = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const candidate = err as {
      response?: {
        data?: {
          detail?: unknown;
          message?: string;
          error?: { message?: string };
        };
      };
      message?: unknown;
    };
    const d = candidate.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length > 0 && typeof d[0]?.msg === "string") return d[0].msg;
    if (typeof candidate.response?.data?.message === "string") return candidate.response.data.message;
    if (typeof candidate.response?.data?.error?.message === "string") return candidate.response.data.error.message;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return fallback;
};

const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

const statusBadge = (status?: string) => {
  const lower = String(status || "").toLowerCase();
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "#EFF6FF", color: "#2563EB", label: "Active" },
    resolved: { bg: "#ECFDF5", color: "#10B981", label: "Resolved" },
    expired: { bg: "#F1F5F9", color: "#64748B", label: "Expired" },
  };
  const s = map[lower] || { bg: "#F1F5F9", color: "#475569", label: String(status || "Unknown") };
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        display: "inline-block",
        textTransform: "capitalize",
      }}
    >
      {s.label}
    </span>
  );
};

const matchStatusBadge = (status?: string) => {
  const lower = String(status || "").toLowerCase();
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#FFFBEB", color: "#B45309" },
    confirmed: { bg: "#ECFDF5", color: "#059669" },
    rejected: { bg: "#FEF2F2", color: "#DC2626" },
  };
  const s = map[lower] || { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        textTransform: "capitalize",
      }}
    >
      {String(status || "pending")}
    </span>
  );
};

const speciesChip = (species?: string) => {
  const s = String(species || "other").toLowerCase();
  const colors: Record<string, string> = {
    dog: "#2563EB",
    cat: "#7C3AED",
    bird: "#059669",
    rabbit: "#DB2777",
    other: "#64748B",
  };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 700,
        background: `${colors[s] || colors.other}15`,
        color: colors[s] || colors.other,
        textTransform: "capitalize",
        display: "inline-block",
      }}
    >
      {s}
    </span>
  );
};

const kindBadge = (kind?: string) => {
  const isLost = String(kind || "").toLowerCase() === "lost";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "capitalize",
        display: "inline-block",
        background: isLost ? "#FEF2F2" : "#FFFBEB",
        color: isLost ? "#EF4444" : "#B45309",
      }}
    >
      {isLost ? "Lost" : "Found"}
    </span>
  );
};

interface DetailField {
  label: string;
  value: string;
  badge?: ReactNode;
  icon?: ReactNode;
}

interface RegistryReport {
  id: string;
  user_id?: string;
  species?: Species;
  status?: string;
  photo_url?: string | null;
  location_address?: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
  user?: ReporterProfile | null;
  pet_name?: string;
  breed?: string;
  color?: string;
  microchip_id?: string | null;
  lost_at?: string;
  breed_observed?: string;
  color_observed?: string;
  found_at?: string;
  collar_color?: string | null;
  collar_description?: string | null;
  marker_description?: string | null;
  [key: string]: unknown;
}

interface RegistryMatch {
  id: string;
  status?: string;
  confidence_score?: number;
  distance_km?: number | null;
  temporal_gap_days?: number | null;
  claim_submitted_at?: string | null;
  claim_reviewed_at?: string | null;
  verification_notes?: string | null;
  match_reasons?: string[];
  lost_report?: RegistryReport | null;
  found_report?: RegistryReport | null;
  [key: string]: unknown;
}

export type NavigationTab = "overview" | "lost" | "found" | "matches" | "reunion_stories";

interface LocationMapPreviewProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  locationAddress?: string | null;
  height?: string;
  title?: string;
}

const LocationMapPreview = ({
  latitude,
  longitude,
  locationAddress,
  height = "220px",
  title,
}: LocationMapPreviewProps) => {
  const hasCoords =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (!hasCoords) {
    return (
      <div
        style={{
          height,
          borderRadius: "12px",
          background: "#F8FAFC",
          border: "1px dashed #CBD5E1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          textAlign: "center",
          color: "#64748B",
        }}
      >
        <FaMapMarkerAlt size={26} style={{ color: "#94A3B8", marginBottom: "8px" }} />
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#334155" }}>
          GPS Location Pin Unavailable
        </div>
        <div style={{ fontSize: "12px", marginTop: "4px", color: "#64748B" }}>
          {locationAddress ? `Recorded Text Location: "${locationAddress}"` : "No GPS coordinates recorded for this report."}
        </div>
      </div>
    );
  }

  const bboxDelta = 0.008;
  const minLon = longitude! - bboxDelta;
  const minLat = latitude! - bboxDelta;
  const maxLon = longitude! + bboxDelta;
  const maxLat = latitude! + bboxDelta;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <div
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {title && (
        <div
          style={{
            background: "#F1F5F9",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FaMapMarkerAlt color="#EF4444" /> {title}
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748B" }}>
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </span>
        </div>
      )}
      <iframe
        title={title || "GPS Location Pin Map"}
        width="100%"
        height={height}
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={osmUrl}
        style={{ display: "block", width: "100%", height, border: "none" }}
      />
    </div>
  );
};

const LostAndFound = () => {
  const { addToast } = useToast();
  const { can, role } = usePermissions();

  const [activeTab, setActiveTab] = useState<NavigationTab>("lost");
  const [reports, setReports] = useState<RegistryReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cardFilter, setCardFilter] = useState<CardFilter>("total");

  const [stats, setStats] = useState({ total: 0, lost: 0, found: 0, resolved: 0 });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [reunionStories, setReunionStories] = useState<any[]>([]);
  const [reunionLoading, setReunionLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<RegistryReport | null>(null);
  const [selectedReportKind, setSelectedReportKind] = useState<ReportKind>("lost");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const [tagLoading, setTagLoading] = useState(false);
  const [tagData, setTagData] = useState<any | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  const fetchSafetyTagForReport = useCallback(async (report: RegistryReport) => {
    setTagData(null);
    setTagError(null);

    const petId = report.companion_pet_id || (report as any).pet_id || (report as any).dog_id;

    if (!petId) {
      setTagLoading(false);
      return;
    }

    setTagLoading(true);
    try {
      let tagRes: any = null;
      try {
        tagRes = await dogService.getSafetyTagMetadata(String(petId));
      } catch (err: any) {
        if (err?.response?.status === 404) {
          try {
            tagRes = await petService.getSafetyTagMetadata(String(petId));
          } catch {
            tagRes = null;
          }
        } else {
          throw err;
        }
      }

      const tagObj = tagRes?.data || tagRes;
      if (tagObj && typeof tagObj === "object" && (tagObj.id || tagObj.token_prefix)) {
        setTagData(tagObj);
      } else {
        setTagData(null);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setTagData(null);
      } else {
        setTagError(extractError(err, "Failed to load Safety Tag information"));
      }
    } finally {
      setTagLoading(false);
    }
  }, []);

  const [isMatchesOpen, setIsMatchesOpen] = useState(false);
  const [matches, setMatches] = useState<RegistryMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<RegistryMatch | null>(null);
  const [reviewTarget, setReviewTarget] = useState<RegistryMatch | null>(null);
  const [resolveTarget, setResolveTarget] = useState<RegistryMatch | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [claimNotes, setClaimNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const [isVerifyScannerOpen, setIsVerifyScannerOpen] = useState(false);
  const [verifyExpectedAnimalId, setVerifyExpectedAnimalId] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState({
    report_type: "lost" as ReportKind,
    species: "dog" as Species,
    pet_name: "",
    breed: "",
    color: "",
    microchip_id: "",
    collar_color: "",
    collar_description: "",
    marker_description: "",
    location_address: "",
    latitude: "",
    longitude: "",
    lost_at: "",
    found_at: "",
    photo_url: "",
    breed_observed: "",
    color_observed: "",
  });

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      addToast("Geolocation is not supported by your browser.", "error");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFormData((prev) => ({
          ...prev,
          latitude: lat.toFixed(5),
          longitude: lng.toFixed(5),
        }));
        setIsLocating(false);
        addToast(`GPS location captured: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, "success");
      },
      (err) => {
        setIsLocating(false);
        let msg = "Failed to capture GPS location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied. Please grant location access in browser settings.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "GPS signal unavailable. Please try again or enter location manually.";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS request timed out. Please try again or enter location manually.";
        }
        addToast(msg, "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const resetForm = () => {
    setFormData((f) => ({
      ...f,
      species: "dog",
      pet_name: "",
      breed: "",
      color: "",
      microchip_id: "",
      collar_color: "",
      collar_description: "",
      marker_description: "",
      location_address: "",
      latitude: "",
      longitude: "",
      lost_at: "",
      found_at: "",
      photo_url: "",
      breed_observed: "",
      color_observed: "",
    }));
    setFormError(null);
  };

  const combined = cardFilter === "total" || cardFilter === "resolved";
  const effectiveStatus = cardFilter === "resolved" ? "resolved" : statusFilter;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (effectiveStatus) params.status = effectiveStatus;

      let rows: RegistryReport[] = [];
      let total = 0;
      if (combined) {
        const [lostRes, foundRes] = await Promise.all([
          lostFoundService.getLostReports(params),
          lostFoundService.getFoundReports(params),
        ]);
        const lostRows = (lostRes.data || []).map((r) => ({ ...r, _kind: "lost" as const }));
        const foundRows = (foundRes.data || []).map((r) => ({ ...r, _kind: "found" as const }));
        rows = [...lostRows, ...foundRows] as RegistryReport[];
        total =
          (lostRes.meta?.total ?? lostRows.length) + (foundRes.meta?.total ?? foundRows.length);
      } else {
        const res =
          activeTab === "lost"
            ? await lostFoundService.getLostReports(params)
            : await lostFoundService.getFoundReports(params);
        rows = ((res.data || []) as RegistryReport[]).map((r) => ({
          ...r,
          _kind: activeTab,
        }));
        total = res.meta?.total ?? rows.length;
      }
      const dogOnly = rows.filter((r) => r.species === "dog");
      const sortedDogOnly = [...dogOnly].sort((a, b) => {
        const timeA = new Date(a.created_at || a.lost_at || a.found_at || 0).getTime();
        const timeB = new Date(b.created_at || b.lost_at || b.found_at || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setReports(sortedDogOnly as RegistryReport[]);
      setTotalCount(total);
    } catch (err) {
      setError(extractError(err, "Failed to load lost & found listings."));
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, debouncedSearch, effectiveStatus, combined]);

  const fetchStats = useCallback(async () => {
    try {
      const backendStats = await lostFoundService.getLostFoundStats();
      if (backendStats && typeof backendStats === "object" && (backendStats.total_lost !== undefined || backendStats.total_found !== undefined)) {
        const lost = Number(backendStats.total_lost) || 0;
        const found = Number(backendStats.total_found) || 0;
        const resolved = Number(backendStats.total_reunions) || Number(backendStats.total_matches) || 0;
        setStats({
          total: lost + found,
          lost,
          found,
          resolved,
        });
        return;
      }
    } catch {
      /* fallback below */
    }

    try {
      const [lostRes, foundRes, lostResolvedRes, foundResolvedRes] = await Promise.all([
        lostFoundService.getLostReports({ page: 1, page_size: 1 }),
        lostFoundService.getFoundReports({ page: 1, page_size: 1 }),
        lostFoundService.getLostReports({ page: 1, page_size: 1, status: "resolved" }),
        lostFoundService.getFoundReports({ page: 1, page_size: 1, status: "resolved" }),
      ]);
      const lost = lostRes.meta.total;
      const found = foundRes.meta.total;
      setStats({
        total: lost + found,
        lost,
        found,
        resolved: lostResolvedRes.meta.total + foundResolvedRes.meta.total,
      });
    } catch {
      // Statistics best effort
    }
  }, []);

  const reloadAll = useCallback(() => {
    void fetchReports();
    void fetchStats();
  }, [fetchReports, fetchStats]);

  useDataSync(reloadAll);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchReports(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchReports]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchStats(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStats]);

  const fetchReunionStories = useCallback(async () => {
    try {
      setReunionLoading(true);
      const stories = await lostFoundService.getReunionStories();
      setReunionStories(stories);
    } catch {
      setReunionStories([]);
    } finally {
      setReunionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reunion_stories") {
      void fetchReunionStories();
    }
  }, [activeTab, fetchReunionStories]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(reports.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkDeleting(true);
      const targetKind = activeTab === "found" ? "found" : "lost";
      await lostFoundService.bulkDeleteReports(selectedIds, targetKind);
      addToast(`Successfully deleted ${selectedIds.length} ${targetKind} report(s).`, "success");
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      reloadAll();
      notifyDataChanged();
    } catch (err) {
      addToast(extractError(err, "Failed to bulk delete reports"), "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleTabChange = (tab: NavigationTab) => {
    setActiveTab(tab);
    if (tab === "lost" || tab === "found") {
      setCardFilter(tab);
    } else if (tab === "overview") {
      setCardFilter("total");
    }
    setSelectedIds([]);
    setPage(1);
  };

  const handleCardClick = (filter: CardFilter) => {
    setCardFilter(filter);
    if (filter === "lost" || filter === "found") setActiveTab(filter);
    setStatusFilter(filter === "resolved" ? "resolved" : "");
    setPage(1);
  };

  const openDetails = (row: RegistryReport) => {
    setSelectedReport(row);
    const rowKind = (row as RegistryReport & { _kind?: unknown })._kind;
    const fallbackKind: ReportKind = activeTab === "found" ? "found" : "lost";
    const kind: ReportKind = rowKind === "found" || rowKind === "lost" ? rowKind : fallbackKind;
    setSelectedReportKind(kind);

    setTagData(null);
    setTagError(null);
    if (kind === "lost") {
      void fetchSafetyTagForReport(row);
    } else {
      setTagLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedReport(null);
    setTagData(null);
    setTagError(null);
    setTagLoading(false);
  };

  const handleCreateReport = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.report_type === "lost") {
      const missing = [
        formData.pet_name.trim() ? "" : "Pet name",
        formData.breed.trim() ? "" : "Breed",
        formData.color.trim() ? "" : "Color",
        formData.location_address.trim() ? "" : "Location address",
        formData.lost_at ? "" : "Lost date/time",
      ].filter(Boolean);
      if (missing.length > 0) {
        setFormError(`Please fill in: ${missing.join(", ")}`);
        return;
      }
    } else {
      const missing = [
        formData.breed_observed.trim() ? "" : "Breed",
        formData.color_observed.trim() ? "" : "Color",
        formData.location_address.trim() ? "" : "Location address",
        formData.found_at ? "" : "Found date/time",
      ].filter(Boolean);
      if (missing.length > 0) {
        setFormError(`Please fill in: ${missing.join(", ")}`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (formData.report_type === "lost") {
        await lostFoundService.createLostReport({
          species: formData.species,
          pet_name: formData.pet_name.trim(),
          breed: formData.breed.trim(),
          color: formData.color.trim(),
          microchip_id: trimOrNull(formData.microchip_id),
          collar_color: trimOrNull(formData.collar_color),
          collar_description: trimOrNull(formData.collar_description),
          marker_description: trimOrNull(formData.marker_description),
          location_address: formData.location_address.trim(),
          latitude: toNumOrNull(formData.latitude),
          longitude: toNumOrNull(formData.longitude),
          lost_at: new Date(formData.lost_at).toISOString(),
          photo_url: trimOrNull(formData.photo_url),
        });
        addToast("Lost pet report created successfully!", "success");
      } else {
        await lostFoundService.createFoundReport({
          species: formData.species,
          breed_observed: formData.breed_observed.trim(),
          color_observed: formData.color_observed.trim(),
          collar_color: trimOrNull(formData.collar_color),
          collar_description: trimOrNull(formData.collar_description),
          marker_description: trimOrNull(formData.marker_description),
          location_address: formData.location_address.trim(),
          latitude: toNumOrNull(formData.latitude),
          longitude: toNumOrNull(formData.longitude),
          found_at: new Date(formData.found_at).toISOString(),
          photo_url: trimOrNull(formData.photo_url),
        });
        addToast("Found pet report created successfully!", "success");
      }
      setIsAddModalOpen(false);
      resetForm();
      void fetchReports();
      void fetchStats();
      notifyDataChanged();
    } catch (err) {
      addToast(extractError(err, "Failed to create report"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedReport) return;
    try {
      setDeleting(true);
      await lostFoundService.deleteReport(selectedReport.id, selectedReportKind);
      addToast("Report deleted successfully!", "success");
      setIsDeleteConfirmOpen(false);
      closeDetails();
      void fetchReports();
      void fetchStats();
      notifyDataChanged();
    } catch (err) {
      addToast(extractError(err, "Failed to delete report"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleBroadcast = async () => {
    if (!selectedReport) return;
    try {
      setBroadcasting(true);
      const res = await lostFoundService.broadcastLostPetAlert(selectedReport.id, selectedReport);
      const message =
        (res && typeof res === "object"
          ? (res as { message?: unknown }).message
          : undefined) || "Lost pet alert broadcast successfully.";
      addToast(String(message), "success");
    } catch (err) {
      addToast(extractError(err, "Failed to broadcast lost pet alert"), "error");
    } finally {
      setBroadcasting(false);
    }
  };

  const refetchMatches = async (reportId: string, kind: ReportKind, open: boolean) => {
    if (open) {
      setIsMatchesOpen(true);
    }
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      const res = await lostFoundService.getReportMatches(reportId, kind);
      const allMatches = (res.data || []) as RegistryMatch[];
      const dogOnly = allMatches.filter((m) => {
        const linked = kind === "lost" ? m.found_report : m.lost_report;
        if (!linked || !linked.species) return true;
        return linked.species === "dog";
      });
      setMatches(dogOnly);
    } catch (err) {
      setMatchesError(extractError(err, "Failed to load matches."));
    } finally {
      setMatchesLoading(false);
    }
  };

  const openMatches = (report: RegistryReport) => {
    setSelectedReport(report);
    const rowKind = (report as RegistryReport & { _kind?: unknown })._kind;
    const fallbackKind: ReportKind = activeTab === "found" ? "found" : "lost";
    const kind: ReportKind = rowKind === "found" || rowKind === "lost" ? rowKind : fallbackKind;
    setSelectedReportKind(kind);
    void refetchMatches(report.id, kind, true);
  };

  const closeMatches = () => {
    setIsMatchesOpen(false);
    setMatches([]);
  };

  const handleSubmitClaim = async () => {
    if (!claimTarget) return;
    try {
      setActionBusy(true);
      await lostFoundService.submitClaim(claimTarget.id, {
        verification_notes: trimOrNull(claimNotes),
      });
      addToast("Ownership claim submitted for review.", "success");
      setClaimTarget(null);
      setClaimNotes("");
      if (selectedReport) {
        await refetchMatches(selectedReport.id, selectedReportKind, false);
      }
    } catch (err) {
      addToast(extractError(err, "Failed to submit claim"), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReviewClaim = async (approve: boolean) => {
    if (!reviewTarget) return;
    try {
      setActionBusy(true);
      await lostFoundService.reviewClaim(reviewTarget.id, {
        approve,
        verification_notes: trimOrNull(reviewNotes),
      });
      addToast(approve ? "Claim approved." : "Claim rejected.", "success");
      setReviewTarget(null);
      setReviewNotes("");
      if (selectedReport) {
        await refetchMatches(selectedReport.id, selectedReportKind, false);
      }
    } catch (err) {
      addToast(extractError(err, "Failed to review claim"), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleResolveMatch = async () => {
    if (!resolveTarget) return;
    try {
      setActionBusy(true);
      const res = await lostFoundService.resolveMatch(resolveTarget.id, true);
      const message =
        (res && typeof res === "object"
          ? (res as { message?: unknown }).message
          : undefined) || "Match resolved. Report marked as resolved.";
      addToast(String(message), "success");
      setResolveTarget(null);
      if (selectedReport) {
        await refetchMatches(selectedReport.id, selectedReportKind, false);
      }
      void fetchReports();
      void fetchStats();
    } catch (err) {
      addToast(extractError(err, "Failed to resolve match"), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const lostColumns: Column[] = [
    {
      key: "id",
      header: "Report #",
      render: (_v, row) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
          {shortId(row.id)}
        </span>
      ),
    },
    {
      key: "pet_name",
      header: "Lost Pet",
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{val || "-"}</div>
          <div style={{ marginTop: "2px" }}>{speciesChip(row.species)}</div>
        </div>
      ),
    },
    { key: "breed", header: "Breed" },
    { key: "color", header: "Color" },
    { key: "location_address", header: "Last Seen Location" },
    {
      key: "lost_at",
      header: "Lost Date/Time",
      render: (val) => <span style={{ whiteSpace: "nowrap" }}>{formatDate(val)}</span>,
    },
    {
      key: "user",
      header: "Reporter",
      render: (_v, row) => {
        const canSeeContact = role === "super_admin" || role === "rescue_centre_admin" || row.status === "resolved";
        if (!canSeeContact) {
          return <span style={{ color: "#64748B", fontSize: "12px" }}>🔒 Protected Contact</span>;
        }
        return (
          <span>
            {row.user?.full_name || row.user?.email || "Reporter Profile"}
            {row.user?.phone ? ` \u00b7 ${row.user.phone}` : ""}
          </span>
        );
      },
    },
    { key: "status", header: "Status", render: (val) => statusBadge(val) },
  ];

  const foundColumns: Column[] = [
    {
      key: "id",
      header: "Report #",
      render: (_v, row) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
          {shortId(row.id)}
        </span>
      ),
    },
    {
      key: "breed_observed",
      header: "Found Animal",
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{val || "-"}</div>
          <div style={{ marginTop: "2px" }}>{speciesChip(row.species)}</div>
        </div>
      ),
    },
    { key: "color_observed", header: "Color" },
    { key: "location_address", header: "Found Location" },
    {
      key: "found_at",
      header: "Found Date/Time",
      render: (val) => <span style={{ whiteSpace: "nowrap" }}>{formatDate(val)}</span>,
    },
    {
      key: "user",
      header: "Reporter",
      render: (_v, row) => {
        const canSeeContact = role === "super_admin" || role === "rescue_centre_admin" || row.status === "resolved";
        if (!canSeeContact) {
          return <span style={{ color: "#64748B", fontSize: "12px" }}>🔒 Protected Contact</span>;
        }
        return (
          <span>
            {row.user?.full_name || row.user?.email || "Reporter Profile"}
            {row.user?.phone ? ` \u00b7 ${row.user.phone}` : ""}
          </span>
        );
      },
    },
    { key: "status", header: "Status", render: (val) => statusBadge(val) },
  ];

  const combinedColumns: Column[] = [
    {
      key: "id",
      header: "Report #",
      render: (_v, row) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
          {shortId(row.id)}
        </span>
      ),
    },
    {
      key: "_kind",
      header: "Type",
      render: (_v, row) => kindBadge(row._kind),
    },
    {
      key: "_name",
      header: "Animal",
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>
            {row.pet_name || row.breed_observed || "-"}
          </div>
          <div style={{ marginTop: "2px" }}>{speciesChip(row.species)}</div>
        </div>
      ),
    },
    {
      key: "_breed",
      header: "Breed",
      render: (_v, row) => row.breed || row.breed_observed || "-",
    },
    {
      key: "_color",
      header: "Color",
      render: (_v, row) => row.color || row.color_observed || "-",
    },
    { key: "location_address", header: "Location" },
    {
      key: "_date",
      header: "Reported Date/Time",
      render: (_v, row) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {formatDate(row.lost_at || row.found_at)}
        </span>
      ),
    },
    {
      key: "user",
      header: "Reporter",
      render: (_v, row) => {
        const canSeeContact = role === "super_admin" || role === "rescue_centre_admin" || row.status === "resolved";
        if (!canSeeContact) {
          return <span style={{ color: "#64748B", fontSize: "12px" }}>🔒 Protected Contact</span>;
        }
        return (
          <span>
            {row.user?.full_name || row.user?.email || "Reporter Profile"}
            {row.user?.phone ? ` \u00b7 ${row.user.phone}` : ""}
          </span>
        );
      },
    },
    { key: "status", header: "Status", render: (val) => statusBadge(val) },
  ];

  const selectColumn: Column = {
    key: "_select",
    header: "Select",
    render: (_v, row) => (
      <input
        type="checkbox"
        checked={selectedIds.includes(row.id)}
        onChange={() => handleToggleSelectOne(row.id)}
        style={{ cursor: "pointer" }}
      />
    ),
  };

  const rawColumns = combined
    ? combinedColumns
    : activeTab === "lost"
      ? lostColumns
      : foundColumns;

  const columns = can("lost_found", "delete") ? [selectColumn, ...rawColumns] : rawColumns;

  const hasActiveFilters = Boolean(search || statusFilter);

  const detailFields: DetailField[] = selectedReport
    ? (() => {
        const report = selectedReport;
        const kind = selectedReportKind;
        const base: DetailField[] =
          kind === "lost"
            ? [
                { label: "Pet Name", value: report.pet_name || "-" },
                { label: "Species", value: titleCase(report.species || "other") },
                { label: "Breed", value: report.breed || "-" },
                { label: "Color", value: report.color || "-" },
                {
                  label: "Microchip ID",
                  value: report.microchip_id || "Not available",
                  icon: <FaMicrochip size={13} />,
                },
                {
                  label: "Lost Date/Time",
                  value: formatDate(report.lost_at),
                  icon: <FaClock size={13} />,
                },
              ]
            : [
                { label: "Species", value: titleCase(report.species || "other") },
                { label: "Breed Observed", value: report.breed_observed || "-" },
                { label: "Color Observed", value: report.color_observed || "-" },
                {
                  label: "Found Date/Time",
                  value: formatDate(report.found_at),
                  icon: <FaClock size={13} />,
                },
              ];
        return base.concat([
          {
            label: kind === "lost" ? "Last Seen Location" : "Found Location",
            value: report.location_address || "-",
            icon: <FaMapMarkerAlt size={13} />,
          },
          {
            label: "Latitude",
            value: formatCoord(report.latitude),
          },
          {
            label: "Longitude",
            value: formatCoord(report.longitude),
          },
          {
            label: "Collar",
            value:
              [report.collar_color, report.collar_description].filter(Boolean).join(" \u2014 ") ||
              "Not specified",
          },
          {
            label: "Markers / Description",
            value: report.marker_description || "Not specified",
          },
          { label: "Reported", value: formatDate(report.created_at) },
          {
            label: "Reporter",
            value:
              role === "super_admin" || role === "rescue_centre_admin" || report.status === "resolved"
                ? report.user?.full_name || report.user?.email || "Reporter Profile"
                : "🔒 Protected (Pending Verification)",
            icon: <FaUser size={13} />,
          },
          {
            label: "Reporter Contact",
            value:
              role === "super_admin" || role === "rescue_centre_admin" || report.status === "resolved"
                ? [report.user?.phone, report.user?.email].filter(Boolean).join(" \u00b7 ") || "Not available"
                : "🔒 Protected (Released after ownership match verification)",
          },
          { label: "Status", value: "", badge: statusBadge(report.status) },
        ]);
      })()
    : [];

  const commonInputStyle: CSSProperties = {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #CBD5E1",
    fontSize: "13px",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "#334155" };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Lost &amp; Found Pet Registry
          </h1>
          <p style={{ color: "#64748B", margin: "4px 0 0 0", fontSize: "14px" }}>
            Match lost pet reports with rescued animals and reunite pets with owners.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setVerifyExpectedAnimalId(undefined);
              setIsVerifyScannerOpen(true);
            }}
            style={{
              background: "#0F172A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <FaQrcode size={14} />
            <span>Verify Safety Tag</span>
          </button>
          <Can permission="create_lost_found">
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              style={{
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <FaPlus size={14} />
              <span>New Report</span>
            </button>
          </Can>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title="Total Listings"
          value={stats.total}
          icon={<FaSearchLocation />}
          color="#2563EB"
          onClick={() => handleCardClick("total")}
          selected={cardFilter === "total"}
        />
        <StatCard
          title="Lost Pet Reports"
          value={stats.lost}
          icon={<FaExclamationCircle />}
          color="#EF4444"
          onClick={() => handleCardClick("lost")}
          selected={cardFilter === "lost"}
        />
        <StatCard
          title="Found Pet Reports"
          value={stats.found}
          icon={<FaSearchLocation />}
          color="#F59E0B"
          onClick={() => handleCardClick("found")}
          selected={cardFilter === "found"}
        />
        <StatCard
          title="Resolved (Reunited)"
          value={stats.resolved}
          icon={<FaCheckCircle />}
          color="#10B981"
          onClick={() => handleCardClick("resolved")}
          selected={cardFilter === "resolved"}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "#F1F5F9",
            borderRadius: "10px",
            padding: "4px",
            gap: "4px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => handleTabChange("overview")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "overview" ? "#FFFFFF" : "transparent",
              color: activeTab === "overview" ? "#2563EB" : "#475569",
              boxShadow: activeTab === "overview" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
            }}
          >
            Overview
          </button>
          <button
            onClick={() => handleTabChange("lost")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "lost" ? "#FFFFFF" : "transparent",
              color: activeTab === "lost" ? "#2563EB" : "#475569",
              boxShadow: activeTab === "lost" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
            }}
          >
            Lost Reports
          </button>
          <button
            onClick={() => handleTabChange("found")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "found" ? "#FFFFFF" : "transparent",
              color: activeTab === "found" ? "#2563EB" : "#475569",
              boxShadow: activeTab === "found" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
            }}
          >
            Found Reports
          </button>
          <button
            onClick={() => handleTabChange("matches")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "matches" ? "#FFFFFF" : "transparent",
              color: activeTab === "matches" ? "#2563EB" : "#475569",
              boxShadow: activeTab === "matches" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
            }}
          >
            Matches
          </button>
          <button
            onClick={() => handleTabChange("reunion_stories")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "reunion_stories" ? "#FFFFFF" : "transparent",
              color: activeTab === "reunion_stories" ? "#2563EB" : "#475569",
              boxShadow: activeTab === "reunion_stories" ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
            }}
          >
            Reunion Stories
          </button>
        </div>

        {activeTab !== "reunion_stories" && (
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              if (cardFilter === "resolved") setCardFilter("total");
              setPage(1);
            }}
            style={{ ...commonInputStyle, width: "auto", minWidth: "150px" }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setCardFilter("total");
              setPage(1);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear Filters
          </button>
        )}

        {reports.length > 0 && can("lost_found", "delete") && activeTab !== "reunion_stories" && (
          <button
            onClick={() => handleToggleSelectAll(selectedIds.length !== reports.length)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {selectedIds.length === reports.length ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      {selectedIds.length > 0 && can("lost_found", "delete") && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            marginBottom: "12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B" }}>
            {selectedIds.length} report(s) selected
          </span>
          <button
            onClick={() => setIsBulkDeleteModalOpen(true)}
            style={{
              background: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <FaTrash size={12} /> Bulk Delete Selected ({selectedIds.length})
          </button>
        </div>
      )}

      {activeTab === "reunion_stories" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Reunion &amp; Success Stories
            </h2>
          </div>

          {reunionLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
              <FaSpinner className="spin" size={24} />
              <p style={{ marginTop: "8px" }}>Loading reunion stories...</p>
            </div>
          ) : reunionStories.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", background: "#F8FAFC", borderRadius: "12px", color: "#64748B" }}>
              <FaHandshake size={32} style={{ color: "#94A3B8", marginBottom: "8px" }} />
              <h3 style={{ fontSize: "16px", margin: "0 0 4px 0", color: "#334155" }}>No Reunion Stories Yet</h3>
              <p style={{ fontSize: "14px", margin: 0 }}>Reunion stories from resolved matches will appear here.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {reunionStories.map((story) => (
                <div
                  key={story.id || Math.random()}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  {story.hero_image_url && (
                    <img
                      src={story.hero_image_url}
                      alt={story.title}
                      style={{ width: "100%", height: "160px", objectFit: "cover" }}
                    />
                  )}
                  <div style={{ padding: "16px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
                      {story.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                      {story.summary || story.body}
                    </p>
                    <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                      Published: {formatDate(story.published_at || story.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "matches" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Pet Match Verification &amp; Claims Workspace
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#64748B", marginTop: "-8px", marginBottom: "16px" }}>
            Select any report from the registry to view potential automated matches, submit/review ownership claims, or resolve matches.
          </p>
          <DataTable
            data={reports}
            columns={columns}
            loading={loading}
            error={error}
            onRetry={() => void fetchReports()}
            module="lost_found"
            serverMode
            totalCount={totalCount}
            page={page}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
            searchValue={search}
            onSearchChange={setSearch}
            renderRowActions={(row: RegistryReport) => (
              <button
                type="button"
                onClick={() => openMatches(row)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #C084FC",
                  background: "#F3E8FF",
                  color: "#7E22CE",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <FaHandshake size={12} /> View Matches
              </button>
            )}
          />
        </div>
      ) : (
        <DataTable
          data={reports}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={() => void fetchReports()}
          emptyMessage={
            hasActiveFilters
              ? "No reports match the current filters."
              : "No active lost or found pet reports."
          }
          module="lost_found"
          serverMode
          totalCount={totalCount}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          searchValue={search}
          onSearchChange={setSearch}
          onRowClick={(row: RegistryReport) => openDetails(row)}
          renderRowActions={(row: RegistryReport) => {
            const rowKind = (row as RegistryReport & { _kind?: unknown })._kind;
            const kind = rowKind === "found" || rowKind === "lost" ? rowKind : (activeTab === "found" ? "found" : "lost");
            return (
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => openDetails(row)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "5px 9px",
                    borderRadius: "6px",
                    border: "1px solid #93C5FD",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FaEye size={12} /> View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const animalId = row.companion_pet_id || (row as any).pet_id || (row as any).dog_id;
                    setVerifyExpectedAnimalId(animalId ? String(animalId) : undefined);
                    setIsVerifyScannerOpen(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "5px 9px",
                    borderRadius: "6px",
                    border: "1px solid #38BDF8",
                    background: "#F0F9FF",
                    color: "#0369A1",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FaQrcode size={12} /> Verify Tag
                </button>
                <button
                  type="button"
                  onClick={() => openMatches(row)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "5px 9px",
                    borderRadius: "6px",
                    border: "1px solid #C084FC",
                    background: "#F3E8FF",
                    color: "#7E22CE",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FaHandshake size={12} /> Matches
                </button>
                {kind === "lost" && (
                  <Can permission="broadcast_lost_found">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReport(row);
                        setSelectedReportKind("lost");
                        void handleBroadcast();
                      }}
                      disabled={broadcasting && selectedReport?.id === row.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 9px",
                        borderRadius: "6px",
                        border: "1px solid #FCD34D",
                        background: "#FEF3C7",
                        color: "#B45309",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <FaBroadcastTower size={12} /> Broadcast
                    </button>
                  </Can>
                )}
                <Can permission="delete_lost_found">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(row);
                      setSelectedReportKind(kind);
                      setIsDeleteConfirmOpen(true);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 9px",
                      borderRadius: "6px",
                      border: "1px solid #FCA5A5",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <FaTrash size={12} /> Delete
                  </button>
                </Can>
              </div>
            );
          }}
        />
      )}

      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={closeDetails}
          title={`Report Details \u2014 ${selectedReport.pet_name || selectedReport.breed_observed || shortId(selectedReport.id)}`}
          maxWidth="640px"
          footer={
            <div
              style={{
                display: "flex",
                gap: "10px",
                width: "100%",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <Can permission="view_lost_found">
                <button
                  onClick={() => openMatches(selectedReport)}
                  style={{
                    background: "#7C3AED",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaHandshake /> View Matches
                </button>
              </Can>
              <Can permission="manage_lost_found">
                {selectedReportKind === "lost" && (
                  <button
                    onClick={() => void handleBroadcast()}
                    disabled={broadcasting}
                    style={{
                      background: "#2563EB",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "9px 18px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: broadcasting ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FaBroadcastTower /> {broadcasting ? "Broadcasting\u2026" : "Broadcast Alert"}
                  </button>
                )}
              </Can>
              <Can permission="delete_lost_found">
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  style={{
                    background: "#EF4444",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaTrash /> Delete
                </button>
              </Can>
              <button
                onClick={closeDetails}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          }
        >
          {selectedReport.photo_url && (
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <img
                src={selectedReport.photo_url}
                alt="Reported pet"
                style={{
                  maxWidth: "100%",
                  maxHeight: "260px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  objectFit: "cover",
                }}
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {detailFields.map((f) => (
              <div
                key={f.label}
                style={{
                  background: "#F8FAFC",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #F1F5F9",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {f.icon}
                  {f.label}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", wordBreak: "break-word" }}>
                  {f.badge || f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Safety Tag / QR Section for Lost Reports */}
          {selectedReportKind === "lost" && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px",
                borderRadius: "10px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <FaQrcode color="#6366F1" size={16} /> Dog Safety Tag &amp; QR Identifier
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const animalId = selectedReport.companion_pet_id || (selectedReport as any).pet_id || (selectedReport as any).dog_id;
                      setVerifyExpectedAnimalId(animalId ? String(animalId) : undefined);
                      setIsVerifyScannerOpen(true);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#2563EB",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <FaQrcode size={11} /> Verify via Scanner
                  </button>
                  {tagData && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: tagData.is_active ? "#ECFDF5" : "#FEF2F2",
                        color: tagData.is_active ? "#059669" : "#DC2626",
                      }}
                    >
                      {tagData.is_active ? "● ACTIVE SAFETY TAG" : "○ INACTIVE / REVOKED"}
                    </span>
                  )}
                </div>
              </div>

              {tagLoading ? (
                <div style={{ padding: "12px 0", color: "#2563EB", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaSpinner size={14} style={{ animation: "spin 1s linear infinite" }} /> Fetching registered dog Safety Tag...
                </div>
              ) : tagError ? (
                <div style={{ color: "#991B1B", background: "#FEF2F2", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                  ⚠️ {tagError}
                </div>
              ) : tagData ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: "6px" }}>
                  <div style={{ background: "#FFF", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Tag ID / Token Prefix</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#4338CA", fontFamily: "monospace", marginTop: "2px" }}>
                      {tagData.token_prefix || tagData.tag_number || shortId(tagData.id)}
                    </div>
                  </div>

                  <div style={{ background: "#FFF", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Tag Internal ID</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#0F172A", fontFamily: "monospace", marginTop: "2px" }}>
                      {shortId(tagData.id)}
                    </div>
                  </div>

                  {typeof tagData.scan_count === "number" && (
                    <div style={{ background: "#FFF", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Public Scans</div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                        {tagData.scan_count} Scans
                      </div>
                    </div>
                  )}

                  {tagData.created_at && (
                    <div style={{ background: "#FFF", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Provisioned Date</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                        {formatDate(tagData.created_at)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "10px", borderRadius: "8px", background: "#FFF", border: "1px dashed #CBD5E1", fontSize: "13px", color: "#64748B", fontWeight: 600 }}>
                  🏷️ No Safety Tag Assigned
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <LocationMapPreview
              latitude={selectedReport.latitude}
              longitude={selectedReport.longitude}
              locationAddress={selectedReport.location_address}
              height="220px"
              title={selectedReportKind === "lost" ? "Last Seen GPS Location Pin" : "Found GPS Location Pin"}
            />
          </div>
        </Modal>
      )}

      {isMatchesOpen && selectedReport && (
        <Modal
          isOpen={true}
          onClose={closeMatches}
          title="Potential Matches"
          maxWidth="760px"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <button
                onClick={closeMatches}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          }
        >
          {role === "rescue_centre_admin" && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#1E40AF",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Review these matches against your rescue cases to identify animals that may relate
              to ongoing rescue operations.
            </div>
          )}
          {matchesLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#2563EB" }}>
              <FaSpinner size={24} style={{ animation: "spin 1s linear infinite" }} />
              <div style={{ marginTop: "10px", fontSize: "13px", color: "#64748B" }}>
                Loading potential matches\u2026
              </div>
            </div>
          ) : matchesError ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <div
                style={{
                  background: "#FEF2F2",
                  color: "#991B1B",
                  padding: "14px",
                  borderRadius: "10px",
                  display: "inline-block",
                }}
              >
                {matchesError}
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
              <FaHandshake size={26} style={{ opacity: 0.5, marginBottom: "10px" }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No potential matches found yet</p>
              <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                Matches are generated by the backend against other lost / found reports.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {matches.map((match) => {
                const canManageMatch = can("manage", "lost_found");
                const reportResolved = selectedReport?.status === "resolved";
                const canClaim =
                  match.status === "pending" && !match.claim_submitted_at;
                const canReview =
                  match.status === "pending" &&
                  Boolean(match.claim_submitted_at) &&
                  !match.claim_reviewed_at;
                const canResolve =
                  match.status === "pending" || match.status === "confirmed";
                const linkedReport = (
                  selectedReportKind === "lost" ? match.found_report : match.lost_report
                ) as RegistryReport | null | undefined;
                return (
                  <div
                    key={match.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      padding: "14px 16px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
                          {shortId(match.id)}
                        </span>
                        {matchStatusBadge(match.status)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
                        {typeof match.confidence_score === "number"
                          ? `${Math.round(match.confidence_score * 100)}% match`
                          : "Score n/a"}
                        {typeof match.distance_km === "number" &&
                          ` \u00b7 ${match.distance_km.toFixed(2)} km`}
                        {typeof match.temporal_gap_days === "number" &&
                          ` \u00b7 ${Math.round(match.temporal_gap_days)}d gap`}
                      </div>
                    </div>

                    {Array.isArray(match.match_reasons) && match.match_reasons.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          marginTop: "10px",
                        }}
                      >
                        {match.match_reasons.map((reason: string) => (
                          <span
                            key={reason}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "#EFF6FF",
                              color: "#2563EB",
                            }}
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {match.claim_submitted_at && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          color: "#475569",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "#F8FAFC",
                          border: "1px solid #F1F5F9",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                          Claim submitted {formatDate(match.claim_submitted_at)}
                        </div>
                        {match.verification_notes && <div>{match.verification_notes}</div>}
                      </div>
                    )}

                    {linkedReport && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          color: "#334155",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: "#475569",
                            textTransform: "uppercase",
                            fontSize: "10px",
                            letterSpacing: "0.04em",
                            marginBottom: "6px",
                          }}
                        >
                          {selectedReportKind === "lost" ? "Linked Found Report" : "Linked Lost Report"}
                        </div>
                        <div style={{ display: "grid", gap: "4px" }}>
                          {selectedReportKind === "found" && (
                            <>
                              <div>
                                <strong>Pet:</strong> {linkedReport.pet_name || "-"}
                                {" \u00b7 "}
                                {speciesChip(linkedReport.species)}
                              </div>
                              {linkedReport.microchip_id && (
                                <div>
                                  <strong>Microchip:</strong> {linkedReport.microchip_id}
                                </div>
                              )}
                              <div>
                                <strong>Breed:</strong> {linkedReport.breed || "-"} ·{" "}
                                <strong>Color:</strong> {linkedReport.color || "-"}
                              </div>
                            </>
                          )}
                          {selectedReportKind === "lost" && (
                            <>
                              <div>
                                <strong>Breed:</strong> {linkedReport.breed_observed || "-"} ·{" "}
                                <strong>Color:</strong> {linkedReport.color_observed || "-"}
                              </div>
                            </>
                          )}
                          <div>
                            <strong>Location:</strong> {linkedReport.location_address || "-"}
                          </div>
                          <div>
                            <strong>Date/Time:</strong>{" "}
                            {selectedReportKind === "lost"
                              ? formatDate(linkedReport.found_at)
                              : formatDate(linkedReport.lost_at)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong>Status:</strong> {statusBadge(linkedReport.status)}
                          </div>
                        </div>
                      </div>
                    )}

                    {reportResolved ? (
                      <div style={{ marginTop: "10px", fontSize: "12px", color: "#94A3B8" }}>
                        Report is already resolved — no further actions available.
                      </div>
                    ) : canClaim || canReview || canResolve ? (
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                        {canClaim && (
                          <button
                            onClick={() => {
                              setClaimNotes("");
                              setClaimTarget(match);
                            }}
                            disabled={!canManageMatch}
                            style={{
                              padding: "7px 14px",
                              borderRadius: "8px",
                              background: canManageMatch ? "#2563EB" : "#94A3B8",
                              color: "#FFFFFF",
                              border: "none",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: canManageMatch ? "pointer" : "not-allowed",
                            }}
                          >
                            Submit Claim
                          </button>
                        )}
                        {canReview && (
                          <button
                            onClick={() => {
                              setReviewNotes("");
                              setReviewTarget(match);
                            }}
                            disabled={!canManageMatch}
                            style={{
                              padding: "7px 14px",
                              borderRadius: "8px",
                              background: canManageMatch ? "#7C3AED" : "#94A3B8",
                              color: "#FFFFFF",
                              border: "none",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: canManageMatch ? "pointer" : "not-allowed",
                            }}
                          >
                            Review Claim
                          </button>
                        )}
                        {canResolve && (
                          <button
                            onClick={() => setResolveTarget(match)}
                            disabled={!canManageMatch}
                            style={{
                              padding: "7px 14px",
                              borderRadius: "8px",
                              background: canManageMatch ? "#10B981" : "#94A3B8",
                              color: "#FFFFFF",
                              border: "none",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: canManageMatch ? "pointer" : "not-allowed",
                            }}
                          >
                            Resolve Match
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: "10px", fontSize: "12px", color: "#94A3B8" }}>
                        No further actions available for this match.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {claimTarget && (
        <Modal
          isOpen={true}
          onClose={() => setClaimTarget(null)}
          title="Submit Ownership Claim"
          maxWidth="480px"
          footer={
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
              <button
                onClick={() => setClaimTarget(null)}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmitClaim()}
                disabled={actionBusy}
                style={{
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: actionBusy ? "wait" : "pointer",
                }}
              >
                {actionBusy ? "Submitting\u2026" : "Submit Claim"}
              </button>
            </div>
          }
        >
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>
            Submitting a claim starts the ownership verification workflow for match{" "}
            <strong style={{ fontFamily: "monospace" }}>{shortId(claimTarget.id)}</strong>. The
            claim must then be reviewed and resolved.
          </p>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
            Verification Notes (optional)
          </label>
          <textarea
            value={claimNotes}
            onChange={(e) => setClaimNotes(e.target.value)}
            rows={3}
            placeholder="Any notes or context supporting the ownership claim"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              fontSize: "13px",
              boxSizing: "border-box",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </Modal>
      )}

      {reviewTarget && (
        <Modal
          isOpen={true}
          onClose={() => setReviewTarget(null)}
          title="Review Ownership Claim"
          maxWidth="480px"
          footer={
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
              <button
                onClick={() => setReviewTarget(null)}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleReviewClaim(false)}
                disabled={actionBusy}
                style={{
                  background: "#EF4444",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: actionBusy ? "wait" : "pointer",
                }}
              >
                {actionBusy ? "Working\u2026" : "Reject Claim"}
              </button>
              <button
                onClick={() => void handleReviewClaim(true)}
                disabled={actionBusy}
                style={{
                  background: "#10B981",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: actionBusy ? "wait" : "pointer",
                }}
              >
                {actionBusy ? "Working\u2026" : "Approve Claim"}
              </button>
            </div>
          }
        >
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>
            Decide whether to approve or reject the ownership claim for match{" "}
            <strong style={{ fontFamily: "monospace" }}>{shortId(reviewTarget.id)}</strong>.
          </p>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
            Verification Notes (optional)
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={3}
            placeholder="Reason or evidence supporting this decision"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              fontSize: "13px",
              boxSizing: "border-box",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </Modal>
      )}

      {resolveTarget && (
        <Modal
          isOpen={true}
          onClose={() => setResolveTarget(null)}
          title="Resolve Match"
          maxWidth="440px"
          footer={
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
              <button
                onClick={() => setResolveTarget(null)}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleResolveMatch()}
                disabled={actionBusy}
                style={{
                  background: "#10B981",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: actionBusy ? "wait" : "pointer",
                }}
              >
                {actionBusy ? "Resolving\u2026" : "Confirm Resolve"}
              </button>
            </div>
          }
        >
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <FaCheckCircle size={36} style={{ color: "#10B981", marginBottom: "12px" }} />
            <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Confirm resolve?
            </h4>
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}>
              Resolving this match marks the associated report as resolved and closes the
              workflow.
            </p>
          </div>
        </Modal>
      )}

      {isDeleteConfirmOpen && selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title="Delete Report"
          maxWidth="450px"
          footer={
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
                style={{
                  background: "#EF4444",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: deleting ? "wait" : "pointer",
                }}
              >
                {deleting ? "Deleting\u2026" : "Delete Report"}
              </button>
            </div>
          }
        >
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <FaTrash size={36} style={{ color: "#EF4444", marginBottom: "12px" }} />
            <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Delete this report?
            </h4>
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}>
              Are you sure you want to delete report{" "}
              <strong style={{ fontFamily: "monospace" }}>{shortId(selectedReport.id)}</strong>?
              This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Log Lost/Found Pet"
        maxWidth="620px"
      >
        <form onSubmit={handleCreateReport} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Report Type</label>
              <select
                value={formData.report_type}
                onChange={(e) =>
                  setFormData({ ...formData, report_type: e.target.value as ReportKind })
                }
                style={commonInputStyle}
              >
                <option value="lost">Lost Pet (Missing)</option>
                <option value="found">Found Pet (Spotted/Rescued)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Species</label>
              <select
                value={formData.species}
                onChange={(e) =>
                  setFormData({ ...formData, species: e.target.value as Species })
                }
                disabled
                style={{ ...commonInputStyle, background: "#F1F5F9", color: "#475569" }}
              >
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.report_type === "lost" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Pet Name *</label>
                <input
                  type="text"
                  value={formData.pet_name}
                  onChange={(e) => setFormData({ ...formData, pet_name: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Breed *</label>
                <input
                  type="text"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Color *</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Microchip ID</label>
                <input
                  type="text"
                  value={formData.microchip_id}
                  onChange={(e) => setFormData({ ...formData, microchip_id: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Lost Date/Time *</label>
                <input
                  type="datetime-local"
                  value={formData.lost_at}
                  onChange={(e) => setFormData({ ...formData, lost_at: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Breed Observed *</label>
                <input
                  type="text"
                  value={formData.breed_observed}
                  onChange={(e) => setFormData({ ...formData, breed_observed: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Color Observed *</label>
                <input
                  type="text"
                  value={formData.color_observed}
                  onChange={(e) => setFormData({ ...formData, color_observed: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Found Date/Time *</label>
                <input
                  type="datetime-local"
                  value={formData.found_at}
                  onChange={(e) => setFormData({ ...formData, found_at: e.target.value })}
                  style={commonInputStyle}
                />
              </div>
            </div>
          )}

          {/* Location Address & GPS Capture */}
          <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, margin: 0, fontWeight: 700 }}>
                {formData.report_type === "lost" ? "Last Seen Location *" : "Found Location *"}
              </label>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isLocating}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: "1px solid #2563EB",
                  background: "#EFF6FF",
                  color: "#2563EB",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isLocating ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isLocating ? (
                  <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <FaSearchLocation />
                )}
                {isLocating ? "Capturing GPS..." : "Use Current Location"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, fontSize: "11px", color: "#64748B" }}>Street Address / Area</label>
                <input
                  type="text"
                  required
                  value={formData.location_address}
                  onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                  style={commonInputStyle}
                  placeholder={
                    formData.report_type === "lost"
                      ? "e.g., Jubilee Hills Sector 2, Near Park"
                      : "e.g., Banjara Hills Road No. 12, Near Shelter"
                  }
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "11px", color: "#64748B" }}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 17.43260"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    style={commonInputStyle}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "11px", color: "#64748B" }}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 78.40710"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    style={commonInputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Live Map Preview in Form */}
            {toNumOrNull(formData.latitude) !== null && toNumOrNull(formData.longitude) !== null && (
              <div style={{ marginTop: "10px" }}>
                <LocationMapPreview
                  latitude={toNumOrNull(formData.latitude)}
                  longitude={toNumOrNull(formData.longitude)}
                  locationAddress={formData.location_address}
                  height="160px"
                  title={formData.report_type === "lost" ? "Captured Last-Seen GPS Pin" : "Captured Found GPS Pin"}
                />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Collar Color</label>
              <input
                type="text"
                value={formData.collar_color}
                onChange={(e) => setFormData({ ...formData, collar_color: e.target.value })}
                style={commonInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Collar Description</label>
              <input
                type="text"
                value={formData.collar_description}
                onChange={(e) => setFormData({ ...formData, collar_description: e.target.value })}
                style={commonInputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Distinctive Markers / Description</label>
            <textarea
              value={formData.marker_description}
              onChange={(e) => setFormData({ ...formData, marker_description: e.target.value })}
              rows={3}
              style={{ ...commonInputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Photo URL</label>
            <input
              type="url"
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              style={commonInputStyle}
              placeholder="https://..."
            />
          </div>

          {formError && (
            <div
              style={{
                background: "#FEF2F2",
                color: "#991B1B",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFF",
                color: "#475569",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                background: "#2563EB",
                color: "#FFF",
                border: "none",
                cursor: isSubmitting ? "wait" : "pointer",
                fontWeight: 600,
              }}
            >
              {isSubmitting ? "Submitting..." : "Save Listing"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title={`Bulk Delete ${selectedIds.length} Reports`}
      >
        <div style={{ textAlign: "center", padding: "16px" }}>
          <FaTrash size={36} style={{ color: "#EF4444", marginBottom: "12px" }} />
          <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Delete {selectedIds.length} Selected {activeTab === "found" ? "Found" : "Lost"} Pet Reports?
          </h4>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}>
            Are you sure you want to permanently bulk delete the selected {selectedIds.length} report(s)?
            This operation sends a bulk request to the backend and cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setIsBulkDeleteModalOpen(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFF",
                color: "#475569",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDeleteConfirm}
              disabled={bulkDeleting}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                background: "#DC2626",
                color: "#FFF",
                border: "none",
                cursor: bulkDeleting ? "wait" : "pointer",
                fontWeight: 700,
              }}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.length} Reports`}
            </button>
          </div>
        </div>
      </Modal>

      <QrScannerModal
        isOpen={isVerifyScannerOpen}
        onClose={() => setIsVerifyScannerOpen(false)}
        expectedAnimalId={verifyExpectedAnimalId}
      />
    </div>
  );
};

export default LostAndFound;