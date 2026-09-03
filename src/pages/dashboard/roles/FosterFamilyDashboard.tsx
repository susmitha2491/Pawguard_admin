import { useState, useEffect } from "react";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { useToast } from "../../../context/ToastContext";
import { useNavigate } from "react-router-dom";
import { FaPaw, FaStethoscope, FaCalendarCheck, FaCamera } from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import { useDataSync } from "../../../utils/dataSync";

const FosterFamilyDashboard = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardService.getFosterDashboard();
      const data = res?.data || res || {};
      setDashboardData(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load foster care details. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useDataSync(fetchDashboard);

  const petsList = Array.isArray(dashboardData?.fostered_pets)
    ? dashboardData.fostered_pets
    : Array.isArray(dashboardData?.pets)
    ? dashboardData.pets
    : Array.isArray(dashboardData)
    ? dashboardData
    : [];

  const stats = [
    { title: "Fostered Pets", value: loading ? "..." : String(dashboardData?.fostered_count ?? dashboardData?.fosteredCount ?? petsList.length), trend: "Active Care", color: "#1E3A8A", icon: <FaPaw /> },
    { title: "Care Duration", value: loading ? "..." : `${dashboardData?.care_duration ?? dashboardData?.careDuration ?? 0} Days`, trend: "Active", color: "#16A34A", icon: <FaCalendarCheck /> },
    { title: "Next Vet Check", value: loading ? "..." : String(dashboardData?.next_vet_check ?? dashboardData?.nextVetCheck ?? "Scheduled"), trend: "Veterinary", color: "#1E3A8A", icon: <FaStethoscope /> },
  ];

  const columns = [
    { key: "petId", title: "Pet ID" },
    { key: "name", title: "Pet Name" },
    { key: "breed", title: "Breed" },
    { key: "diet", title: "Dietary Guidance" },
    { key: "status", title: "Care Status" },
  ];

  const formattedPets = petsList.map((p: any) => ({
    petId: p.id ?? p.pet_id ?? "",
    name: p.name ?? "",
    breed: p.breed ?? "",
    diet: p.dietary_guidance ?? p.diet ?? "",
    status: p.status ?? "",
  }));

  return (
    <div>
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Foster Family Portal</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Foster parent portal: view fostered pet details, medical checkup schedules, dietary guidelines, and upload updates.
        </p>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaCamera />} title="Upload Pet Photo" subtitle="Share health update photo" color="#1E3A8A" onClick={() => addToast("Select pet photo from your device to upload", "info")} />
        <QuickActionCard icon={<FaStethoscope />} title="Request Vet Appointment" subtitle="Book routine checkup" color="#16A34A" onClick={() => navigate("/medical")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            My Fostered Pet Profile & Medical Plan
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading foster profile...</span>}
        </div>
        <DataTable columns={columns} data={formattedPets} />
      </div>
    </div>
  );
};

export default FosterFamilyDashboard;

