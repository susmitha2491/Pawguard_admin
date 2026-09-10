import { useEffect, useState, useMemo } from "react";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import Select, { type SelectOption } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import Can from "../rbac/Can";
import { getCurrentUserRole } from "../../utils/roleUtils";
import shelterService from "../../services/shelterService";
import petService from "../../services/petService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { FaExchangeAlt, FaPlus, FaCheck, FaArrowLeft } from "react-icons/fa";

const unwrapList = (v: any): any[] =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

const dogId = (d: any) => d?.id || d?.dog_id || "";

const TRANSFER_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#FFFBEB", color: "#B45309" },
  completed: { label: "Completed", bg: "#ECFDF5", color: "#059669" },
  cancelled: { label: "Cancelled", bg: "#FEF2F2", color: "#DC2626" },
};

const transferBadge = (status: string) => {
  const meta =
    TRANSFER_STATUS_META[String(status || "").toLowerCase()] || {
      label: status || "Unknown",
      bg: "#F1F5F9",
      color: "#475569",
    };
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
        textTransform: "capitalize",
      }}
    >
      {meta.label}
    </span>
  );
};

/**
 * Shelter placement / transfer workflow.
 *
 * Flow: medical clearance -> Rescue Centre Admin requests placement (creates a
 * transfer request) -> receiving Shelter Manager confirms receiver -> sending
 * side confirms sender -> transfer completed.
 *
 * Role separation is enforced here by role (in addition to permissions):
 * - Receiver confirmation is ONLY for shelter managers (+ super admin).
 * - Sender confirmation is ONLY for the requesting centre admin (+ super admin).
 * - Rescue Centre Admin can create/view transfers but cannot approve as the
 *   receiving Shelter Manager.
 */
const ShelterTransfers = () => {
  const { addToast } = useToast();
  const role = getCurrentUserRole() || "";
  const isReceiverRole = role === "shelter_manager" || role === "super_admin";
  const isSenderRole = role === "rescue_centre_admin" || role === "super_admin";

  const [transfers, setTransfers] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    dog_id: "",
    from_facility_id: "",
    to_facility_id: "",
    notes: "",
  });

  const facilityName = (id?: string) => {
    if (!id) return "-";
    const f = facilities.find((x) => x.id === id);
    return f ? f.name : id;
  };

  const dogLabel = (id?: string) => {
    if (!id) return "-";
    const d = dogs.find((x) => dogId(x) === id);
    if (!d) return id;
    return `${d.name || "Dog"} (${d.registration_number || d.id || id})`;
  };

  const loadLookups = async () => {
    try {
      const [facRes, dogRes] = await Promise.all([
        shelterService.getShelters({ page: 1, page_size: 20 }),
        petService.getPets({ page: 1, page_size: 20 }),
      ]);
      setFacilities(unwrapList(facRes));
      setDogs(unwrapList(dogRes));
    } catch {
      setFacilities([]);
      setDogs([]);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await shelterService.getTransfers();
      const list = unwrapList(response);
      const formatted = list.map((t: any) => ({
        id: t.id,
        dog_id: t.dog_id,
        from_facility_id: t.from_facility_id,
        to_facility_id: t.to_facility_id,
        status: t.status || "pending",
        notes: t.notes || "-",
        sender_confirmed_at: t.sender_confirmed_at
          ? formatDateTime(t.sender_confirmed_at)
          : "-",
        receiver_confirmed_at: t.receiver_confirmed_at
          ? formatDateTime(t.receiver_confirmed_at)
          : "-",
        created_at: t.created_at ? formatDateTime(t.created_at) : "-",
      }));
      setTransfers(formatted);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to load shelter transfers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
    loadLookups();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dog_id || !form.from_facility_id || !form.to_facility_id) {
      addToast("Select the dog, source facility and destination facility.", "error");
      return;
    }
    if (form.from_facility_id === form.to_facility_id) {
      addToast("Source and destination facilities must be different.", "error");
      return;
    }
    try {
      setSubmitting(true);
      await shelterService.createTransfer({
        dog_id: form.dog_id,
        from_facility_id: form.from_facility_id,
        to_facility_id: form.to_facility_id,
        notes: form.notes || undefined,
      });
      addToast("Shelter placement request submitted!", "success");
      setIsModalOpen(false);
      setForm({ dog_id: "", from_facility_id: "", to_facility_id: "", notes: "" });
      fetchTransfers();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to request placement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (transferId: string, side: "receiver" | "sender") => {
    try {
      setSubmitting(true);
      if (side === "receiver") {
        await shelterService.confirmTransferReceiver(transferId);
        addToast("Placement approved — receiving confirmed.", "success");
      } else {
        await shelterService.confirmTransferSender(transferId);
        addToast("Handover confirmed by sending facility.", "success");
      }
      fetchTransfers();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || `Failed to confirm ${side} side`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRows = transfers.map((t) => ({
    ...t,
    dog_label: dogLabel(t.dog_id),
    from_label: facilityName(t.from_facility_id),
    to_label: facilityName(t.to_facility_id),
  }));

  const columns = [
    { key: "dog_label", header: "Dog" },
    { key: "from_label", header: "From Facility" },
    { key: "to_label", header: "To Facility" },
    { key: "status", header: "Status", render: (val: string) => transferBadge(val) },
    { key: "created_at", header: "Requested At" },
    { key: "sender_confirmed_at", header: "Sender Confirmed" },
    { key: "receiver_confirmed_at", header: "Receiver Confirmed" },
  ];

  const rowActions = (row: any) => {
    const pending = String(row.status || "").toLowerCase() === "pending";
    return (
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
        {isReceiverRole && pending && row.receiver_confirmed_at === "-" && (
          <button
            disabled={submitting}
            onClick={() => handleConfirm(row.id, "receiver")}
            title="Receiving Shelter Manager only"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#059669",
              color: "#FFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FaCheck /> Confirm Receiving
          </button>
        )}
        {isSenderRole && pending && row.sender_confirmed_at === "-" && (
          <button
            disabled={submitting}
            onClick={() => handleConfirm(row.id, "sender")}
            title="Requesting centre only"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#2563EB",
              color: "#FFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FaArrowLeft /> Confirm Sending
          </button>
        )}
      </div>
    );
  };

  const pendingCount = transfers.filter((t) => String(t.status).toLowerCase() === "pending").length;
  const completedCount = transfers.filter((t) => String(t.status).toLowerCase() === "completed").length;

  const dogOptions: SelectOption[] = useMemo(() => {
    return dogs.map((d) => ({
      value: dogId(d),
      label: String(d.name || "Dog"),
      sublabel: `Reg: ${d.registration_number || d.id || dogId(d)} • Status: ${d.status || "Unknown"}`,
    }));
  }, [dogs]);

  const facilityOptions: SelectOption[] = useMemo(() => {
    return facilities.map((f) => ({
      value: String(f.id),
      label: String(f.name || f.id),
      sublabel: f.facility_type ? `Type: ${f.facility_type}` : undefined,
    }));
  }, [facilities]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>
            Shelter Placements &amp; Transfers
          </h2>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
            Request and confirm transfers of medically cleared dogs between centres and shelters.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#B45309" }}>{pendingCount} pending</span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#059669" }}>{completedCount} completed</span>
          <Can permission="create_shelter">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#2563EB",
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FaPlus /> Request Placement
            </button>
          </Can>
        </div>
      </div>

      {role === "shelter_manager" && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            fontSize: "13px",
            color: "#065F46",
          }}
        >
          Incoming placement requests are listed below. Confirm receiving to approve the transfer.
        </div>
      )}

      <DataTable
        columns={columns}
        data={displayRows}
        loading={loading}
        error={error}
        onRetry={fetchTransfers}
        emptyMessage="No shelter transfers yet. Request a placement for a cleared dog."
        renderRowActions={rowActions}
        module="shelters"
      />

      {/* Request Placement Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Shelter Placement">
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <Select
              label="Dog"
              required
              placeholder="Search and select dog..."
              options={dogOptions}
              value={form.dog_id}
              onChange={(val) => setForm({ ...form, dog_id: String(val) })}
              searchable={true}
            />
          </div>
          <div>
            <Select
              label="From Facility (sending)"
              required
              placeholder="Select source facility..."
              options={facilityOptions}
              value={form.from_facility_id}
              onChange={(val) => setForm({ ...form, from_facility_id: String(val) })}
              searchable={facilityOptions.length >= 5}
            />
          </div>
          <div>
            <Select
              label="To Facility (receiving shelter)"
              required
              placeholder="Select destination facility..."
              options={facilityOptions}
              value={form.to_facility_id}
              onChange={(val) => setForm({ ...form, to_facility_id: String(val) })}
              searchable={facilityOptions.length >= 5}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FaExchangeAlt /> {submitting ? "Requesting..." : "Request Placement"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShelterTransfers;
