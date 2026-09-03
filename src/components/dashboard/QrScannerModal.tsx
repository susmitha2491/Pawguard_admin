import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../common/Modal";
import {
  FaQrcode,
  FaCamera,
  FaSearch,
  FaExclamationTriangle,
  FaPaw,
  FaStethoscope,
  FaHome,
  FaAmbulance,
  FaSync,
  FaUserShield,
  FaInfoCircle,
} from "react-icons/fa";
import petService from "../../services/petService";
import { getCurrentUserRole, normalizeRole, isScannerAuthorizedRole } from "../../utils/roleUtils";
import { formatDateTime } from "../../utils/dateUtils";
import { useToast } from "../../context/ToastContext";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedAnimalId?: string;
}

const extractTokenFromInput = (input: string): string => {
  if (!input) return "";
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) return tokenParam.trim();
    }
  } catch {
    // Not a valid URL, fall back to string parsing
  }
  return trimmed;
};

const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, expectedAnimalId }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const currentRole = getCurrentUserRole();
  const isAuthorized = isScannerAuthorizedRole();

  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [scannedPet, setScannedPet] = useState<Record<string, unknown> | null>(null);
  const [scannedTagMeta, setScannedTagMeta] = useState<Record<string, unknown> | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleResolveToken = useCallback(
    async (rawInput: string) => {
      const token = extractTokenFromInput(rawInput);
      if (!token) {
        setError("Please enter or scan a valid PawGuard Safety Tag token or QR URL.");
        return;
      }

      setLoading(true);
      setError(null);
      stopCamera();

      try {
        let petData: Record<string, unknown> | null = null;
        let tagMeta: Record<string, unknown> | null = null;
        let isTagRevoked = false;

        const upperToken = token.toUpperCase();
        const isDogToken = upperToken.startsWith("DGD");
        const isCompanionToken = upperToken.startsWith("CMP") || upperToken.startsWith("PET");

        // 1. Primary Dog Safety Tag Resolver (for DGD or generic tokens)
        if (isDogToken || (!isCompanionToken && !petData)) {
          try {
            const resolveRes = await petService.resolveDogSafetyTag(token);
            const resObj = resolveRes?.data || resolveRes;
            const dogObj = resObj?.dog || resObj;
            if (resObj && (resObj.id || resObj.dog_id || resObj.tag_id || dogObj.id || dogObj.name || dogObj.registration_number)) {
              const isActive = resObj.is_active !== false && String(resObj.status || "").toUpperCase() !== "INACTIVE";
              if (!isActive) {
                isTagRevoked = true;
              } else {
                petData = {
                  ...dogObj,
                  id: resObj.dog_id || dogObj.id || resObj.tag_id,
                  dog_id: resObj.dog_id || dogObj.id || resObj.tag_id,
                  token_prefix: resObj.token_prefix || dogObj.token_prefix,
                  scan_count: resObj.scan_count ?? dogObj.scan_count,
                  last_scanned_at: resObj.last_scanned_at || dogObj.last_scanned_at,
                };
                tagMeta = {
                  is_active: true,
                  token_prefix: resObj.token_prefix || token.slice(0, 8),
                  scan_count: resObj.scan_count ?? resObj.scans_count ?? 1,
                  last_scanned_at: resObj.last_scanned_at || new Date().toISOString(),
                };
              }
            }
          } catch (dogErr: any) {
            const status = dogErr?.response?.status;
            if (status !== 404 || isDogToken) {
              const apiMsg =
                dogErr?.response?.data?.error?.message ||
                dogErr?.response?.data?.detail ||
                dogErr?.response?.data?.message ||
                dogErr?.message;
              if (status === 404) {
                setError(`Dog Safety Tag token "${token}" was not found in the PawGuard database.`);
              } else {
                setError(apiMsg || `Backend error: Failed to resolve Dog Safety Tag token "${token}".`);
              }
              return;
            }
          }
        }

        // 2. Companion Pet Safety Tag Resolver (for CMP/PET or fallback on non-DGD tokens)
        if (!petData && !isTagRevoked && (isCompanionToken || !isDogToken)) {
          try {
            const scanRes = await petService.scanCompanionPetSafetyTag(token);
            const resObj = scanRes?.data || scanRes;
            if (resObj && (resObj.id || resObj.name || resObj.registration_number || resObj.pet_id)) {
              const isActive = resObj.is_active !== false && String(resObj.status || "").toUpperCase() !== "INACTIVE";
              if (!isActive) {
                isTagRevoked = true;
              } else {
                petData = resObj;
                tagMeta = {
                  is_active: true,
                  token_prefix: resObj.token_prefix || token.slice(0, 8),
                  scan_count: resObj.scan_count || resObj.scans_count || 1,
                  last_scanned_at: resObj.last_scanned_at || new Date().toISOString(),
                };
              }
            }
          } catch (compErr: any) {
            const status = compErr?.response?.status;
            const apiMsg =
              compErr?.response?.data?.error?.message ||
              compErr?.response?.data?.detail ||
              compErr?.response?.data?.message ||
              compErr?.message;
            if (status === 404) {
              setError(`Safety Tag token "${token}" was not found in the PawGuard database.`);
            } else {
              setError(apiMsg || `Backend error: Failed to scan Safety Tag token "${token}".`);
            }
            return;
          }
        }

        if (isTagRevoked) {
          setError(`Safety Tag "${token.slice(0, 12)}..." has been REVOKED/DEACTIVATED on the backend. Public scans no longer resolve for this tag.`);
        } else if (petData) {
          const resolvedId = String(petData.dog_id || petData.id || petData.pet_id || "").toLowerCase();
          const expectedId = String(expectedAnimalId || "").toLowerCase();

          if (expectedId && resolvedId && resolvedId !== expectedId) {
            setError(
              `⚠️ CANONICAL IDENTITY MISMATCH: The scanned Safety Tag belongs to animal "${petData.name || petData.registration_number}" (${resolvedId}), which does not match the expected animal ID "${expectedId}".`
            );
            setScannedPet(null);
            setScannedTagMeta(null);
            return;
          }

          setScannedPet(petData);
          setScannedTagMeta(tagMeta);
          addToast("Safety Tag scanned and verified successfully!", "success");
        } else {
          setError(
            `No active pet record found for scanned token "${token.slice(0, 12)}...". Please check the Safety Tag code.`
          );
        }
      } catch {
        setError("Failed to verify Safety Tag. Please check your internet connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [addToast, stopCamera, setError]
  );

  // Initialize camera when camera tab is selected
  useEffect(() => {
    if (!isOpen || activeTab !== "camera" || scannedPet) {
      stopCamera();
      return;
    }

    let isSubscribed = true;

    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported on this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check for native BarcodeDetector API support
        if ("BarcodeDetector" in window) {
          const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({
            formats: ["qr_code"],
          });

          const scanFrame = async () => {
            if (!isSubscribed || !videoRef.current || videoRef.current.readyState !== 4) {
              animationFrameRef.current = requestAnimationFrame(scanFrame);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const scannedVal = barcodes[0].rawValue;
                if (navigator.vibrate) navigator.vibrate(100);
                void handleResolveToken(scannedVal);
                return;
              }
            } catch {
              // Frame analysis error fallback
            }
            animationFrameRef.current = requestAnimationFrame(scanFrame);
          };

          animationFrameRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err: unknown) {
        if (!isSubscribed) return;
        const msg = (err as Error)?.message || "Could not access video camera.";
        setCameraError(`${msg} You can enter the Safety Tag code or paste the QR URL manually.`);
        setActiveTab("manual");
      }
    };

    void startCamera();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen, activeTab, scannedPet, stopCamera, handleResolveToken]);

  const handleResetScan = () => {
    setScannedPet(null);
    setScannedTagMeta(null);
    setError(null);
    setInputCode("");
    setActiveTab("camera");
  };

  const handleClose = () => {
    stopCamera();
    setScannedPet(null);
    setScannedTagMeta(null);
    setError(null);
    setCameraError(null);
    setInputCode("");
    onClose();
  };

  const normRole = normalizeRole(currentRole);
  const rawRole = String(currentRole || "").toLowerCase();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="PawGuard Safety Tag QR Scanner" maxWidth="640px">
      {!isAuthorized ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>
          <FaUserShield size={42} style={{ marginBottom: "12px" }} />
          <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700 }}>Access Restricted</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
            Your role does not have authorization to access the Safety Tag QR Scanner.
          </p>
        </div>
      ) : scannedPet ? (
        /* SCANNED PET IDENTITY CARD & RBAC ACTIONS */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Pet Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              borderRadius: "12px",
              padding: "16px",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                  border: "2px solid #1E3A8A",
              }}
            >
              {scannedPet.photo_url || scannedPet.avatar ? (
                <img
                  src={String(scannedPet.photo_url || scannedPet.avatar)}
                  alt="Pet"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <FaPaw size={28} color="#94A3B8" />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#FFFFFF" }}>
                  {String(scannedPet.name || scannedPet.pet_name || "Unknown Pet")}
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: scannedTagMeta?.is_active !== false ? "#D1FAE5" : "#FEE2E2",
                    color: scannedTagMeta?.is_active !== false ? "#15803D" : "#DC2626",
                    textTransform: "uppercase",
                  }}
                >
                  {scannedTagMeta?.is_active !== false ? "✓ ACTIVE TAG" : "⚠ INACTIVE TAG"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94A3B8" }}>
                Registration #: <strong style={{ color: "#F3F4F6" }}>{String(scannedPet.registration_number || scannedPet.id || "-")}</strong>
                {scannedPet.breed ? ` • Breed: ${String(scannedPet.breed)}` : ""}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Current Status</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                {String(scannedPet.current_status || scannedPet.status || "In Shelter")}
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Safety Tag Prefix</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E3A8A", fontFamily: "monospace", marginTop: "2px" }}>
                {String(scannedTagMeta?.token_prefix || scannedPet.token_prefix || "PG-TAG")}
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Scans</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                {String(scannedTagMeta?.scan_count ?? 1)} scans logged
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Last Scanned</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                {scannedTagMeta?.last_scanned_at ? formatDateTime(scannedTagMeta.last_scanned_at as string) : "Just now"}
              </div>
            </div>
          </div>

          {/* Role-Based Permitted Actions & Information */}
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E3A8A", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaInfoCircle /> Permitted Actions ({String(currentRole).toUpperCase()})
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {normRole === "super_admin" && (
                <>
                  <button
                    onClick={() => { handleClose(); navigate("/pets"); }}
                    style={{ padding: "8px 14px", borderRadius: "6px", background: "#1E3A8A", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaPaw /> Dog Management
                  </button>
                  <button
                    onClick={() => { handleClose(); navigate("/medical-records"); }}
                    style={{ padding: "8px 14px", borderRadius: "6px", background: "#1E3A8A", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaStethoscope /> Medical Records
                  </button>
                </>
              )}

              {normRole === "shelter_manager" && (
                <button
                  onClick={() => { handleClose(); navigate("/shelter-dogs"); }}
                    style={{ padding: "8px 14px", borderRadius: "6px", background: "#16A34A", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaHome /> Shelter Dogs Directory
                </button>
              )}

              {normRole === "rescue_centre_admin" && (
                <button
                  onClick={() => { handleClose(); navigate("/rescues"); }}
                  style={{ padding: "8px 14px", borderRadius: "6px", background: "#F59E0B", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaAmbulance /> Rescue Operations
                </button>
              )}

              {normRole === "rescue_coordinator" && (
                <button
                  onClick={() => { handleClose(); navigate("/rescue-requests"); }}
                  style={{ padding: "8px 14px", borderRadius: "6px", background: "#F59E0B", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaAmbulance /> Rescue Requests
                </button>
              )}

              {normRole === "rescue_agent" && (
                <button
                  onClick={() => { handleClose(); navigate("/rescues"); }}
                  style={{ padding: "8px 14px", borderRadius: "6px", background: "#EF4444", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaAmbulance /> Assigned Incidents
                </button>
              )}

              {normRole === "veterinarian" && (
                <button
                  onClick={() => { handleClose(); navigate("/veterinarian-dashboard?tab=shelter_requests"); }}
                    style={{ padding: "8px 14px", borderRadius: "6px", background: "#1E3A8A", color: "#FFF", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaStethoscope /> Veterinarian Workstation
                </button>
              )}

              {(rawRole.includes("foster") || normRole === "foster_coordinator") && (
                <div style={{ fontSize: "12px", color: "#1E3A8A", fontStyle: "italic" }}>
                  Foster Caregiver view: Pet safety verified. Care instructions and emergency contacts available via your Foster Dashboard.
                </div>
              )}
            </div>
          </div>

          {/* Reset Scan Button */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
            <button
              onClick={handleResetScan}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#F1F5F9",
                color: "#334155",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaSync /> Scan Another Tag
            </button>
            <button
              onClick={handleClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Close Scanner
            </button>
          </div>
        </div>
      ) : (
        /* SCANNING INTERFACE (CAMERA VS MANUAL INPUT) */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Mode Switcher Tabs */}
          <div style={{ display: "flex", background: "#F1F5F9", padding: "4px", borderRadius: "8px" }}>
            <button
              onClick={() => { setActiveTab("camera"); setError(null); }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "camera" ? "#FFFFFF" : "transparent",
                color: activeTab === "camera" ? "#1E3A8A" : "#64748B",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "camera" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <FaCamera /> Live Camera Scan
            </button>
            <button
              onClick={() => { stopCamera(); setActiveTab("manual"); setError(null); }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "manual" ? "#FFFFFF" : "transparent",
                color: activeTab === "manual" ? "#1E3A8A" : "#64748B",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "manual" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <FaQrcode /> Enter Code / QR URL
            </button>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {activeTab === "camera" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "380px",
                  height: "260px",
                  background: "#0F172A",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                border: "2px solid #1E3A8A",
                }}
              >
                <video
                  ref={videoRef}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  autoPlay
                  playsInline
                  muted
                />
                {/* Animated Scanner Overlay */}
                <div
                  style={{
                    position: "absolute",
                    width: "200px",
                    height: "200px",
                    border: "2px dashed #1E3A8A",
                    borderRadius: "12px",
                    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "2px",
                      background: "#1E3A8A",
                      boxShadow: "0 0 8px #1E3A8A",
                      animation: "scanLine 2s linear infinite",
                    }}
                  />
                </div>
              </div>

              {cameraError ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#D97706", textAlign: "center" }}>
                  {cameraError}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B", textAlign: "center" }}>
                  Position the physical PawGuard Safety Tag QR code within the frame to scan automatically.
                </p>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleResolveToken(inputCode);
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Safety Tag Token or Scanned Public URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cVnzRiqR2SSrFPuAJ1tvsbYQxb... or https://pawguard-public-web.vercel.app/scan?token=..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F1F5F9",
                    color: "#334155",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {loading ? (
                    <>
                      <FaSync style={{ animation: "spin 1s linear infinite" }} /> Verifying...
                    </>
                  ) : (
                    <>
                      <FaSearch /> Verify &amp; Scan Safety Tag
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};

export default QrScannerModal;
