import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import petService from "../../services/petService";
import PawGuardLogo from "../../components/common/PawGuardLogo";
import {
  FaSearch,
  FaShieldAlt,
  FaExclamationTriangle,
  FaHeart,
  FaInfoCircle,
  FaPhoneAlt,
  FaCheckCircle,
  FaUserCheck,
  FaBan,
} from "react-icons/fa";

export interface PublicOwnerInfo {
  name?: string;
  contact?: string;
  city?: string;
  [key: string]: unknown;
}

export interface PublicDogData {
  id?: string;
  name: string;
  breed: string;
  breed_classification?: string;
  estimated_age: string | null;
  gender: string;
  weight_kg: number | null;
  temperament: string | null;
  color: string | null;
  photo_gallery_urls: string[];
  current_status?: string;
  status?: string;
  is_adoptable: boolean;
  registration_number: string;
  safety_tag_status?: string;
  is_tag_active?: boolean;
  owner_name?: string;
  adopter_name?: string;
  public_owner?: PublicOwnerInfo;
  [key: string]: unknown;
}

const PublicDogProfile = () => {
  const { dogId: pathDogId } = useParams<{ dogId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract ID or Token from URL path or query string (?id=..., ?dog_id=..., ?token=...)
  const targetId =
    pathDogId ||
    searchParams.get("token") ||
    searchParams.get("id") ||
    searchParams.get("dog_id") ||
    "";

  const [searchInput, setSearchInput] = useState(targetId);
  const [dog, setDog] = useState<PublicDogData | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(targetId.trim()));
  const [error, setError] = useState<string | null>(() =>
    targetId.trim() ? null : "No pet identifier provided. Please scan a valid PawGuard QR tag or enter a Tag ID below."
  );

  useEffect(() => {
    let isSubscribed = true;

    const runFetch = async () => {
      const query = targetId.trim();
      if (!query) return;

      setLoading(true);
      setError(null);
      setDog(null);

      try {
        let data: PublicDogData | null = null;
        let isRevokedTag = false;

        const tokenToScan = searchParams.get("token") || query;
        if (tokenToScan) {
          const res = await petService.getPublicDogScan(tokenToScan);
          const raw = res?.data || res;
          if (raw && (raw.name || raw.registration_number || raw.pet || raw.id || raw.dog_id || raw.pet_id)) {
            const isActive = raw.is_active !== false && String(raw.status || "").toUpperCase() !== "INACTIVE";
            if (!isActive) {
              isRevokedTag = true;
            } else {
              data = raw.pet || raw;
            }
          }
        }

        if (isSubscribed) {
          if (isRevokedTag || (data && (data.is_tag_active === false || data.safety_tag_status === "INACTIVE"))) {
            setError("This Safety Tag has been REVOKED/DEACTIVATED. Scans will no longer resolve for this pet.");
            setDog(null);
          } else if (data && (data.name || data.registration_number)) {
            setDog(data);
          } else {
            setError("Pet profile not found. The scanned QR code does not match an active pet record.");
          }
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          let msg = "Pet not found. The scanned QR code or identifier could not be matched to an active pet record in the PawGuard database.";
          const e = err as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
          const apiMsg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.response?.data?.detail;
          if (apiMsg) {
            msg = String(apiMsg);
          }
          setError(msg);
          setDog(null);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    runFetch();

    return () => {
      isSubscribed = false;
    };
  }, [targetId, searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/public-scan/${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const statusStr = String(dog?.current_status || dog?.status || "").toLowerCase();
  const isLost = statusStr === "lost";
  const isAdopted = statusStr === "adopted";
  const isTagDeactivated = dog?.safety_tag_status === "INACTIVE" || dog?.safety_tag_status === "revoked" || dog?.is_tag_active === false;

  // Extract privacy-safe owner details if provided by backend public scan API
  const publicOwnerName = dog?.public_owner?.name || dog?.owner_name || dog?.adopter_name;
  const publicOwnerContact = dog?.public_owner?.contact;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F172A",
        color: "#F8FAFC",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
      }}
    >
      {/* Header Banner */}
      <header
        style={{
          width: "100%",
          maxWidth: "600px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #1E293B",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <PawGuardLogo size={36} />
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#FFFFFF" }}>
              PawGuard
            </h1>
            <span style={{ fontSize: "11px", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>
              Official Public Pet Scan &amp; Verification
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#E2E8F0",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Staff Login
        </button>
      </header>

      {/* Manual Tag Lookup Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          width: "100%",
          maxWidth: "600px",
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <FaSearch
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#64748B",
              fontSize: "14px",
            }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter Dog Registration No. or QR Tag ID (e.g. DOG-2026-1017)..."
            style={{
              width: "100%",
              padding: "12px 14px 12px 38px",
              borderRadius: "10px",
              border: "1px solid #334155",
              backgroundColor: "#1E293B",
              color: "#FFFFFF",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Lookup
        </button>
      </form>

      {/* Content Container */}
      <main style={{ width: "100%", maxWidth: "600px" }}>
        {/* Loading State */}
        {loading && (
          <div
            style={{
              backgroundColor: "#1E293B",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                margin: "0 auto 16px",
                border: "3px solid #334155",
                borderTopColor: "#2563EB",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px", fontWeight: 600 }}>
              Scanning PawGuard database for pet details...
            </p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error State (Invalid/Non-existent QR) */}
        {!loading && error && (
          <div
            style={{
              backgroundColor: "#1E293B",
              borderRadius: "16px",
              padding: "32px 24px",
              textAlign: "center",
              border: "1px solid #EF4444",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: "24px",
              }}
            >
              <FaExclamationTriangle />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#FFFFFF" }}>
              Pet Profile Not Found
            </h2>
            <p style={{ margin: "0 0 20px", color: "#CBD5E1", fontSize: "14px", lineHeight: 1.5 }}>
              {error}
            </p>
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid #334155",
                fontSize: "12px",
                color: "#94A3B8",
                textAlign: "left",
              }}
            >
              <strong style={{ color: "#E2E8F0" }}>Why am I seeing this?</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                <li>The QR code or identifier may be mistyped or outdated.</li>
                <li>No random pet profile is displayed to ensure strict identity security.</li>
                <li>If you found a stray dog, please contact your local PawGuard rescue dispatch.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Success State: Privacy-Safe Public Profile Card */}
        {!loading && !error && dog && (
          <div
            style={{
              backgroundColor: "#1E293B",
              borderRadius: "16px",
              border: "1px solid #334155",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Tag Deactivated Alert Banner */}
            {isTagDeactivated && (
              <div
                style={{
                  backgroundColor: "#7F1D1D",
                  color: "#FECACA",
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderBottom: "1px solid #991B1B",
                }}
              >
                <FaBan style={{ fontSize: "18px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 700 }}>
                  ⚠️ SAFETY TAG DEACTIVATED: This Safety Tag has been deactivated or revoked by shelter administrators.
                </span>
              </div>
            )}

            {/* Missing Pet Highlighted Alert Banner */}
            {isLost && (
              <div
                style={{
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <FaExclamationTriangle style={{ fontSize: "22px", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800 }}>
                    ALERT: THIS PET IS REPORTED MISSING / LOST!
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", opacity: 0.95, lineHeight: 1.4 }}>
                    If you have found this pet or have information regarding their whereabouts, please contact PawGuard Rescue Dispatch immediately or submit a sighting report.
                  </p>
                </div>
              </div>
            )}

            {/* Profile Header */}
            <div
              style={{
                padding: "24px",
                background: "linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, rgba(30, 41, 59, 0) 100%)",
                borderBottom: "1px solid #334155",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#FFFFFF" }}>
                      {dog.name || "Unnamed Dog"}
                    </h2>
                    <FaShieldAlt style={{ color: "#3B82F6", fontSize: "18px" }} title="Verified PawGuard Tag" />
                  </div>
                  <div style={{ fontSize: "13px", color: "#94A3B8" }}>
                    Tag / Reg No: <strong style={{ color: "#60A5FA", fontFamily: "monospace", fontSize: "14px" }}>{dog.registration_number}</strong>
                  </div>
                </div>

                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    backgroundColor: isLost
                      ? "rgba(220, 38, 38, 0.2)"
                      : isAdopted
                      ? "rgba(59, 130, 246, 0.25)"
                      : dog.is_adoptable
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(100, 116, 139, 0.2)",
                    color: isLost
                      ? "#FCA5A5"
                      : isAdopted
                      ? "#93C5FD"
                      : dog.is_adoptable
                      ? "#34D399"
                      : "#CBD5E1",
                    border: `1px solid ${
                      isLost
                        ? "rgba(239, 68, 68, 0.4)"
                        : isAdopted
                        ? "rgba(59, 130, 246, 0.5)"
                        : dog.is_adoptable
                        ? "rgba(16, 185, 129, 0.4)"
                        : "rgba(100, 116, 139, 0.4)"
                    }`,
                  }}
                >
                  {isLost
                    ? "Missing / Lost"
                    : isAdopted
                    ? "Adoption Status: ADOPTED"
                    : dog.is_adoptable
                    ? "Available for Adoption"
                    : "In Shelter Care"}
                </span>
              </div>
            </div>

            {/* Gallery Images (if available) */}
            {Array.isArray(dog.photo_gallery_urls) && dog.photo_gallery_urls.length > 0 && (
              <div style={{ padding: "16px 24px 0", display: "flex", gap: "10px", overflowX: "auto" }}>
                {dog.photo_gallery_urls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`${dog.name || "Pet"} photo ${idx + 1}`}
                    style={{
                      width: "120px",
                      height: "120px",
                      borderRadius: "12px",
                      objectFit: "cover",
                      border: "1px solid #334155",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Attributes Grid */}
            <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Breed</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px" }}>
                  {dog.breed || "-"} {dog.breed_classification ? `(${dog.breed_classification})` : ""}
                </div>
              </div>

              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Gender</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px", textTransform: "capitalize" }}>
                  {dog.gender || "-"}
                </div>
              </div>

              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Estimated Age</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px" }}>
                  {dog.estimated_age || "-"}
                </div>
              </div>

              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Weight</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px" }}>
                  {dog.weight_kg ? `${dog.weight_kg} kg` : "-"}
                </div>
              </div>

              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Temperament</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px", textTransform: "capitalize" }}>
                  {dog.temperament || "-"}
                </div>
              </div>

              <div style={{ backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "10px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Coat Color / Markings</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC", marginTop: "2px" }}>
                  {dog.color || "-"}
                </div>
              </div>
            </div>

            {/* ADOPTED DOG: CURRENT PET OWNER SECTION */}
            {isAdopted && (
              <div style={{ padding: "0 24px 24px" }}>
                <div
                  style={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #3B82F6",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#60A5FA", marginBottom: "8px" }}>
                    <FaUserCheck style={{ fontSize: "18px" }} />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>
                      CURRENT PET OWNER
                    </h3>
                  </div>

                  {publicOwnerName ? (
                    <div style={{ fontSize: "13px", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div><strong>Owner Name:</strong> {publicOwnerName}</div>
                      {publicOwnerContact && <div><strong>Contact:</strong> {publicOwnerContact}</div>}
                      <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                        🔒 Exposing only backend-approved public identity records.
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>
                      Public adoption owner information is not currently provided by the backend public API.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lost & Found Workflow Notice & Action Buttons */}
            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  border: "1px solid rgba(37, 99, 235, 0.25)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  fontSize: "12px",
                  color: "#93C5FD",
                  lineHeight: 1.5,
                  display: "flex",
                  gap: "10px",
                }}
              >
                <FaInfoCircle style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>PawGuard Lost &amp; Found Reunification Workflow:</strong>
                  <br />
                  Scanning this QR code confirms pet identity. Official reunification or pet claim requires verification by shelter administrators through the Lost &amp; Found matching workflow.
                </div>
              </div>

              {isLost ? (
                <button
                  onClick={() => navigate("/lost-and-found")}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#EF4444",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <FaPhoneAlt /> Report Found Pet / Match Sighting
                </button>
              ) : !isAdopted && dog.is_adoptable ? (
                <button
                  onClick={() => navigate("/adoptions")}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#10B981",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <FaHeart /> Apply to Adopt {dog.name || "Pet"}
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "#64748B",
                  }}
                >
                  <FaCheckCircle color="#10B981" /> Verified Active PawGuard Animal Record
                </div>
              )}
            </div>

            {/* Privacy Protection Statement */}
            <div
              style={{
                backgroundColor: "#0F172A",
                padding: "12px 24px",
                borderTop: "1px solid #334155",
                fontSize: "11px",
                color: "#64748B",
                textAlign: "center",
              }}
            >
              🔒 <strong>Privacy Protected:</strong> Only public identification attributes are displayed. Internal medical files, staff notes, and private contact records are hidden in compliance with PawGuard Data Security Standard.
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: "32px", fontSize: "12px", color: "#64748B", textAlign: "center" }}>
        <p style={{ margin: 0 }}>
          PawGuard Rescue &amp; Shelter Network &bull; Unique 1:1 Pet QR Code System
        </p>
      </footer>
    </div>
  );
};

export default PublicDogProfile;
