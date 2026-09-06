import { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "../../components/common/DataTable";
import type { Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaSyringe,
  FaPills,
  FaBell,
  FaExclamationTriangle,
  FaTrash,
  FaPaperPlane,
  FaPlus,
  FaRedoAlt,
  FaSearch,
  FaDog,
  FaEye,
} from "react-icons/fa";
import reminderService from "../../services/reminderService";
import dogService from "../../services/dogService";
import petService from "../../services/petService";
import notificationService from "../../services/notificationService";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";

type Row = Record<string, unknown>;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
};

const pick = (row: Row, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const toErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { detail?: string; message?: string } } };
  return e?.response?.data?.detail || e?.response?.data?.message || fallback;
};

const badge = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  display: "inline-block",
  whiteSpace: "nowrap",
});

const formatDate = (v: unknown): string => formatDateTime(v as string);

const parseTime = (v: unknown): number | null => {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return isNaN(t) ? null : t;
};

type DueState = "overdue" | "due_soon" | "upcoming" | "none";

const dueStateOf = (due: unknown): DueState => {
  const t = parseTime(due);
  if (t === null) return "none";
  const now = Date.now();
  if (t < now) return "overdue";
  if (t - now <= 14 * 86400000) return "due_soon";
  return "upcoming";
};

const dueBadge = (state: DueState): React.ReactNode => {
  if (state === "overdue") return <span style={badge("#FEF2F2", "#EF4444")}>Overdue</span>;
  if (state === "due_soon") return <span style={badge("#FFFBEB", "#F59E0B")}>Due soon</span>;
  if (state === "upcoming") return <span style={badge("#EFF6FF", "#2563EB")}>Upcoming</span>;
  return <span style={badge("#F1F5F9", "#64748B")}>No due date</span>;
};

const dueCell = (v: unknown): React.ReactNode => {
  if (v === undefined || v === null || v === "") return <span style={badge("#F1F5F9", "#64748B")}>No due date</span>;
  return (
    <div>
      <div>{formatDate(v)}</div>
      <div style={{ marginTop: 4 }}>{dueBadge(dueStateOf(v))}</div>
    </div>
  );
};

const boolBadge = (
  value: unknown,
  activeBg: string,
  activeColor: string,
  inactiveBg: string,
  inactiveColor: string,
  activeLabel: string,
  inactiveLabel: string
): React.ReactNode =>
  value ? (
    <span style={badge(activeBg, activeColor)}>{activeLabel}</span>
  ) : (
    <span style={badge(inactiveBg, inactiveColor)}>{inactiveLabel}</span>
  );

const getDogCanonicalId = (d: Row): string =>
  String(pick(d, "id", "dog_id", "pet_id", "original_dog_id") || "").trim();

const matchDogRecord = (row: Row, dog: Row): boolean => {
  const dId = getDogCanonicalId(dog);
  const dReg = String(pick(dog, "registration_number") || "").trim();
  const rId = String(
    pick(row, "dog_id", "pet_id", "dogId", "petId", "animal_id", "original_dog_id") || ""
  ).trim();
  if (!rId) return false;
  if (rId === dId) return true;
  if (dReg && rId === dReg) return true;
  return false;
};

const VaccinationReminders = () => {
  const [dogs, setDogs] = useState<Row[]>([]);
  const [allVaccinations, setAllVaccinations] = useState<Row[]>([]);
  const [allPrescriptions, setAllPrescriptions] = useState<Row[]>([]);
  const [allReminders, setAllReminders] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDogFilter, setSelectedDogFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "active_meds" | "no_records" | "has_records">("all");

  // Selected Dog Detail Modal View
  const [selectedDogDetail, setSelectedDogDetail] = useState<Row | null>(null);
  const [detailTab, setDetailTab] = useState<"vaccination" | "medication" | "reminders">("vaccination");

  // Action Modals & States
  const [targetDogForModal, setTargetDogForModal] = useState<Row | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    kind: "vaccination" as "vaccination" | "medication",
    title: "",
    due_at: "",
    details: "",
    source_key: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [notifyTarget, setNotifyTarget] = useState<{ row: Row; dogName: string } | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; dogId: string; dogName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [togglingRxId, setTogglingRxId] = useState<string | null>(null);

  const { addToast } = useToast();

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dogsRes, vaccRes, rxRes] = await Promise.allSettled([
        petService.getAllDogs().catch(() => dogService.getAllDogs()),
        reminderService.getVaccinations({ page: 1, page_size: 100 }),
        reminderService.getPrescriptions({ page: 1, page_size: 100 }),
      ]);

      const dogList = dogsRes.status === "fulfilled" && Array.isArray(dogsRes.value?.data) ? dogsRes.value.data : [];
      const vaccList = vaccRes.status === "fulfilled" && Array.isArray(vaccRes.value?.data) ? vaccRes.value.data : [];
      const rxList = rxRes.status === "fulfilled" && Array.isArray(rxRes.value?.data) ? rxRes.value.data : [];

      setDogs(dogList);
      setAllVaccinations(vaccList);
      setAllPrescriptions(rxList);

      if (dogList.length > 0) {
        const topDogs = dogList.slice(0, 30);
        Promise.allSettled(
          topDogs.map((d: Row) => reminderService.getPetReminders(getDogCanonicalId(d)))
        ).then((results) => {
          const collectedRem: Row[] = [];
          results.forEach((res, idx) => {
            if (res.status === "fulfilled" && Array.isArray(res.value?.data)) {
              const dId = getDogCanonicalId(topDogs[idx]);
              res.value.data.forEach((r: Row) => {
                collectedRem.push({ ...r, dog_id: dId });
              });
            }
          });
          setAllReminders(collectedRem);
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load medical reminder data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useDataSync(fetchAllData);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Derived Stats across ALL dogs
  const nowMs = Date.now();
  const totalDogsCount = dogs.length;
  const upcomingVaccinationsCount = allVaccinations.filter(
    (v) => dueStateOf(pick(v, "next_due_at")) === "upcoming" || dueStateOf(pick(v, "next_due_at")) === "due_soon"
  ).length;
  const overdueVaccinationsCount = allVaccinations.filter(
    (v) => dueStateOf(pick(v, "next_due_at")) === "overdue"
  ).length;
  const activePrescriptionsCount = allPrescriptions.filter((p) => {
    const end = parseTime(pick(p, "end_at"));
    return Boolean(pick(p, "is_active")) && (end === null || end >= nowMs);
  }).length;
  const activeRemindersCount = allReminders.filter((r) => Boolean(pick(r, "is_active"))).length;

  const stats = [
    {
      title: "Registered Dogs",
      value: `${totalDogsCount}`,
      trend: "Total in care",
      color: "#0F172A",
      icon: <FaDog />,
    },
    {
      title: "Upcoming Vaccinations",
      value: `${upcomingVaccinationsCount}`,
      trend: "Due in future",
      color: "#2563EB",
      icon: <FaBell />,
    },
    {
      title: "Overdue Vaccinations",
      value: `${overdueVaccinationsCount}`,
      trend: "Action required",
      color: "#EF4444",
      icon: <FaExclamationTriangle />,
      onClick: () => setStatusFilter("overdue"),
    },
    {
      title: "Active Medication Plans",
      value: `${activePrescriptionsCount}`,
      trend: "Prescriptions",
      color: "#F59E0B",
      icon: <FaPills />,
      onClick: () => setStatusFilter("active_meds"),
    },
    {
      title: "Active Reminders",
      value: `${activeRemindersCount}`,
      trend: "Pet reminders",
      color: "#10B981",
      icon: <FaSyringe />,
    },
  ];

  // Process rows for Compact All-Dogs Registry Table
  const tableData = useMemo(() => {
    return dogs
      .map((d) => {
        const dId = getDogCanonicalId(d);
        const dName = str(pick(d, "name")) || "Unnamed Dog";
        const dBreed = str(pick(d, "breed")) || "-";
        const dGender = str(pick(d, "gender")) || "";
        const dReg = str(pick(d, "registration_number"));

        const dogVaccs = allVaccinations.filter((v) => matchDogRecord(v, d));
        const dogRxs = allPrescriptions.filter((p) => matchDogRecord(p, d));
        const dogReminders = allReminders.filter((r) => matchDogRecord(r, d));

        const overdueVaccs = dogVaccs.filter((v) => dueStateOf(pick(v, "next_due_at")) === "overdue");
        const upcomingVaccs = dogVaccs.filter(
          (v) => dueStateOf(pick(v, "next_due_at")) === "upcoming" || dueStateOf(pick(v, "next_due_at")) === "due_soon"
        );
        const activeRxs = dogRxs.filter((p) => Boolean(pick(p, "is_active")));
        const activeRems = dogReminders.filter((r) => Boolean(pick(r, "is_active")));

        const hasOverdue = overdueVaccs.length > 0;
        const hasActiveMeds = activeRxs.length > 0;
        const hasRecords = dogVaccs.length > 0 || dogRxs.length > 0 || dogReminders.length > 0;

        return {
          _rawDog: d,
          id: dId,
          dog_name: dName,
          dog_id: dId,
          registration_number: dReg,
          breed: dBreed,
          gender: dGender,
          breed_gender: `${dBreed}${dGender ? ` • ${dGender}` : ""}`,
          vaccs_count: dogVaccs.length,
          overdue_vaccs_count: overdueVaccs.length,
          upcoming_vaccs_count: upcomingVaccs.length,
          rxs_count: dogRxs.length,
          active_rxs_count: activeRxs.length,
          reminders_count: dogReminders.length,
          active_reminders_count: activeRems.length,
          has_overdue: hasOverdue,
          has_active_meds: hasActiveMeds,
          has_records: hasRecords,
          dogVaccs,
          dogRxs,
          dogReminders,
        };
      })
      .filter((row) => {
        // Single dog filter
        if (selectedDogFilter && row.id !== selectedDogFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matches =
            row.dog_name.toLowerCase().includes(q) ||
            row.breed.toLowerCase().includes(q) ||
            row.id.toLowerCase().includes(q) ||
            row.registration_number.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Status filter
        if (statusFilter === "overdue") return row.has_overdue;
        if (statusFilter === "active_meds") return row.has_active_meds;
        if (statusFilter === "no_records") return !row.has_records;
        if (statusFilter === "has_records") return row.has_records;

        return true;
      });
  }, [dogs, searchQuery, statusFilter, selectedDogFilter, allVaccinations, allPrescriptions, allReminders]);

  // Table Columns definition for Registry
  const registryColumns: Column<typeof tableData[0]>[] = [
    {
      key: "dog_name",
      title: "Dog",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>{r.dog_name}</div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748B", marginTop: "2px" }}>
            ID: {r.id || r.registration_number || "Unassigned"}
          </div>
        </div>
      ),
    },
    {
      key: "breed_gender",
      title: "Breed / Gender",
      render: (v) => <span style={{ fontSize: "13px", color: "#334155" }}>{v}</span>,
    },
    {
      key: "vaccination_status",
      title: "Vaccination Status",
      render: (_, r) => {
        if (r.overdue_vaccs_count > 0) {
          return <span style={badge("#FEF2F2", "#EF4444")}>⚠️ {r.overdue_vaccs_count} Overdue</span>;
        }
        if (r.upcoming_vaccs_count > 0) {
          return <span style={badge("#EFF6FF", "#2563EB")}>💉 {r.upcoming_vaccs_count} Upcoming</span>;
        }
        if (r.vaccs_count > 0) {
          return <span style={badge("#ECFDF5", "#10B981")}>Up to date ({r.vaccs_count})</span>;
        }
        return <span style={badge("#F1F5F9", "#94A3B8")}>No Vaccinations</span>;
      },
    },
    {
      key: "medication_status",
      title: "Medication Status",
      render: (_, r) => {
        if (r.active_rxs_count > 0) {
          return <span style={badge("#FFFBEB", "#D97706")}>💊 {r.active_rxs_count} Active Rx</span>;
        }
        if (r.rxs_count > 0) {
          return <span style={badge("#F1F5F9", "#64748B")}>Completed ({r.rxs_count})</span>;
        }
        return <span style={badge("#F1F5F9", "#94A3B8")}>No Medications</span>;
      },
    },
    {
      key: "reminder_status",
      title: "Reminder Status",
      render: (_, r) => {
        if (r.active_reminders_count > 0) {
          return <span style={badge("#EFF6FF", "#2563EB")}>🔔 {r.active_reminders_count} Active</span>;
        }
        return <span style={badge("#F1F5F9", "#94A3B8")}>0 Reminders</span>;
      },
    },
    {
      key: "overall_status",
      title: "Overall Status",
      render: (_, r) => {
        if (r.has_overdue) {
          return <span style={badge("#FEF2F2", "#DC2626")}>Action Required</span>;
        }
        if (r.has_active_meds || r.active_reminders_count > 0) {
          return <span style={badge("#FFFBEB", "#D97706")}>Active Care</span>;
        }
        if (r.has_records) {
          return <span style={badge("#ECFDF5", "#059669")}>Healthy / Tracked</span>;
        }
        return <span style={badge("#F1F5F9", "#64748B")}>No Records</span>;
      },
    },
  ];

  // Actions for detail view
  const openReminderModalForDog = (kind: "vaccination" | "medication", row: Row | null, dog: Row) => {
    const dId = getDogCanonicalId(dog);
    const dName = str(pick(dog, "name")) || "Dog";
    setTargetDogForModal(dog);

    const due = row ? (kind === "vaccination" ? pick(row, "next_due_at") : pick(row, "end_at")) : "";
    const subject = row ? (kind === "vaccination" ? str(pick(row, "vaccine_name")) : str(pick(row, "drug_name"))) : "";

    setReminderForm({
      kind,
      title: subject ? `${dName} — ${subject} due` : `${dName} — ${kind === "vaccination" ? "Vaccination" : "Medication"} due`,
      due_at: str(due),
      details: kind === "vaccination" ? `Vaccination booster due for ${dName}.` : `Medication follow-up due for ${dName}.`,
      source_key: `${kind}:${dId}`,
    });
    setIsReminderModalOpen(true);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDogForModal) return;
    const dId = getDogCanonicalId(targetDogForModal);
    if (!dId || !reminderForm.title.trim() || !reminderForm.due_at) {
      addToast("Reminder title and due date are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const dueIso = new Date(reminderForm.due_at).toISOString();
      await reminderService.createPetReminder(dId, {
        kind: reminderForm.kind,
        title: reminderForm.title.trim(),
        due_at: dueIso,
        details: reminderForm.details.trim() || undefined,
        source_key: reminderForm.source_key,
      });
      addToast("Reminder created successfully.", "success");
      setIsReminderModalOpen(false);
      void fetchAllData();
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to create reminder."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReminderNotification = async () => {
    if (!notifyTarget) return;
    try {
      setIsNotifying(true);
      await notificationService.sendBroadcastNotification({
        title: `Reminder: ${str(pick(notifyTarget.row, "title"))}`,
        message: `${notifyTarget.dogName} — ${str(pick(notifyTarget.row, "kind"))} "${str(
          pick(notifyTarget.row, "title")
        )}" is due ${formatDate(pick(notifyTarget.row, "due_at"))}.`,
        type: "medical",
        targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
      });
      addToast("Reminder notification sent via Notifications module.", "success");
      setNotifyTarget(null);
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to send reminder notification."), "error");
    } finally {
      setIsNotifying(false);
    }
  };

  const handleDeleteReminder = async () => {
    if (!deleteTarget) return;
    const reminderId = str(pick(deleteTarget.row, "id"));
    try {
      setIsDeleting(true);
      await reminderService.deletePetReminder(deleteTarget.dogId, reminderId);
      addToast("Reminder removed.", "success");
      setDeleteTarget(null);
      void fetchAllData();
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to delete reminder."), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePrescription = async (row: Row) => {
    const rxId = str(pick(row, "id"));
    const nextActive = !pick(row, "is_active");
    try {
      setTogglingRxId(rxId);
      await reminderService.updatePrescriptionStatus(rxId, nextActive);
      addToast(`Prescription marked ${nextActive ? "active" : "inactive"}.`, "success");
      void fetchAllData();
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to update prescription status."), "error");
    } finally {
      setTogglingRxId(null);
    }
  };

  // Detail Modal Columns
  const detailVaccinationColumns: Column[] = [
    { key: "vaccine_name", title: "Vaccine" },
    { key: "administered_at", title: "Administered", render: (v) => <span>{formatDate(v)}</span> },
    { key: "next_due_at", title: "Next Due", render: (v) => dueCell(v) },
    { key: "lot_number", title: "Lot Number" },
  ];

  const detailPrescriptionColumns: Column[] = [
    { key: "drug_name", title: "Medication" },
    { key: "dosage", title: "Dosage" },
    { key: "route", title: "Route" },
    { key: "start_at", title: "Start", render: (v) => <span>{formatDate(v)}</span> },
    { key: "end_at", title: "End", render: (v) => <span>{formatDate(v)}</span> },
    {
      key: "is_active",
      title: "Schedule Status",
      render: (v, r) =>
        !v && parseTime(pick(r, "end_at")) !== null && parseTime(pick(r, "end_at"))! < Date.now()
          ? <span style={badge("#FEF2F2", "#EF4444")}>Ended</span>
          : boolBadge(v, "#ECFDF5", "#10B981", "#F1F5F9", "#64748B", "Active", "Inactive"),
    },
  ];

  const detailReminderColumns: Column[] = [
    { key: "title", title: "Reminder" },
    {
      key: "kind",
      title: "Type",
      render: (v) =>
        v === "medication" ? (
          <span style={badge("#FFFBEB", "#F59E0B")}>Medication</span>
        ) : (
          <span style={badge("#EFF6FF", "#2563EB")}>Vaccination</span>
        ),
    },
    { key: "due_at", title: "Due", render: (v) => dueCell(v) },
    { key: "details", title: "Details" },
  ];

  const goToNotifications = () => {
    window.location.href = "/notifications";
  };

  // Selected Dog Detail calculations
  const detailDogVaccs = useMemo(() => {
    if (!selectedDogDetail) return [];
    return allVaccinations.filter((v) => matchDogRecord(v, selectedDogDetail));
  }, [selectedDogDetail, allVaccinations]);

  const detailDogRxs = useMemo(() => {
    if (!selectedDogDetail) return [];
    return allPrescriptions.filter((p) => matchDogRecord(p, selectedDogDetail));
  }, [selectedDogDetail, allPrescriptions]);

  const detailDogReminders = useMemo(() => {
    if (!selectedDogDetail) return [];
    return allReminders.filter((r) => matchDogRecord(r, selectedDogDetail));
  }, [selectedDogDetail, allReminders]);

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
          Smart Vaccination & Medication Reminders
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Shelter-wide medical registry tracking vaccination schedules, medication plans and reminders for all registered dogs.
        </p>
      </div>

      {/* KPI Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Filter and Search Controls */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ flex: "1 1 260px", position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search by dog name, breed, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "36px" }}
            />
          </div>

          {/* Dog Selector Filter */}
          <div style={{ flex: "1 1 220px" }}>
            <select
              value={selectedDogFilter}
              onChange={(e) => setSelectedDogFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All Dogs ({dogs.length})</option>
              {dogs.map((d) => {
                const dId = getDogCanonicalId(d);
                const dName = str(pick(d, "name"));
                const dBreed = str(pick(d, "breed"));
                return (
                  <option key={dId} value={dId}>
                    {dName}{dBreed ? ` (${dBreed})` : ""} — {dId}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: "1 1 200px" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={inputStyle}
            >
              <option value="all">All Medical Statuses</option>
              <option value="overdue">Overdue Vaccinations</option>
              <option value="active_meds">Active Medications</option>
              <option value="has_records">With Medical Records</option>
              <option value="no_records">No Medical Records</option>
            </select>
          </div>

          {/* Refresh & Action Buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => void fetchAllData()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 18px",
                borderRadius: "9px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <FaRedoAlt size={12} /> Refresh
            </button>
            <button
              onClick={goToNotifications}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 18px",
                borderRadius: "9px",
                border: "none",
                background: "#2563EB",
                color: "#FFF",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <FaBell size={13} /> View Notifications
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {/* Main Compact All-Dogs Medical Registry Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Shelter Medical Registry ({tableData.length})
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
              Compact registry of all registered dogs and their current medical/vaccination statuses.
            </p>
          </div>
        </div>

        <DataTable
          columns={registryColumns}
          data={tableData}
          pageSize={10}
          loading={loading}
          module="medical"
          emptyMessage="No registered dogs match your search or filter criteria."
          renderRowActions={(r) => (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDogDetail(r._rawDog);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                <FaEye size={12} /> View Details
              </button>
              <Can permission="create_medical">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openReminderModalForDog("vaccination", null, r._rawDog);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "7px",
                    border: "1px solid #BFDBFE",
                    background: "#EFF6FF",
                    color: "#2563EB",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <FaPlus size={10} /> Reminder
                </button>
              </Can>
            </div>
          )}
        />
      </div>

      {/* Row-Level "View Details" Modal */}
      <Modal
        isOpen={selectedDogDetail !== null}
        onClose={() => setSelectedDogDetail(null)}
        title={`Medical Overview — ${selectedDogDetail ? str(pick(selectedDogDetail, "name")) : "Dog"}`}
        maxWidth="820px"
      >
        {selectedDogDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Dog Metadata Header */}
            <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "10px", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  <FaDog />
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                    {str(pick(selectedDogDetail, "name"))}
                    {str(pick(selectedDogDetail, "breed")) ? ` (${str(pick(selectedDogDetail, "breed"))})` : ""}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", fontFamily: "monospace" }}>
                    ID: {getDogCanonicalId(selectedDogDetail) || "Unassigned"}
                  </div>
                </div>
              </div>
              <Can permission="create_medical">
                <button
                  onClick={() => openReminderModalForDog("vaccination", null, selectedDogDetail)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  <FaPlus size={11} /> Create Reminder
                </button>
              </Can>
            </div>

            {/* Detail Tabs */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "10px" }}>
              <button
                onClick={() => setDetailTab("vaccination")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: detailTab === "vaccination" ? "#2563EB" : "#F1F5F9",
                  color: detailTab === "vaccination" ? "#FFFFFF" : "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <FaSyringe /> Vaccination Schedule ({detailDogVaccs.length})
              </button>
              <button
                onClick={() => setDetailTab("medication")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: detailTab === "medication" ? "#2563EB" : "#F1F5F9",
                  color: detailTab === "medication" ? "#FFFFFF" : "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <FaPills /> Medication Schedule ({detailDogRxs.length})
              </button>
              <button
                onClick={() => setDetailTab("reminders")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: detailTab === "reminders" ? "#2563EB" : "#F1F5F9",
                  color: detailTab === "reminders" ? "#FFFFFF" : "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <FaBell /> Pet Reminders ({detailDogReminders.length})
              </button>
            </div>

            {/* Tab Contents */}
            {detailTab === "vaccination" && (
              <div>
                <DataTable
                  columns={detailVaccinationColumns}
                  data={detailDogVaccs}
                  module="medical"
                  emptyMessage={`No vaccination records logged for ${str(pick(selectedDogDetail, "name"))} yet.`}
                  renderRowActions={(row) => (
                    <Can permission="create_medical">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openReminderModalForDog("vaccination", row, selectedDogDetail);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}
                      >
                        <FaPlus size={10} /> Create Reminder
                      </button>
                    </Can>
                  )}
                />
              </div>
            )}

            {detailTab === "medication" && (
              <div>
                <DataTable
                  columns={detailPrescriptionColumns}
                  data={detailDogRxs}
                  module="medical"
                  emptyMessage={`No medication prescriptions logged for ${str(pick(selectedDogDetail, "name"))}.`}
                  renderRowActions={(row) => (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Can permission="create_medical">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openReminderModalForDog("medication", row, selectedDogDetail);
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #FDE68A", background: "#FFFBEB", color: "#D97706", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}
                        >
                          <FaPlus size={10} /> Reminder
                        </button>
                      </Can>
                      <Can permission="edit_medical">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleTogglePrescription(row);
                          }}
                          disabled={togglingRxId === str(pick(row, "id"))}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}
                        >
                          {pick(row, "is_active") ? "Mark Inactive" : "Mark Active"}
                        </button>
                      </Can>
                    </div>
                  )}
                />
              </div>
            )}

            {detailTab === "reminders" && (
              <div>
                <DataTable
                  columns={detailReminderColumns}
                  data={detailDogReminders}
                  module="medical"
                  emptyMessage={`No active reminders created for ${str(pick(selectedDogDetail, "name"))}.`}
                  renderRowActions={(row) => (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Can permission="create_medical">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotifyTarget({ row, dogName: str(pick(selectedDogDetail, "name")) });
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}
                        >
                          <FaPaperPlane size={10} /> Send
                        </button>
                      </Can>
                      <Can permission="delete_medical">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              row,
                              dogId: getDogCanonicalId(selectedDogDetail),
                              dogName: str(pick(selectedDogDetail, "name")),
                            });
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#EF4444", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}
                        >
                          <FaTrash size={10} /> Delete
                        </button>
                      </Can>
                    </div>
                  )}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setSelectedDogDetail(null)}
                style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Reminder Modal */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title={`Create Reminder for ${targetDogForModal ? str(pick(targetDogForModal, "name")) : "Dog"}`}
        maxWidth="560px"
      >
        <form onSubmit={handleCreateReminder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Kind</label>
              <select
                value={reminderForm.kind}
                onChange={(e) => setReminderForm({ ...reminderForm, kind: e.target.value as "vaccination" | "medication" })}
                style={inputStyle}
              >
                <option value="vaccination">Vaccination</option>
                <option value="medication">Medication</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Due *</label>
              <input
                type="datetime-local"
                required
                value={reminderForm.due_at}
                onChange={(e) => setReminderForm({ ...reminderForm, due_at: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rabies booster — due"
              value={reminderForm.title}
              onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Details</label>
            <textarea
              rows={3}
              value={reminderForm.details}
              onChange={(e) => setReminderForm({ ...reminderForm, details: e.target.value })}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Source Key</label>
            <input type="text" readOnly value={reminderForm.source_key} style={{ ...inputStyle, background: "#F1F5F9", color: "#64748B" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsReminderModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600, cursor: "pointer" }}>{isSubmitting ? "Saving..." : "Create Reminder"}</button>
          </div>
        </form>
      </Modal>

      {/* Send reminder notification Modal */}
      <Modal isOpen={notifyTarget !== null} onClose={() => setNotifyTarget(null)} title="Send Reminder Notification" maxWidth="520px">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
            Send a <strong>medical</strong> notification through the existing Notifications module to all active staff
            (super admin, rescue centre admin, veterinarian, shelter manager):
          </p>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
              {notifyTarget ? str(pick(notifyTarget.row, "title")) : ""}
            </div>
            <div style={{ fontSize: "13px", color: "#475569", marginTop: 6 }}>
              {notifyTarget?.dogName} — {notifyTarget ? str(pick(notifyTarget.row, "kind")) : ""} due {notifyTarget ? formatDate(pick(notifyTarget.row, "due_at")) : ""}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setNotifyTarget(null)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="button" onClick={handleSendReminderNotification} disabled={isNotifying} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}>{isNotifying ? "Sending..." : "Send Notification"}</button>
          </div>
        </div>
      </Modal>

      {/* Delete reminder Modal */}
      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete Reminder" maxWidth="450px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, color: "#334155" }}>
            Are you sure you want to delete the reminder <strong>{deleteTarget ? str(pick(deleteTarget.row, "title")) : ""}</strong> for {deleteTarget?.dogName}?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="button" disabled={isDeleting} onClick={handleDeleteReminder} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><FaTrash /> {isDeleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VaccinationReminders;