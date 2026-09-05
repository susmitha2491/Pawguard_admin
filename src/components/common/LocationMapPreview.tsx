import React from "react";
import { FaMapMarkerAlt, FaExternalLinkAlt } from "react-icons/fa";

export interface LocationMapPreviewProps {
  latitude?: string | number | null;
  longitude?: string | number | null;
  locationAddress?: string | null;
  locationLandmark?: string | null;
  height?: string;
  title?: string;
  showDetails?: boolean;
}

export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({
  latitude,
  longitude,
  locationAddress,
  locationLandmark,
  height = "220px",
  title = "Rescue Location Map Pin",
  showDetails = true,
}) => {
  const parseCoord = (val: string | number | null | undefined): number | null => {
    if (val === undefined || val === null || val === "" || val === "-") return null;
    const n = typeof val === "number" ? val : parseFloat(String(val));
    return Number.isFinite(n) ? n : null;
  };

  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);

  const hasCoords =
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0);

  const addressText = locationAddress && locationAddress !== "-" ? locationAddress : null;
  const landmarkText = locationLandmark && locationLandmark !== "-" ? locationLandmark : null;

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "12px",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Map Preview Embed or Fallback */}
      {hasCoords ? (
        <div>
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
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#64748B" }}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
          <iframe
            title="Rescue Location Map Pin"
            width="100%"
            height={height}
            style={{ border: 0, display: "block" }}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.008}%2C${lng + 0.008}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`}
          />
        </div>
      ) : (
        <div
          style={{
            height,
            background: "#F8FAFC",
            borderBottom: "1px dashed #CBD5E1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            textAlign: "center",
            color: "#64748B",
          }}
        >
          <FaMapMarkerAlt size={28} style={{ color: "#94A3B8", marginBottom: "8px" }} />
          <div style={{ fontWeight: 700, fontSize: "13px", color: "#334155" }}>
            Exact GPS location is not available for this rescue request.
          </div>
          {addressText && (
            <div style={{ fontSize: "12px", marginTop: "4px", color: "#64748B" }}>
              Recorded Text Location: "{addressText}"
            </div>
          )}
        </div>
      )}

      {/* Location Address & GPS Coordinates Details */}
      {showDetails && (
        <div style={{ padding: "12px 14px", fontSize: "13px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div>
            <span style={{ color: "#64748B", fontWeight: 600, fontSize: "12px", display: "block" }}>Address:</span>
            <strong style={{ color: "#0F172A" }}>{addressText || "Location address not recorded"}</strong>
            {landmarkText && (
              <span style={{ color: "#475569", fontSize: "12px", display: "block", marginTop: "2px" }}>
                Landmark: {landmarkText}
              </span>
            )}
          </div>

          {hasCoords ? (
            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ color: "#64748B", fontWeight: 600, fontSize: "12px" }}>Coordinates: </span>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#1E3A8A", fontWeight: 700 }}>
                  Latitude: {lat}, Longitude: {lng}
                </span>
              </div>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#2563EB",
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Open External Map <FaExternalLinkAlt size={10} />
                </a>
              )}
            </div>
          ) : (
            <div style={{ marginTop: "2px", fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>
              GPS coordinates not provided by reporter
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationMapPreview;
