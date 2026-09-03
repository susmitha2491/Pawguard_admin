import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { FaPaw, FaAmbulance, FaHeart, FaHome } from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import petService from "../../../services/petService";
import { useDataSync } from "../../../utils/dataSync";

const GeneralPublicDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [adoptableDogs, setAdoptableDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pubRes, petRes] = await Promise.allSettled([
        dashboardService.getPublicDashboard(),
        petService.getPets({ is_adoptable: true }),
      ]);

      const pubData = pubRes.status === "fulfilled" ? (pubRes.value?.data || pubRes.value || {}) : {};
      const petList = petRes.status === "fulfilled"
        ? (Array.isArray(petRes.value?.data) ? petRes.value.data : Array.isArray(petRes.value) ? petRes.value : [])
        : [];

      setDashboardData(pubData);
      setAdoptableDogs(petList);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load community portal data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useDataSync(fetchDashboard);

  const rawDogsList = adoptableDogs.length > 0
    ? adoptableDogs
    : Array.isArray(dashboardData?.dogs)
    ? dashboardData.dogs
    : Array.isArray(dashboardData?.pets)
    ? dashboardData.pets
    : Array.isArray(dashboardData?.items)
    ? dashboardData.items
    : [];

  const dogsList = rawDogsList.filter((dog: any) => dog.is_public_visible !== false);

  const adoptableCount = Number(
    dashboardData?.adoptable_dogs ??
    dashboardData?.adoptableDogs ??
    dogsList.length
  );

  const rescueFacilitiesCount = Number(
    dashboardData?.rescue_facilities ??
    dashboardData?.rescueFacilities ??
    dashboardData?.facilities_count ??
    0
  );

  const totalRescuedCount = Number(
    dashboardData?.total_rescued ??
    dashboardData?.totalRescued ??
    dashboardData?.rescued_count ??
    0
  );

  const stats = [
    { title: "Adoptable Dogs", value: loading ? "..." : String(adoptableCount), trend: "Browsing Open", color: "#1E3A8A", icon: <FaPaw /> },
    { title: "Rescue Facilities", value: loading ? "..." : String(rescueFacilitiesCount), trend: "Open Visitors", color: "#16A34A", icon: <FaHome /> },
    { title: "Total Rescued", value: loading ? "..." : String(totalRescuedCount), trend: "Saved", color: "#F59E0B", icon: <FaHeart /> },
  ];

  const columns = [
    { key: "petId", title: "Pet ID" },
    { key: "name", title: "Pet Name" },
    { key: "breed", title: "Breed" },
    { key: "age", title: "Age" },
    { key: "shelter", title: "Shelter Location" },
    { key: "status", title: "Status" },
  ];

  const formattedDogs = dogsList.map((dog: any) => ({
    petId: dog.registration_number || dog.id || "-",
    name: dog.name || "Unnamed Dog",
    breed: dog.breed || "Canine",
    age: dog.estimated_age || (dog.age_months ? `${dog.age_months} months` : "-"),
    shelter: dog.location_found || dog.shelter || dog.location || "Central Shelter",
    status: dog.is_adoptable ? "Ready for Adoption" : (dog.status || "Rescued"),
  }));

  return (
    <div>
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Public Community Portal</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Community portal: report stray animals in distress, browse adoptable dogs, and locate rescue shelters.
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
        <QuickActionCard icon={<FaAmbulance />} title="Report Stray in Distress" subtitle="Submit emergency location" color="#DC2626" onClick={() => navigate("/requests")} />
        <QuickActionCard icon={<FaHeart />} title="Submit Adoption Application" subtitle="Apply to adopt a pet" color="#1E3A8A" onClick={() => navigate("/adoptions")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Featured Adoptable Dogs Looking for a Home
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading featured dogs...</span>}
        </div>
        <DataTable columns={columns} data={formattedDogs} />
      </div>
    </div>
  );
};

export default GeneralPublicDashboard;

