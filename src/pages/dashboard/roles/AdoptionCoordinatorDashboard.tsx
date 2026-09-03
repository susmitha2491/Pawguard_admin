import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable, { type Column } from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { FaHeart, FaClipboardCheck, FaUserCheck, FaFileContract } from "react-icons/fa";
import adoptionService from "../../../services/adoptionService";
import dashboardService from "../../../services/dashboardService";
import { petService } from "../../../services/petService";
import { useDataSync } from "../../../utils/dataSync";

type CardFilter = "all" | "review" | "schedule" | "approve" | "completed" | "pending" | "adoptable_dogs";

const StatusBadge = ({ status }: { status: string }) => {
  const s = String(status || "").toLowerCase();
  let bg = "#EFF6FF";
  let color = "#1E3A8A";
  let label = s.toUpperCase();

  if (s === "submitted") {
    bg = "#EFF6FF";
    color = "#1E3A8A";
    label = "Submitted";
  } else if (s === "screening") {
    bg = "#F3E8FF";
    color = "#1E3A8A";
    label = "Screening";
  } else if (s === "interview") {
    bg = "#FEF3C7";
    color = "#D97706";
    label = "Interview";
  } else if (s === "home_check") {
    bg = "#E0E7FF";
    color = "#1E3A8A";
    label = "Home Visit";
  } else if (s === "approved" || s === "adoptable") {
    bg = "#D1FAE5";
    color = "#15803D";
    label = s === "adoptable" ? "Adoptable" : "Approved";
  } else if (s === "completed") {
    bg = "#DCFCE7";
    color = "#15803D";
    label = "Completed";
  } else if (s === "rejected") {
    bg = "#FEE2E2";
    color = "#B91C1C";
    label = "Rejected";
  } else if (s === "vetting") {
    bg = "#E0F2FE";
    color = "#0369A1";
    label = "Vetting";
  }

  return (
    <span
      style={{
        backgroundColor: bg,
        color,
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
};

const AdoptionCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const [adoptions, setAdoptions] = useState<any[]>([]);
  const [adoptionSummary, setAdoptionSummary] = useState<any | null>(null);
  const [adoptableDogsCount, setAdoptableDogsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const [adoptionsRes, dogsRes, dashRes] = await Promise.allSettled([
        adoptionService.getAdoptions({ page_size: 500 }),
        petService.getAllDogs(),
        dashboardService.getAdoptionDashboard().catch(() => null),
      ]);

      if (dashRes.status === "fulfilled" && dashRes.value) {
        const dData = dashRes.value?.data ?? dashRes.value;
        setAdoptionSummary(dData);
      }

      if (adoptionsRes.status === "fulfilled") {
        const body = adoptionsRes.value;
        const adoptionsList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setAdoptions(adoptionsList);
      } else {
        const errDetail =
          (adoptionsRes.reason as any)?.response?.data?.detail ||
          (adoptionsRes.reason as any)?.response?.data?.message ||
          "Adoption applications API returned 500 error.";
        console.error("Adoptions API fetch failed:", adoptionsRes.reason);
        setError(`⚠️ ${errDetail}`);
        setAdoptions([]);
      }

      if (dogsRes.status === "fulfilled") {
        const body = dogsRes.value;
        const dogsList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        const adoptableCount = dogsList.filter((d: any) => d.is_adoptable || d.status === "adoptable").length;
        setAdoptableDogsCount(adoptableCount);
      } else {
        setAdoptableDogsCount(0);
      }
    } catch {
      setError("Failed to load adoption coordinator metrics.");
      setAdoptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useDataSync(fetchDashboard);

  const completedCount = adoptionSummary?.completed_adoptions ?? adoptionSummary?.approved_adoptions ?? adoptions.filter((a) => ["completed", "approved"].includes(String(a.status).toLowerCase())).length;
  const pendingCount = adoptionSummary?.pending_review ?? adoptionSummary?.pending_applications ?? adoptions.filter((a) => ["submitted", "vetting", "screening", "interview", "home_check"].includes(String(a.status).toLowerCase())).length;
  const homeVisitsCount = adoptionSummary?.home_visits_scheduled ?? adoptions.filter((a) => a.home_inspection_scheduled_at || String(a.status).toLowerCase() === "home_check").length;
  const adoptableCountFinal = adoptionSummary?.adoptable_dogs_count ?? adoptableDogsCount;

  const handleCardClick = (filter: CardFilter) => {
    setCardFilter((prev) => (prev === filter ? "all" : filter));
    setTimeout(() => {
      const el = document.getElementById("adoption-table-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

  // Role-appropriate row click navigation: opens existing adoption workflow and exposes status-based actions
  const handleRowClick = (row: any) => {
    const raw = row.rawApp || row;
    const appId = String(raw.id || raw.applicationId || raw.application_id || row.appId || "").trim();
    const status = String(raw.status || row.status || "").toLowerCase();

    if (!appId || appId === "—") return;

    if (["submitted", "vetting", "screening"].includes(status)) {
      navigate(`/adoptions?tab=queue&status=${status}&appId=${encodeURIComponent(appId)}`);
    } else if (["home_check", "interview"].includes(status)) {
      navigate(`/adoptions?tab=queue&status=${status}&appId=${encodeURIComponent(appId)}`);
    } else if (status === "approved") {
      navigate(`/adoptions?tab=scoring&status=approved&appId=${encodeURIComponent(appId)}`);
    } else if (status === "completed") {
      navigate(`/adoptions?tab=completed&status=completed&appId=${encodeURIComponent(appId)}`);
    } else if (status === "rejected") {
      navigate(`/adoptions?tab=queue&status=rejected&appId=${encodeURIComponent(appId)}`);
    } else {
      navigate(`/adoptions?appId=${encodeURIComponent(appId)}`);
    }
  };

  const stats = [
    {
      title: "Adoptions Completed",
      value: loading ? "..." : String(completedCount),
      trend: cardFilter === "completed" ? "★ ACTIVE FILTER" : "YoY Progress",
      color: cardFilter === "completed" ? "#15803D" : "#16A34A",
      icon: <FaHeart />,
      onClick: () => handleCardClick("completed"),
    },
    {
      title: "Pending Applications",
      value: loading ? "..." : String(pendingCount),
      trend: cardFilter === "pending" ? "★ ACTIVE FILTER" : "Queue",
      color: cardFilter === "pending" ? "#D97706" : "#F59E0B",
      icon: <FaClipboardCheck />,
      onClick: () => handleCardClick("pending"),
    },
    {
      title: "Home Visits Scheduled",
      value: loading ? "..." : String(homeVisitsCount),
      trend: cardFilter === "schedule" ? "★ ACTIVE FILTER" : "Active Visits",
      color: cardFilter === "schedule" ? "#1E3A8A" : "#1E3A8A",
      icon: <FaUserCheck />,
      onClick: () => handleCardClick("schedule"),
    },
    {
      title: "Adoptable Dogs",
      value: loading ? "..." : String(adoptableCountFinal),
      trend: cardFilter === "adoptable_dogs" ? "★ ACTIVE FILTER" : "Ready",
      color: cardFilter === "adoptable_dogs" ? "#1E3A8A" : "#1E3A8A",
      icon: <FaFileContract />,
      onClick: () => handleCardClick("adoptable_dogs"),
    },
  ];

  const columns: Column<any>[] = [
    { key: "appId", title: "App ID / Dog ID" },
    { key: "applicant", title: "Applicant / Adopter" },
    { key: "pet", title: "Pet / Breed" },
    { key: "homeVisit", title: "Home Visit / Verification" },
    { key: "date", title: "Date" },
    { key: "status", title: "Decision Status", render: (val: string) => <StatusBadge status={val} /> },
  ];

  // Actionable queue filtering for real API records
  const filteredAdoptions = adoptions.filter((app: any) => {
    const s = String(app.status || "").toLowerCase();

    if (cardFilter === "review") {
      // 1. REVIEW APPLICANTS: Applications requiring initial review/screening/interview
      if (["approved", "completed", "rejected"].includes(s)) return false;
      if (!["submitted", "vetting", "screening"].includes(s)) return false;
    } else if (cardFilter === "schedule") {
      // 2. SCHEDULE HOME VERIFICATION: Applications ready for home verification visit
      if (["approved", "completed", "rejected"].includes(s)) return false;
      if (!app.home_inspection_scheduled_at && !["home_check", "interview"].includes(s)) return false;
    } else if (cardFilter === "approve") {
      // 3. APPROVE ADOPTION: Applications awaiting final approval decision (EXCLUDES already approved/completed)
      if (["approved", "completed", "rejected"].includes(s)) return false;
      if (!["home_check", "interview", "vetting", "screening"].includes(s)) return false;
    } else if (cardFilter === "completed") {
      // Historical finalized adoptions
      if (s !== "completed" && s !== "approved") return false;
    } else if (cardFilter === "pending") {
      // All pending applications
      if (!["submitted", "vetting", "screening", "interview", "home_check"].includes(s)) return false;
    } else if (cardFilter === "adoptable_dogs") {
      if (!app.dog?.is_adoptable && s !== "approved" && s !== "completed") return false;
    }

    return true;
  });

  const displayItems = filteredAdoptions.map((app: any) => {
    const appId = String(app.id || app.applicationId || app.application_id || "").slice(0, 18) || "—";
    const applicant = String(app.applicantName || app.applicant_name || app.user_full_name || app.user?.full_name || "—");
    const petName = String(app.petName || app.dog_name || app.dog?.name || "—");
    const petBreed = app.dog?.breed || app.dog_breed || "";
    const pet = petBreed ? `${petName} (${petBreed})` : petName;

    let homeVisit = "Not Scheduled";
    if (app.home_inspection_scheduled_at) {
      homeVisit = `Scheduled: ${new Date(app.home_inspection_scheduled_at).toLocaleDateString()}`;
    } else if (app.assigned_coordinator_name) {
      homeVisit = `Assigned: ${app.assigned_coordinator_name}`;
    }

    const dateVal = app.completed_at
      ? `Completed: ${new Date(app.completed_at).toLocaleDateString()}`
      : app.created_at
      ? new Date(app.created_at).toLocaleDateString()
      : app.date || "—";

    return {
      rawApp: app,
      appId,
      applicant,
      pet,
      homeVisit,
      date: dateVal,
      status: app.status || "submitted",
    };
  });

  return (
    <div>
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Adoption Operations Portal</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Adoption management: review applications, conduct home verification visits, hold interviews, and issue adoption clearance.
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
          {error}
        </div>
      )}

      {/* Summary Stat Cards (Interactive Navigation Controls) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <div key={s.title} style={{ cursor: "pointer" }}>
            <StatCard {...s} />
          </div>
        ))}
      </div>

      {/* Actionable Queue Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard
          icon={<FaHeart />}
          title="Approve Adoption"
          subtitle={cardFilter === "approve" ? "★ FILTER ACTIVE (Click to Clear)" : "Finalize legal paperwork & issuance"}
          color={cardFilter === "approve" ? "#EF4444" : "#16A34A"}
          onClick={() => handleCardClick("approve")}
        />
        <QuickActionCard
          icon={<FaUserCheck />}
          title="Schedule Home Verification"
          subtitle={cardFilter === "schedule" ? "★ FILTER ACTIVE (Click to Clear)" : "Assign field coordinator for inspection"}
          color={cardFilter === "schedule" ? "#EF4444" : "#1E3A8A"}
          onClick={() => handleCardClick("schedule")}
        />
        <QuickActionCard
          icon={<FaClipboardCheck />}
          title="Review Applicants"
          subtitle={cardFilter === "review" ? "★ FILTER ACTIVE (Click to Clear)" : "Inspect questionnaire & vetting status"}
          color={cardFilter === "review" ? "#EF4444" : "#F59E0B"}
          onClick={() => handleCardClick("review")}
        />
      </div>

      {/* Adoption Applications Queue Table Container */}
      <div id="adoption-table-section" className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Adoption Applications Queue &amp; Verification Progress
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading data...</span>}
        </div>

        <DataTable
          columns={columns}
          data={displayItems}
          onRowClick={handleRowClick}
          leftHeaderControls={
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>
                Table Queue Filter:
              </label>
              <select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value as CardFilter)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0F172A",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="all">All Applications (Show All)</option>
                <option value="review">Review Applicants Queue (Submitted / Vetting)</option>
                <option value="schedule">Schedule Home Verification Queue (Home Visit / Interview)</option>
                <option value="approve">Approve Adoption Queue (Awaiting Decision)</option>
                <option value="completed">Completed / Approved Adoptions (Historical)</option>
                <option value="adoptable_dogs">Adoptable Dogs Applications</option>
              </select>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default AdoptionCoordinatorDashboard;
