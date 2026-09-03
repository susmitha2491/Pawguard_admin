import React, { useEffect, useState, useCallback } from "react";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaAmbulance,
  FaCamera,
  FaCheckCircle,
  FaClipboardCheck,
  FaSearch,
  FaMapMarkerAlt,
  FaExternalLinkAlt,
  FaDog,
  FaCompass,
  FaExclamationTriangle,
  FaLocationArrow,
} from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import rescueService from "../../../services/rescueService";
import petService from "../../../services/petService";
import storageService from "../../../services/storageService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { getCurrentUser } from "../../../utils/roleUtils";
import { rescueStatusBadge } from "../../../utils/rescueStatus.tsx";
import { formatDateTime } from "../../../utils/dateUtils";

interface RescueDashboardData {
  total_calls: number;
  pending: number;
  dispatched: number;
  rescued: number;
  recent_calls: Record<string, unknown>[];
}

type CardTab = "assigned" | "pending" | "completed" | "all";

const unwrapList = (v: unknown): Record<string, unknown>[] => {
  if (!v || typeof v !== "object") return [];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const obj = v as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as Record<string, unknown>).data)) {
    return (obj.data as Record<string, unknown>).data as Record<string, unknown>[];
  }
  if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
  if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as Record<string, unknown>).items)) {
    return (obj.data as Record<string, unknown>).items as Record<string, unknown>[];
  }
  return [];
};

const formatAssigned = (c: Record<string, unknown>, localStatuses: Record<string, string> = {}) => {
  const rawStatus = String(c.status || "-").toLowerCase();
  const dispatchObj = c.dispatch ? { ...(c.dispatch as Record<string, unknown>) } : null;
  const assignedAgentId = String(c.assigned_agent_id || c.agent_id || dispatchObj?.assigned_driver_id || dispatchObj?.agent_id || c.assigned_agent || "");
  const hasAssignment = !!(c.coordinator_id || assignedAgentId || dispatchObj);
  
  const caseId = String(c.id || c.ticket_number || "");
  const localStatus = localStatuses[caseId];

  let displayStatus = (rawStatus === "verified" && hasAssignment) ? "accepted" : rawStatus;
  if (localStatus) {
    displayStatus = localStatus;
  }
  if (dispatchObj && localStatus) {
    dispatchObj.status = localStatus;
  }

  return {
    id: caseId,
    ticket: String(c.ticket_number || c.id || "-"),
    reporter: String(c.reporter_name || c.reporter || "-"),
    phone: String(c.reporter_phone || c.phone || "-"),
    animal_count: (c.animal_count ?? "-") as string | number,
    status: displayStatus,
    location: String(c.location_address || c.location || "-"),
    severity: String(c.severity || "-"),
    is_urgent: !!c.is_urgent,
    dispatch_id: String(dispatchObj?.id || dispatchObj?.dispatch_id || ""),
    vehicle: String(dispatchObj?.assigned_vehicle_id || dispatchObj?.vehicle_id || "-"),
    agents: Array.isArray(dispatchObj?.agents) && (dispatchObj.agents as Record<string, unknown>[]).length > 0
      ? (dispatchObj.agents as Record<string, unknown>[]).map((a: Record<string, unknown>) => String(a.agent_id || a.id || "")).join(", ")
      : "-",
    dispatched_at: dispatchObj?.dispatched_at ? formatDateTime(dispatchObj.dispatched_at as string) : "-",
    created_at: c.created_at ? formatDateTime(c.created_at as string) : "-",
    media: Array.isArray(c.media_evidence) ? (c.media_evidence as string[]) : Array.isArray(c.media_urls) ? (c.media_urls as string[]) : [],
    raw: { ...c, dispatch: dispatchObj },
  };
};

const RescueAgentDashboard = () => {
  const { addToast } = useToast();
  const [activeCard, setActiveCard] = useState<CardTab>("assigned");
  const [searchQuery, setSearchQuery] = useState("");

  const [dashboardData, setDashboardData] = useState<RescueDashboardData>({
    total_calls: 0,
    pending: 0,
    dispatched: 0,
    rescued: 0,
    recent_calls: [],
  });

  const [assignedCases, setAssignedCases] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local statuses persistence for en route / accepted states
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("pg_rescue_local_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateLocalStatus = (caseId: string, status: string) => {
    setLocalStatuses((prev) => {
      const next = { ...prev, [caseId]: status };
      try {
        localStorage.setItem("pg_rescue_local_statuses", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearLocalStatus = (caseId: string) => {
    setLocalStatuses((prev) => {
      const next = { ...prev };
      delete next[caseId];
      try {
        localStorage.setItem("pg_rescue_local_statuses", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Real GPS Telemetry State
  const [watchId, setWatchId] = useState<number | null>(null);
  const [currentGps, setCurrentGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    timestamp: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "active" | "denied" | "error">("idle");
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Offline Queue State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("pg_rescue_offline_queue");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const queueOfflineAction = (action: { type: string; caseId: string; payload: any }) => {
    setOfflineQueue((prev) => {
      const next = [...prev, { ...action, timestamp: new Date().toISOString() }];
      try {
        localStorage.setItem("pg_rescue_offline_queue", JSON.stringify(next));
      } catch {}
      return next;
    });
    addToast(`Offline mode: Action queued locally (${action.type}). Will sync when online.`, "info");
  };

  const startGpsTracking = (caseId?: string) => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsErrorMsg("Geolocation is not supported by this device/browser.");
      addToast("Device location is unavailable.", "error");
      return;
    }

    setGpsStatus("active");
    setGpsErrorMsg(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setCurrentGps(coords);
        setGpsStatus("active");

        if (caseId) {
          rescueService.startTracking(caseId).catch(() => {});
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("denied");
          setGpsErrorMsg("Location permission denied by user.");
        } else {
          setGpsStatus("error");
          setGpsErrorMsg(err.message || "GPS signal weak/lost.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    setWatchId(id);
  };

  const stopGpsTracking = (caseId?: string) => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setGpsStatus("idle");
    if (caseId) {
      rescueService.stopTracking(caseId).catch(() => {});
    }
  };

  // Modal States
  const [selectedCase, setSelectedCase] = useState<Record<string, unknown> | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Decline Modal
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineCaseId, setDeclineCaseId] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  // Field Observation Modal
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [observationCaseId, setObservationCaseId] = useState("");
  const [observationNotes, setObservationNotes] = useState("");
  const [animalCondition, setAnimalCondition] = useState("Injured");

  // Escalation Modal
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalateCaseId, setEscalateCaseId] = useState("");
  const [escalateReason, setEscalateReason] = useState("");

  // Quick Action Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCaseId, setUploadCaseId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusCaseId, setStatusCaseId] = useState("");
  const [selectedNextStatus, setSelectedNextStatus] = useState("");

  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryCaseId, setDeliveryCaseId] = useState("");

  const [isDogModalOpen, setIsDogModalOpen] = useState(false);
  const [registerDogForm, setRegisterDogForm] = useState({
    case_id: "",
    name: "",
    breed: "Stray Dog",
    gender: "male",
    estimated_age: "2 years",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssignedCases = useCallback(async () => {
    try {
      const response = await rescueService.getRescueCases({ assigned_to_me: true });
      setAssignedCases(unwrapList(response).map((c) => formatAssigned(c, localStatuses)));
    } catch {
      setAssignedCases([]);
    }
  }, [localStatuses]);

  const syncOfflineQueue = useCallback(async () => {
    const queue = [...offlineQueue];
    if (queue.length === 0) return;

    addToast(`Syncing ${queue.length} offline field actions to backend...`, "info");
    const remaining = [];

    for (const item of queue) {
      try {
        if (item.type === "status") {
          await rescueService.updateRescueCase(item.caseId, item.payload);
        } else if (item.type === "locate") {
          await rescueService.markRescueLocated(item.caseId);
        } else if (item.type === "secure") {
          await rescueService.markRescueSecured(item.caseId);
        } else if (item.type === "admit") {
          await rescueService.markRescueAdmitted(item.caseId);
        }
      } catch {
        remaining.push(item);
      }
    }

    setOfflineQueue(remaining);
    try {
      localStorage.setItem("pg_rescue_offline_queue", JSON.stringify(remaining));
    } catch {}

    if (remaining.length === 0) {
      addToast("All offline field actions synced successfully!", "success");
      fetchAssignedCases();
    }
  }, [offlineQueue, fetchAssignedCases]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  const handleRegisterDogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerDogForm.name.trim()) {
      addToast("Please provide a name or temporary identifier for the rescued dog.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const targetCase = assignedCases.find((c) => String(c.id) === registerDogForm.case_id);
      const location = String(targetCase?.location || "Field Location");

      // 1. Reusing EXISTING Dog Management API creates Dog Record and generates Backend UUID
      const petRes = await petService.createPet({
        name: registerDogForm.name.trim(),
        breed: registerDogForm.breed.trim(),
        gender: registerDogForm.gender,
        estimated_age: registerDogForm.estimated_age,
        location_found: location,
        status: "rescued",
        notes: registerDogForm.notes ? `Rescued Case ${String(targetCase?.ticket || registerDogForm.case_id)}: ${registerDogForm.notes}` : `Rescued via Rescue Case #${String(targetCase?.ticket || "")}`,
      });

      const newDogId = (petRes as any)?.id || (petRes as any)?.dog_id || (petRes as any)?.data?.id;

      // 2. Provision Safety Tag using canonical dog_id
      let tagProvisioned = false;
      if (newDogId) {
        try {
          await petService.provisionSafetyTag(String(newDogId));
          tagProvisioned = true;
        } catch {
          tagProvisioned = false;
        }
      }

      if (tagProvisioned) {
        addToast(`Rescued Dog Registered & Safety Tag Provisioned! Backend Dog UUID: ${newDogId}`, "success");
      } else if (newDogId) {
        addToast(`⚠️ Rescued Dog Registered (Backend Dog UUID: ${newDogId}), but Safety Tag provisioning failed. Please provision tag manually from Pets module.`, "info");
      } else {
        addToast("Rescued Dog Registered successfully!", "success");
      }
      setIsDogModalOpen(false);
      setRegisterDogForm({ case_id: "", name: "", breed: "Stray Dog", gender: "male", estimated_age: "2 years", notes: "" });
      fetchAssignedCases();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to register rescued dog.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await dashboardService.getRescueDashboard();
      const data = (response as { data?: Record<string, unknown> })?.data || (response as Record<string, unknown>) || {};

      setDashboardData({
        total_calls: Number(data.total_calls ?? data.totalCalls ?? 0),
        pending: Number(data.pending ?? data.pendingCases ?? 0),
        dispatched: Number(data.dispatched ?? data.dispatchedCases ?? 0),
        rescued: Number(data.rescued ?? data.rescuedAnimals ?? 0),
        recent_calls: Array.isArray(data.recent_calls) ? (data.recent_calls as Record<string, unknown>[]) : Array.isArray(data.recentCalls) ? (data.recentCalls as Record<string, unknown>[]) : [],
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load rescue agent metrics. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    void fetchAssignedCases();
  }, [fetchDashboard, fetchAssignedCases]);

  useDataSync(() => {
    void fetchDashboard();
    void fetchAssignedCases();
  });

  // Stage Progress Action Handlers
  const handleAcceptDispatch = async (caseId: string) => {
    try {
      setIsSubmitting(true);
      await rescueService.acceptDispatch(caseId);
      addToast("Rescue assignment accepted successfully!", "success");
      
      updateLocalStatus(caseId, "accepted");
      
      // Update local row status in assignedCases state
      setAssignedCases((prev) =>
        prev.map((c) => {
          if (String(c.id) === caseId) {
            const newRaw = { 
              ...(c.raw as any), 
              dispatch: { 
                ...((c.raw as any)?.dispatch || {}), 
                status: "accepted" 
              } 
            };
            return { ...c, raw: newRaw };
          }
          return c;
        })
      );
      
      // Update selectedCase state if open
      setSelectedCase((prev) => {
        if (!prev || String(prev.id) !== caseId) return prev;
        const newRaw = { 
          ...(prev.raw as any), 
          dispatch: { 
            ...((prev.raw as any)?.dispatch || {}), 
            status: "accepted" 
          } 
        };
        return { ...prev, raw: newRaw };
      });
      
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to accept rescue assignment.", "error");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkEnRoute = async (_dispatchId: string, caseId: string) => {
    try {
      setIsSubmitting(true);
      await rescueService.startTracking(caseId);
      addToast("Field status updated to En Route!", "info");
      
      updateLocalStatus(caseId, "en_route");
      
      // Update local row status in assignedCases state
      setAssignedCases((prev) =>
        prev.map((c) => {
          if (String(c.id) === caseId) {
            const newRaw = { 
              ...(c.raw as any), 
              status: "en_route",
              dispatch: { 
                ...((c.raw as any)?.dispatch || {}), 
                status: "en_route" 
              } 
            };
            return { ...c, status: "en_route", raw: newRaw };
          }
          return c;
        })
      );

      // Also update selectedCase state if open
      setSelectedCase((prev) => {
        if (!prev || String(prev.id) !== caseId) return prev;
        const newRaw = { 
          ...(prev.raw as any), 
          status: "en_route",
          dispatch: { 
            ...((prev.raw as any)?.dispatch || {}), 
            status: "en_route" 
          } 
        };
        return { ...prev, status: "en_route", raw: newRaw };
      });

      setIsViewModalOpen(false);
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to update status to En Route.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkLocated = async (caseId: string) => {
    try {
      setIsSubmitting(true);
      if (!navigator.onLine) {
        queueOfflineAction({ type: "locate", caseId, payload: {} });
        addToast("Animal marked as located locally (offline).", "info");
        setIsViewModalOpen(false);
        return;
      }
      await rescueService.markRescueLocated(caseId);
      addToast("Animal marked as located on scene!", "info");
      
      clearLocalStatus(caseId);
      
      setIsViewModalOpen(false);
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch {
      addToast("Failed to mark animal as located.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSecured = async (caseId: string) => {
    try {
      setIsSubmitting(true);
      if (!navigator.onLine) {
        queueOfflineAction({ type: "secure", caseId, payload: {} });
        addToast("Animal marked as secured locally (offline).", "info");
        setIsViewModalOpen(false);
        return;
      }
      await rescueService.markRescueSecured(caseId);
      addToast("Animal marked as secured!", "info");
      
      clearLocalStatus(caseId);
      
      setIsViewModalOpen(false);
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch {
      addToast("Failed to mark animal as secured.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAdmitted = async (caseId: string) => {
    try {
      setIsSubmitting(true);
      stopGpsTracking(caseId);
      if (!navigator.onLine) {
        queueOfflineAction({ type: "admit", caseId, payload: {} });
        addToast("🐕 Delivery confirmed locally (offline). Will sync when online.", "success");
        setIsViewModalOpen(false);
        setIsDeliveryModalOpen(false);
        return;
      }
      await rescueService.markRescueAdmitted(caseId);
      addToast("🐕 Dog rescued and admitted successfully!", "success");
      
      clearLocalStatus(caseId);
      
      setIsViewModalOpen(false);
      setIsDeliveryModalOpen(false);
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch {
      addToast("Failed to confirm delivery and admit animal.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineCaseId) return;
    try {
      setIsSubmitting(true);
      await rescueService.rejectRescueRequest(declineCaseId, declineReason || "Agent unavailable");
      addToast("Assignment declined.", "info");
      setIsDeclineModalOpen(false);
      setDeclineReason("");
      setDeclineCaseId("");
      fetchAssignedCases();
      fetchDashboard();
    } catch {
      addToast("Failed to decline assignment.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleObservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observationCaseId || !observationNotes.trim()) {
      addToast("Please enter field observation notes.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const target = assignedCases.find((c) => String(c.id) === observationCaseId);
      const existingNotes = String((target?.raw as any)?.notes || "");
      const updatedNotes = existingNotes
        ? `${existingNotes}\n[Observation - ${animalCondition}]: ${observationNotes.trim()}`
        : `[Observation - ${animalCondition}]: ${observationNotes.trim()}`;

      await rescueService.updateRescueCase(observationCaseId, { notes: updatedNotes });
      addToast("Field observation notes saved!", "success");
      setIsObservationModalOpen(false);
      setObservationNotes("");
      setObservationCaseId("");
      fetchAssignedCases();
    } catch {
      addToast("Failed to save observation notes.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateCaseId || !escalateReason.trim()) {
      addToast("Please describe the emergency back-up requirement.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await rescueService.escalateRescue(escalateCaseId, "emergency_backup", escalateReason.trim());
      addToast("🚨 Emergency back-up request sent to Rescue Coordinator!", "info");
      setIsEscalateModalOpen(false);
      setEscalateReason("");
      setEscalateCaseId("");
      fetchAssignedCases();
    } catch {
      addToast("Failed to send escalation request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Action Modal Submitters
  const handleUploadPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCaseId) {
      addToast("Please select an assigned rescue case.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      let finalPhotoUrl = photoUrl.trim();

      if (selectedFile) {
        addToast("Uploading photo file to storage...", "info");
        finalPhotoUrl = await storageService.uploadFile(selectedFile, {
          folder: "rescues",
          entity_type: "rescue_case",
          entity_id: uploadCaseId,
        });
      }

      if (!finalPhotoUrl) {
        addToast("Please select a photo file or provide an image URL.", "error");
        return;
      }

      const target = assignedCases.find((c) => String(c.id) === uploadCaseId);
      const existingMedia = Array.isArray(target?.media) ? (target.media as string[]) : [];
      await rescueService.updateRescueCase(uploadCaseId, {
        media_evidence: [...existingMedia, finalPhotoUrl],
      });
      addToast("Rescue photo evidence attached successfully!", "success");
      setIsUploadModalOpen(false);
      setPhotoUrl("");
      setSelectedFile(null);
      setUploadCaseId("");
      fetchAssignedCases();
      notifyDataChanged();
    } catch {
      addToast("Failed to upload rescue photo evidence.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusCaseId || !selectedNextStatus) {
      addToast("Please select a case and next status.", "error");
      return;
    }
    const target = assignedCases.find((c) => String(c.id) === statusCaseId);
    const dispatchId = String(target?.dispatch_id || "");

    if (selectedNextStatus === "en_route") {
      await handleMarkEnRoute(dispatchId, statusCaseId);
    } else if (selectedNextStatus === "located") {
      await handleMarkLocated(statusCaseId);
    } else if (selectedNextStatus === "secured") {
      await handleMarkSecured(statusCaseId);
    } else if (selectedNextStatus === "admitted") {
      await handleMarkAdmitted(statusCaseId);
    }
    setIsStatusModalOpen(false);
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryCaseId) {
      addToast("Please select a case for delivery confirmation.", "error");
      return;
    }
    await handleMarkAdmitted(deliveryCaseId);
  };

  // Filter Active Cases for Table
  const getDisplayData = () => {
    let list: Record<string, unknown>[];
    if (activeCard === "pending") {
      list = assignedCases.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "reported" || s === "pending" || s === "dispatched" || s === "en_route" || s === "located";
      });
    } else if (activeCard === "completed") {
      list = assignedCases.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "rescued" || s === "admitted" || s === "completed";
      });
    } else if (activeCard === "all") {
      list = assignedCases;
    } else {
      list = assignedCases.filter((c) => String(c.status || "").toLowerCase() !== "admitted");
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((r) =>
      String(r.ticket || "").toLowerCase().includes(q) ||
      String(r.reporter || "").toLowerCase().includes(q) ||
      String(r.location || "").toLowerCase().includes(q) ||
      String(r.severity || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  };

  const displayData = getDisplayData();

  const getTableTitle = () => {
    switch (activeCard) {
      case "pending":
        return "Pending Field Operations";
      case "completed":
        return "My Completed Rescues";
      case "all":
        return "All Assigned Rescue Requests";
      default:
        return "My Active Assigned Cases";
    }
  };

  const stats = [
    {
      title: "Assigned Cases",
      value: loading ? "..." : String(assignedCases.filter((c) => String(c.status || "").toLowerCase() !== "admitted").length),
      trend: "Assigned to You",
      color: "#1E3A8A",
      icon: <FaAmbulance />,
      selected: activeCard === "assigned",
      onClick: () => setActiveCard("assigned"),
    },
    {
      title: "Pending Cases",
      value: loading ? "..." : String(assignedCases.filter((c) => /reported|pending|dispatched|en_route|located/i.test(String(c.status || ""))).length),
      trend: "Awaiting Field Action",
      color: "#F59E0B",
      icon: <FaClipboardCheck />,
      selected: activeCard === "pending",
      onClick: () => setActiveCard("pending"),
    },
    {
      title: "Completed Rescues",
      value: loading ? "..." : String(assignedCases.filter((c) => /rescued|admitted|completed/i.test(String(c.status || ""))).length),
      trend: "Successfully Completed",
      color: "#16A34A",
      icon: <FaCheckCircle />,
      selected: activeCard === "completed",
      onClick: () => setActiveCard("completed"),
    },
    {
      title: "Total Rescue Calls",
      value: loading ? "..." : String(assignedCases.length || dashboardData.total_calls),
      trend: "Overall Requests",
      color: "#1E3A8A",
      icon: <FaCamera />,
      selected: activeCard === "all",
      onClick: () => setActiveCard("all"),
    },
  ];

  const columns = [
    { key: "ticket", title: "Ticket / ID" },
    { key: "reporter", title: "Reporter" },
    { key: "animal_count", title: "Dogs" },
    { key: "location", title: "Location" },
    {
      key: "severity",
      title: "Priority",
      render: (val: string) => (
        <span style={{ textTransform: "uppercase", fontWeight: 600, fontSize: "12px", color: val === "critical" ? "#DC2626" : val === "high" ? "#EA580C" : val === "medium" ? "#F59E0B" : "#16A34A" }}>
          {val || "-"}
        </span>
      ),
    },
    { key: "agents", title: "Rescue Agents" },
    { key: "vehicle", title: "Vehicle" },
    {
      key: "status",
      title: "Status",
      render: (val: string) => (
        <span style={{ textTransform: "capitalize", fontWeight: 600, fontSize: "12px" }}>{val || "-"}</span>
      ),
    },
    { key: "created_at", title: "Reported At" },
  ];

  const handleAcceptCase = async (caseId: string, row?: Record<string, unknown>) => {
    const rawObj = (row?.raw as Record<string, unknown>) || {};
    const assignedAgentId = String(row?.assigned_agent_id || rawObj.assigned_agent_id || "");
    const agentUser = getCurrentUser();
    const agentUserId = String(agentUser?.id ?? "");
    if (assignedAgentId && assignedAgentId !== agentUserId) {
      addToast(`This rescue request has already been accepted by another agent.`, "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const agentName = (agentUser as any)?.name || (agentUser as any)?.email || "Rescue Agent";
      await rescueService.acceptRescueRequest(caseId, agentUserId || "agent", agentName);
      addToast("Rescue Request Accepted!", "success");
      fetchAssignedCases();
      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to accept rescue request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const rowActions = (row: Record<string, unknown>) => {
    const status = String(row.status || "").toLowerCase();
    const caseId = String(row.id || "");
    const dispatchId = String(row.dispatch_id || "");

    if (status === "verified") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAcceptCase(caseId, row);
          }}
          style={{ padding: "5px 10px", background: "#D97706", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          Accept Request
        </button>
      );
    }
    if (status === "accepted") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkEnRoute(dispatchId, caseId);
          }}
          style={{ padding: "5px 10px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          <FaAmbulance /> En Route
        </button>
      );
    }
    if (status === "dispatched") {
      const rawDispatch = (row.raw as any)?.dispatch;
      const dispatchStatus = rawDispatch?.status || "";
      if (dispatchStatus === "dispatched" || !dispatchStatus) {
        return (
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAcceptDispatch(caseId);
              }}
              style={{ padding: "5px 10px", background: "#16A34A", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Accept Dispatch
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeclineCaseId(caseId);
                setIsDeclineModalOpen(true);
              }}
              style={{ padding: "5px 8px", background: "#DC2626", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Decline
            </button>
          </div>
        );
      }
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkEnRoute(dispatchId, caseId);
          }}
          style={{ padding: "5px 10px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          <FaAmbulance /> En Route
        </button>
      );
    }
    if (status === "en_route") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkLocated(caseId);
          }}
          style={{ padding: "5px 10px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          <FaMapMarkerAlt /> Located
        </button>
      );
    }
    if (status === "located") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkSecured(caseId);
          }}
          style={{ padding: "5px 10px", background: "#F59E0B", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          Secured
        </button>
      );
    }
    if (status === "secured" || status === "rescued") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkAdmitted(caseId);
          }}
          style={{ padding: "5px 10px", background: "#15803D", color: "#FFF", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          <FaCheckCircle /> Confirm Delivery
        </button>
      );
    }
    return null;
  };

  const handleRowClick = (row: Record<string, unknown>) => {
    setSelectedCase(row);
    setIsViewModalOpen(true);
  };

  return (
    <div>
      {/* Hero Banner with Live Telemetry Badges */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "20px 24px",
          borderRadius: "14px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
              Field Rescue Agent Console
            </h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
              View assigned rescue requests, update field status, upload rescue photos and complete shelter handover.
            </p>
          </div>

          {/* Field Status & Telemetry Indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Network Connection Badge */}
            <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", background: isOnline ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)", color: isOnline ? "#34D399" : "#FCA5A5", border: isOnline ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)" }}>
              {isOnline ? "🌐 Online" : `📶 Offline Mode (${offlineQueue.length} queued)`}
            </span>

            {/* GPS Telemetry Badge & Toggle */}
            <button
              type="button"
              onClick={() => {
                if (gpsStatus === "active") stopGpsTracking();
                else startGpsTracking();
              }}
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: gpsStatus === "active" ? "#16A34A" : gpsStatus === "denied" || gpsStatus === "error" ? "#DC2626" : "#1E3A8A",
                color: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaLocationArrow />
              {gpsStatus === "active" && currentGps
                ? `GPS Active (${currentGps.latitude.toFixed(4)}, ${currentGps.longitude.toFixed(4)})`
                : gpsStatus === "denied"
                ? "GPS Denied"
                : gpsStatus === "error"
                ? `GPS Error (${gpsErrorMsg || "Signal Lost"})`
                : "Broadcast Live GPS"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <QuickActionCard
          icon={<FaCamera />}
          title="Upload Photos"
          subtitle="Attach Rescue Images"
          color="#1E3A8A"
          onClick={() => {
            if (assignedCases.length > 0) setUploadCaseId(String(assignedCases[0].id));
            setIsUploadModalOpen(true);
          }}
        />

        <QuickActionCard
          icon={<FaClipboardCheck />}
          title="Update Status"
          subtitle="Progress Lifecycle Stage"
          color="#16A34A"
          onClick={() => {
            if (assignedCases.length > 0) setStatusCaseId(String(assignedCases[0].id));
            setIsStatusModalOpen(true);
          }}
        />

        <QuickActionCard
          icon={<FaDog />}
          title="Register Rescued Dog"
          subtitle="Generate UUID & Safety Tag"
          color="#1E3A8A"
          onClick={() => {
            if (assignedCases.length > 0) setRegisterDogForm((prev) => ({ ...prev, case_id: String(assignedCases[0].id) }));
            setIsDogModalOpen(true);
          }}
        />

        <QuickActionCard
          icon={<FaAmbulance />}
          title="Confirm Delivery"
          subtitle="Handover to Shelter Intake"
          color="#1E3A8A"
          onClick={() => {
            const rescuable = assignedCases.find((c) => ["secured", "rescued", "located"].includes(String(c.status || "").toLowerCase()));
            if (rescuable) setDeliveryCaseId(String(rescuable.id));
            else if (assignedCases.length > 0) setDeliveryCaseId(String(assignedCases[0].id));
            setIsDeliveryModalOpen(true);
          }}
        />

        <QuickActionCard
          icon={<FaCompass />}
          title="Field Observation"
          subtitle="Log Animal Condition & Notes"
          color="#1E3A8A"
          onClick={() => {
            if (assignedCases.length > 0) setObservationCaseId(String(assignedCases[0].id));
            setIsObservationModalOpen(true);
          }}
        />

        <QuickActionCard
          icon={<FaExclamationTriangle />}
          title="Emergency Back-up"
          subtitle="Escalate to Coordinator"
          color="#DC2626"
          onClick={() => {
            if (assignedCases.length > 0) setEscalateCaseId(String(assignedCases[0].id));
            setIsEscalateModalOpen(true);
          }}
        />
      </div>

      {/* ACTIVE RESCUE GPS TRACKING NAVIGATION BANNER */}
      {assignedCases.length > 0 && (() => {
        const activeGpsCase = assignedCases.find((c) => {
          const s = String(c.status || "").toLowerCase();
          return ["en_route", "located", "secured", "accepted", "dispatched"].includes(s);
        });
        if (!activeGpsCase) return null;
        const currentStage = String(activeGpsCase.status || "en_route").toLowerCase();
        return (
          <div
            style={{
              marginBottom: "20px",
              background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
              border: "1px solid #4338CA",
              borderRadius: "14px",
              padding: "16px 20px",
              color: "#FFF",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818CF8", fontSize: "20px" }}>
                  <FaCompass className="animate-spin" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, background: "#16A34A", color: "#FFF", padding: "2px 8px", borderRadius: "12px", textTransform: "uppercase" }}>
                      ● ACTIVE GPS TRACKING
                    </span>
                    <span style={{ fontSize: "13px", color: "#C7D2FE", fontWeight: 600 }}>
                      Ticket #{String(activeGpsCase.ticket)}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "4px" }}>
                    Destination: {String(activeGpsCase.location)}
                  </div>
                </div>
              </div>

              {/* Lifecycle Progress Pipeline */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.15)", color: "#FFF" }}>Assigned</span>
                <span>➔</span>
                <span style={{ padding: "4px 8px", borderRadius: "6px", background: currentStage === "en_route" ? "#1E3A8A" : "rgba(255,255,255,0.15)", color: "#FFF" }}>Accepted / En Route</span>
                <span>➔</span>
                <span style={{ padding: "4px 8px", borderRadius: "6px", background: currentStage === "located" ? "#1E3A8A" : "rgba(255,255,255,0.15)", color: "#FFF" }}>Arrived at Scene</span>
                <span>➔</span>
                <span style={{ padding: "4px 8px", borderRadius: "6px", background: currentStage === "secured" ? "#F59E0B" : "rgba(255,255,255,0.15)", color: "#FFF" }}>Dog Secured</span>
                <span>➔</span>
                <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.15)", color: "#94A3B8" }}>Reached Shelter (GPS Stop)</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dynamic Headline Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* Dynamic Rescue Operations Table */}
      <div className="soft-card" style={{ padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
              {getTableTitle()}
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Showing {displayData.length} records assigned to you
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: "13px" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, location, status..."
                style={{
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  width: "240px",
                }}
              />
            </div>
            {loading && (
              <span style={{ color: "#1E3A8A", fontSize: "12px", fontWeight: 600 }}>
                Loading...
              </span>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={displayData}
          loading={loading}
          error={error}
          onRetry={() => {
            fetchDashboard();
            fetchAssignedCases();
          }}
          emptyMessage="No assigned rescue requests found."
          renderRowActions={rowActions}
          onRowClick={(row) => handleRowClick(row)}
        />
      </div>

      {/* Field Operation & Rescue Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Field Rescue Details — ${selectedCase?.ticket || ""}`}
        size="lg"
        footer={
          selectedCase ? (
            <>
              {(() => {
                const status = String(selectedCase.status || "").toLowerCase();
                if (status === "dispatched") {
                  const rawDispatch = (selectedCase.raw as any)?.dispatch;
                  const dispatchStatus = rawDispatch?.status || "";
                  if (dispatchStatus === "dispatched" || !dispatchStatus) {
                    return (
                      <button
                        disabled={isSubmitting}
                        onClick={async () => {
                          try {
                            await handleAcceptDispatch(String(selectedCase.id || ""));
                            setSelectedCase((prev) => {
                              if (!prev) return null;
                              const newRaw = { ...(prev.raw as any), dispatch: { ...((prev.raw as any)?.dispatch || {}), status: "accepted" } };
                              return { ...prev, raw: newRaw };
                            });
                          } catch {
                            // Do not update UI state if accepting fails
                          }
                        }}
                        style={{ padding: "8px 16px", background: "#16A34A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaCheckCircle size={12} /> Accept Dispatch
                      </button>
                    );
                  }
                }
                return null;
              })()}

              {(() => {
                const status = String(selectedCase.status || "").toLowerCase();
                const rawDispatch = (selectedCase.raw as any)?.dispatch;
                const dispatchStatus = rawDispatch?.status || "";
                const showEnRoute =
                  status === "accepted" ||
                  (status === "dispatched" && dispatchStatus === "accepted") ||
                  status === "verified";
                if (showEnRoute) {
                  return (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleMarkEnRoute(String(selectedCase.dispatch_id || ""), String(selectedCase.id || ""))}
                      style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FaAmbulance size={12} /> Mark En Route
                    </button>
                  );
                }
                return null;
              })()}

              {String(selectedCase.status || "").toLowerCase() === "en_route" && (
                <button
                  disabled={isSubmitting}
                  onClick={() => handleMarkLocated(String(selectedCase.id || ""))}
                  style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaMapMarkerAlt size={12} /> Mark Located
                </button>
              )}

              {String(selectedCase.status || "").toLowerCase() === "located" && (
                <button
                  disabled={isSubmitting}
                  onClick={() => handleMarkSecured(String(selectedCase.id || ""))}
                  style={{ padding: "8px 16px", background: "#F59E0B", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                >
                  Mark Secured
                </button>
              )}

              {["secured", "rescued"].includes(String(selectedCase.status || "").toLowerCase()) && (
                <button
                  disabled={isSubmitting}
                  onClick={() => handleMarkAdmitted(String(selectedCase.id || ""))}
                  style={{ padding: "8px 16px", background: "#15803D", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaCheckCircle size={12} /> Confirm Delivery & Admit to Centre
                </button>
              )}

              {String(selectedCase.status || "").toLowerCase() === "admitted" && (
                <button
                  onClick={() => window.open(`/public-scan/${(selectedCase.raw as Record<string, unknown>)?.dog_profile_id || (selectedCase.raw as Record<string, unknown>)?.dog_id || selectedCase.id}`, "_blank")}
                  style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaExternalLinkAlt size={12} /> View Shelter Profile
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
              >
                Close
              </button>
            </>
          ) : null
        }
      >
        {selectedCase && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <strong style={{ color: "#475569" }}>Reporter:</strong> {String(selectedCase.reporter || "-")}
              {selectedCase.phone ? ` (${selectedCase.phone})` : ""}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Location:</strong> {String(selectedCase.location || "-")}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Priority / Severity:</strong>{" "}
              <span
                style={{
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color:
                    selectedCase.severity === "critical"
                      ? "#DC2626"
                      : selectedCase.severity === "high"
                      ? "#EA580C"
                      : selectedCase.severity === "medium"
                      ? "#F59E0B"
                      : "#16A34A",
                }}
              >
                {String(selectedCase.severity || "-")}
              </span>
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Current Rescue Status:</strong> {rescueStatusBadge(String(selectedCase.status || ""))}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Dispatched At:</strong> {String(selectedCase.dispatched_at || "-")}
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <strong style={{ color: "#0F172A" }}>Assigned Team & Vehicle</strong>
              <div style={{ marginTop: "6px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><strong>Rescue Agent(s):</strong> {String(selectedCase.agents || "-")}</div>
                <div><strong>Rescue Vehicle:</strong> {String(selectedCase.vehicle || "-")}</div>
              </div>
            </div>

            {/* Evidence Photos */}
            {Array.isArray(selectedCase.media) && (selectedCase.media as string[]).length > 0 && (
              <div>
                <strong style={{ color: "#475569" }}>Evidence Photos:</strong>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  {(selectedCase.media as string[]).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#1E3A8A", fontWeight: 600 }}>
                      📷 Photo {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Upload Photos Modal with Camera File Picker */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Rescue Photos / Field Evidence"
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setIsUploadModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px", fontWeight: 600 }}>Cancel</button>
            <button type="submit" form="upload-photo-form" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", background: "#1E3A8A", color: "#FFF", border: "none", fontWeight: 700, fontSize: "13px" }}>{isSubmitting ? "Uploading..." : "Upload Evidence"}</button>
          </>
        }
      >
        <form id="upload-photo-form" onSubmit={handleUploadPhotoSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Rescue Case *</label>
            <select required value={uploadCaseId} onChange={(e) => setUploadCaseId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}>
              <option value="">Select assigned case...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)} ({String(c.status)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>📷 Take Photo / Choose File (Device Camera)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
              }}
              style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#F8FAFC" }}
            />
          </div>
          <div style={{ textAlign: "center", fontSize: "12px", color: "#64748B", fontWeight: 600 }}>— OR —</div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Photo Image URL / Evidence Link</label>
            <input
              type="text"
              value={photoUrl}
              placeholder="https://example.com/rescue-photo.jpg"
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            />
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Rescue Lifecycle Status"
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setIsStatusModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px", fontWeight: 600 }}>Cancel</button>
            <button type="submit" form="update-status-form" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", background: "#16A34A", color: "#FFF", border: "none", fontWeight: 700, fontSize: "13px" }}>{isSubmitting ? "Updating..." : "Update Status"}</button>
          </>
        }
      >
        <form id="update-status-form" onSubmit={handleStatusUpdateSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Assigned Case *</label>
            <select required value={statusCaseId} onChange={(e) => setStatusCaseId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}>
              <option value="">Select active case...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)} (Current: {String(c.status)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Target Lifecycle Stage *</label>
            <select required value={selectedNextStatus} onChange={(e) => setSelectedNextStatus(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}>
              <option value="">Select next stage...</option>
              <option value="en_route">En Route (On the way to scene)</option>
              <option value="located">Located (Animal spotted on scene)</option>
              <option value="secured">Secured (Animal safely captured)</option>
              <option value="admitted">Admitted (Delivered to centre intake)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Confirm Delivery Modal */}
      <Modal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        title="Confirm Delivery & Centre Handover"
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setIsDeliveryModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px", fontWeight: 600 }}>Cancel</button>
            <button type="submit" form="confirm-delivery-form" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", background: "#15803D", color: "#FFF", border: "none", fontWeight: 700, fontSize: "13px" }}>{isSubmitting ? "Confirming..." : "Confirm Handover & Admit"}</button>
          </>
        }
      >
        <form id="confirm-delivery-form" onSubmit={handleDeliverySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Rescued Animal Case *</label>
            <select required value={deliveryCaseId} onChange={(e) => setDeliveryCaseId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}>
              <option value="">Select case ready for handover...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)} ({String(c.status)})
                </option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }}>
            Confirming delivery will mark this rescue case as <strong>ADMITTED</strong> and transfer responsibility to the Shelter Manager Intake Queue.
          </p>
        </form>
      </Modal>

      {/* Register Rescued Dog Modal (Reusing Existing Dog Management UUID & Safety Tag / QR) */}
      <Modal
        isOpen={isDogModalOpen}
        onClose={() => setIsDogModalOpen(false)}
        title="Register Rescued Dog (Dog Management Intake)"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setIsDogModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px", fontWeight: 600 }}>Cancel</button>
            <button type="submit" form="register-rescued-dog-form" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", background: "#1E3A8A", color: "#FFF", border: "none", fontWeight: 700, fontSize: "13px" }}>{isSubmitting ? "Registering..." : "Register Dog & Generate Tag"}</button>
          </>
        }
      >
        <form id="register-rescued-dog-form" onSubmit={handleRegisterDogSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Rescue Case *</label>
            <select
              required
              value={registerDogForm.case_id}
              onChange={(e) => setRegisterDogForm({ ...registerDogForm, case_id: e.target.value })}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            >
              <option value="">Select assigned rescue case...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)} ({String(c.status)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Rescued Dog Name / Identifier *</label>
              <input
                type="text"
                required
                placeholder="e.g. Buddy, Lucky, Rescued Dog #12"
                value={registerDogForm.name}
                onChange={(e) => setRegisterDogForm({ ...registerDogForm, name: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Breed / Type</label>
              <input
                type="text"
                value={registerDogForm.breed}
                placeholder="e.g. Mixed Breed, Stray Dog, Labrador"
                onChange={(e) => setRegisterDogForm({ ...registerDogForm, breed: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Gender</label>
              <select
                value={registerDogForm.gender}
                onChange={(e) => setRegisterDogForm({ ...registerDogForm, gender: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Estimated Age</label>
              <input
                type="text"
                value={registerDogForm.estimated_age}
                placeholder="e.g. 1 year, 6 months"
                onChange={(e) => setRegisterDogForm({ ...registerDogForm, estimated_age: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Physical / Rescue Notes</label>
            <textarea
              rows={2}
              value={registerDogForm.notes}
              placeholder="Injuries, physical markings, rescue location details..."
              onChange={(e) => setRegisterDogForm({ ...registerDogForm, notes: e.target.value })}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            />
          </div>

          <div style={{ background: "#EFF6FF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #BFDBFE", fontSize: "12px", color: "#1E3A8A" }}>
            ℹ️ <strong>Backend Dog UUID & Safety Tag Provisioning:</strong> Submitting will invoke the existing <code>petService.createPet</code> API to generate a permanent Dog UUID and automatically provision a PawGuard Safety Tag / QR code.
          </div>
        </form>
      </Modal>

      {/* Decline Assignment Modal */}
      <Modal
        isOpen={isDeclineModalOpen}
        onClose={() => setIsDeclineModalOpen(false)}
        title="Decline Rescue Assignment"
      >
        <form onSubmit={handleDeclineSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
            Please state why you are declining this rescue dispatch.
          </p>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#991B1B", marginBottom: "4px" }}>
              Decline Reason *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Currently handling another emergency, vehicle breakdown, out of service area..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #FCA5A5", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsDeclineModalOpen(false)}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Declining..." : "Decline Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Field Observation Modal */}
      <Modal
        isOpen={isObservationModalOpen}
        onClose={() => setIsObservationModalOpen(false)}
        title="Log Field Observation / Notes"
      >
        <form onSubmit={handleObservationSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Case *</label>
            <select
              required
              value={observationCaseId}
              onChange={(e) => setObservationCaseId(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            >
              <option value="">Select assigned case...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Observed Animal Condition</label>
            <select
              value={animalCondition}
              onChange={(e) => setAnimalCondition(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            >
              <option value="Injured">Injured / Requires Immediate Medical Attention</option>
              <option value="Aggressive">Aggressive / High Risk</option>
              <option value="Trapped">Trapped / Requires Net/Grasper</option>
              <option value="Scared">Scared / Skittish</option>
              <option value="Stable">Stable Condition</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Field Notes &amp; Remarks *</label>
            <textarea
              rows={3}
              required
              placeholder="Record physical condition, hazards, or capture details..."
              value={observationNotes}
              onChange={(e) => setObservationNotes(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsObservationModalOpen(false)}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Saving..." : "Save Field Observation"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Emergency Escalation Modal */}
      <Modal
        isOpen={isEscalateModalOpen}
        onClose={() => setIsEscalateModalOpen(false)}
        title="🚨 Request Emergency Back-Up / Escalation"
      >
        <form onSubmit={handleEscalationSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#991B1B", fontWeight: 600 }}>
            Submit an emergency escalation to notify the Rescue Coordinator for immediate assistance or back-up.
          </p>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Select Case *</label>
            <select
              required
              value={escalateCaseId}
              onChange={(e) => setEscalateCaseId(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px" }}
            >
              <option value="">Select active case...</option>
              {assignedCases.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket)} — {String(c.location)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Emergency Reason &amp; Back-up Details *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Hostile environment, animal trapped under structure, additional handler required..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #FCA5A5", fontSize: "13px", marginTop: "4px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsEscalateModalOpen(false)}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Submitting..." : "Send Escalation"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RescueAgentDashboard;