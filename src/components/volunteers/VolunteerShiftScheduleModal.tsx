import React, { useState, useEffect, useRef } from "react";
import { Modal } from "../common/Modal";
import { volunteerService } from "../../services/volunteerService";
import { shelterService } from "../../services/shelterService";
import notificationService from "../../services/notificationService";
import { useToast } from "../../context/ToastContext";
import { notifyDataChanged } from "../../utils/dataSync";

export const PREFERRED_ROLES = [
  "Foster Care",
  "Transport",
  "Events & Outreach",
  "Shelter Support",
];

export interface VolunteerShiftScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  facilities?: Array<{ id: string | number; name: string; latitude?: string; longitude?: string }>;
  approvedVolunteers?: Array<{
    id: string | number;
    full_name?: string;
    emergency_contact_name?: string;
    preferred_role?: string;
    user?: { full_name?: string; email?: string };
    [key: string]: any;
  }>;
  initialAssignedVolunteerId?: string;
}

const DEFAULT_FORM_STATE = {
  role_name: "Shelter Support & Care",
  preferred_role: "Shelter Support",
  date: new Date().toISOString().split("T")[0],
  start_time: "09:00",
  end_time: "13:00",
  shelter_facility_id: "",
  notes: "Please assist with daily shelter tasks.",
  capacity: 5,
  assigned_volunteer_id: "",
  location_name: "",
  latitude: "",
  longitude: "",
  allowed_radius_meters: "",
};

export const VolunteerShiftScheduleModal: React.FC<VolunteerShiftScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  facilities: externalFacilities,
  approvedVolunteers: externalVolunteers,
  initialAssignedVolunteerId,
}) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Self-sufficient internal state fallbacks for facilities & volunteers
  const [internalFacilities, setInternalFacilities] = useState<any[]>([]);
  const [internalVolunteers, setInternalVolunteers] = useState<any[]>([]);

  // Shift Form State
  const [shiftForm, setShiftForm] = useState({
    ...DEFAULT_FORM_STATE,
    assigned_volunteer_id: initialAssignedVolunteerId || "",
  });

  // Map references
  const createMapRef = useRef<any>(null);
  const createMapContainerRef = useRef<HTMLDivElement>(null);
  const createMarkerRef = useRef<any>(null);
  const createCircleRef = useRef<any>(null);
  const createTempMarkerRef = useRef<any>(null);

  // Map search query state
  const [createSearchQuery, setCreateSearchQuery] = useState("");

  // Keep assigned volunteer updated when initialAssignedVolunteerId changes
  useEffect(() => {
    if (isOpen) {
      setShiftForm((prev) => ({
        ...prev,
        assigned_volunteer_id: initialAssignedVolunteerId || prev.assigned_volunteer_id || "",
      }));
    }
  }, [isOpen, initialAssignedVolunteerId]);

  // Load facilities if not provided
  useEffect(() => {
    if (!isOpen) return;
    if (externalFacilities && externalFacilities.length > 0) {
      setInternalFacilities(externalFacilities);
      return;
    }
    let isMounted = true;
    shelterService
      .getShelters()
      .then((res: any) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setInternalFacilities(list);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen, externalFacilities]);

  // Load approved volunteers if not provided
  useEffect(() => {
    if (!isOpen) return;
    if (externalVolunteers && externalVolunteers.length > 0) {
      setInternalVolunteers(externalVolunteers);
      return;
    }
    let isMounted = true;
    volunteerService
      .getVolunteers()
      .then((res: any) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        const approved = list.filter((v: any) =>
          ["onboarded", "active", "approved"].includes(String(v.status || "").toLowerCase())
        );
        setInternalVolunteers(approved);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen, externalVolunteers]);

  const activeFacilities = externalFacilities && externalFacilities.length > 0 ? externalFacilities : internalFacilities;
  const activeVolunteers = externalVolunteers && externalVolunteers.length > 0 ? externalVolunteers : internalVolunteers;

  // Custom Leaflet SVG Icon to prevent 404 marker image asset loading issues in Vite
  const customMarkerIcon = (color: string = "#1E3A8A") => {
    const L = (window as any).L;
    if (!L) return null;
    return L.divIcon({
      html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
             </svg>`,
      className: "custom-leaflet-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  };

  // Initialize Map for Create Shift Modal
  useEffect(() => {
    const L = (window as any).L;
    if (!isOpen || !L || !createMapContainerRef.current) {
      if (createMapRef.current) {
        createMapRef.current.remove();
        createMapRef.current = null;
        createMarkerRef.current = null;
        createCircleRef.current = null;
      }
      return;
    }

    let defaultLat = 17.385044; // default center coords
    let defaultLng = 78.486671;

    if (shiftForm.shelter_facility_id) {
      const facility = activeFacilities.find((f: any) => String(f.id) === String(shiftForm.shelter_facility_id));
      if (facility && facility.latitude && facility.longitude) {
        defaultLat = parseFloat(facility.latitude);
        defaultLng = parseFloat(facility.longitude);
      }
    }

    // Initialize map with a small timeout to ensure DOM container is rendered
    const timer = setTimeout(() => {
      if (!createMapContainerRef.current) return;
      const map = L.map(createMapContainerRef.current).setView([defaultLat, defaultLng], 14);
      createMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // If coordinates are already present, draw marker and circle
      const initialLat = parseFloat(shiftForm.latitude);
      const initialLng = parseFloat(shiftForm.longitude);
      if (!isNaN(initialLat) && !isNaN(initialLng)) {
        const marker = L.marker([initialLat, initialLng], { icon: customMarkerIcon() }).addTo(map);
        createMarkerRef.current = marker;

        const radius = parseFloat(shiftForm.allowed_radius_meters) || 500;
        const circle = L.circle([initialLat, initialLng], {
          color: "#1E3A8A",
          fillColor: "#93C5FD",
          fillOpacity: 0.4,
          radius: radius,
        }).addTo(map);
        createCircleRef.current = circle;
        map.setView([initialLat, initialLng], 14);
      }

      // Map Click Handler to pick location
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const roundedLat = parseFloat(lat.toFixed(6));
        const roundedLng = parseFloat(lng.toFixed(6));

        setShiftForm((prev) => ({
          ...prev,
          latitude: String(roundedLat),
          longitude: String(roundedLng),
        }));

        if (createMarkerRef.current) {
          createMarkerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          createMarkerRef.current = L.marker([roundedLat, roundedLng], { icon: customMarkerIcon() }).addTo(map);
        }

        const radius = parseFloat(shiftForm.allowed_radius_meters) || 500;
        if (createCircleRef.current) {
          createCircleRef.current.setLatLng([roundedLat, roundedLng]);
          createCircleRef.current.setRadius(radius);
        } else {
          createCircleRef.current = L.circle([roundedLat, roundedLng], {
            color: "#1E3A8A",
            fillColor: "#93C5FD",
            fillOpacity: 0.4,
            radius: radius,
          }).addTo(map);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      setCreateSearchQuery("");
      createTempMarkerRef.current = null;
      if (createMapRef.current) {
        createMapRef.current.remove();
        createMapRef.current = null;
        createMarkerRef.current = null;
        createCircleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Center Create Map when shelter facility changes
  useEffect(() => {
    if (!createMapRef.current || !shiftForm.shelter_facility_id) return;
    const facility = activeFacilities.find((f: any) => String(f.id) === String(shiftForm.shelter_facility_id));
    if (facility && facility.latitude && facility.longitude) {
      const lat = parseFloat(facility.latitude);
      const lng = parseFloat(facility.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        createMapRef.current.setView([lat, lng], 14);
      }
    }
  }, [shiftForm.shelter_facility_id, activeFacilities]);

  // Synchronize manual inputs with Create Shift Map Marker and Circle
  useEffect(() => {
    const L = (window as any).L;
    if (!createMapRef.current || !L) return;

    const lat = parseFloat(shiftForm.latitude);
    const lng = parseFloat(shiftForm.longitude);
    const radius = parseFloat(shiftForm.allowed_radius_meters) || 500;

    const hasValidCoords = !isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180;

    if (hasValidCoords) {
      if (createMarkerRef.current) {
        createMarkerRef.current.setLatLng([lat, lng]);
      } else {
        createMarkerRef.current = L.marker([lat, lng], { icon: customMarkerIcon() }).addTo(createMapRef.current);
      }

      if (createCircleRef.current) {
        createCircleRef.current.setLatLng([lat, lng]);
        createCircleRef.current.setRadius(radius);
      } else {
        createCircleRef.current = L.circle([lat, lng], {
          color: "#1E3A8A",
          fillColor: "#93C5FD",
          fillOpacity: 0.4,
          radius: radius,
        }).addTo(createMapRef.current);
      }

      if (String(shiftForm.latitude).length > 7 && String(shiftForm.longitude).length > 7) {
        createMapRef.current.setView([lat, lng]);
      }
    } else {
      if (createMarkerRef.current) {
        createMarkerRef.current.remove();
        createMarkerRef.current = null;
      }
      if (createCircleRef.current) {
        createCircleRef.current.remove();
        createCircleRef.current = null;
      }
    }
  }, [shiftForm.latitude, shiftForm.longitude, shiftForm.allowed_radius_meters]);

  // Handle Map Search Location geocoding via Nominatim OSM
  const handleSearchLocation = async (query: string) => {
    if (!query.trim()) return;

    const map = createMapRef.current;
    if (!map) {
      addToast("Map is not initialized yet.", "error");
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            "User-Agent": "PawGuardAdminPortal/1.0 (contact@pawguard.org)",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Search service returned an error.");
      }

      const results = await response.json();
      if (results && results.length > 0) {
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (!isNaN(lat) && !isNaN(lon)) {
          // Center the map at the found coordinates and zoom in
          map.setView([lat, lon], 15);

          // Add/Update temporary search marker
          const L = (window as any).L;
          if (L) {
            const tempIcon = customMarkerIcon("#DC2626");
            if (createTempMarkerRef.current) {
              createTempMarkerRef.current.setLatLng([lat, lon]);
            } else {
              createTempMarkerRef.current = L.marker([lat, lon], { icon: tempIcon }).addTo(map);
            }
            createTempMarkerRef.current.bindPopup("Searched location. Click map near here to set final GPS point.").openPopup();
          }
          addToast(`Centered map on: ${result.display_name.split(",").slice(0, 2).join(",")}`, "success");
        }
      } else {
        addToast("Location not found. Try another search.", "info");
      }
    } catch {
      addToast("Failed to search location. Please check your connection.", "error");
    }
  };

  // Handle Create Shift Submission
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.role_name || !shiftForm.date || !shiftForm.start_time || !shiftForm.end_time) {
      addToast("Role name, date, start time, and end time are required.", "error");
      return;
    }
    if (shiftForm.start_time >= shiftForm.end_time) {
      addToast("End time must be after start time.", "error");
      return;
    }

    let latNum: number | null = null;
    let lonNum: number | null = null;
    let radNum: number | null = null;

    if (shiftForm.latitude.trim()) {
      latNum = parseFloat(shiftForm.latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        addToast("Latitude must be a valid number between -90 and 90.", "error");
        return;
      }
    }
    if (shiftForm.longitude.trim()) {
      lonNum = parseFloat(shiftForm.longitude);
      if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        addToast("Longitude must be a valid number between -180 and 180.", "error");
        return;
      }
    }
    if (shiftForm.allowed_radius_meters.trim()) {
      radNum = parseInt(shiftForm.allowed_radius_meters, 10);
      if (isNaN(radNum) || radNum <= 0) {
        addToast("Allowed radius must be a positive number greater than 0.", "error");
        return;
      }
    }

    if ((latNum !== null || lonNum !== null) && !shiftForm.location_name.trim()) {
      addToast("Location Name is required when configuring GPS coordinates.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const startIso = new Date(`${shiftForm.date}T${shiftForm.start_time}:00`).toISOString();
      const endIso = new Date(`${shiftForm.date}T${shiftForm.end_time}:00`).toISOString();

      let finalRoleName = shiftForm.role_name.trim();
      const selectedRole = shiftForm.preferred_role;
      if (selectedRole && !finalRoleName.toLowerCase().includes(selectedRole.toLowerCase())) {
        finalRoleName = `${finalRoleName} (${selectedRole})`;
      }

      const createdShift = await volunteerService.createShift({
        role_name: finalRoleName,
        shelter_facility_id: shiftForm.shelter_facility_id || null,
        start_at: startIso,
        end_at: endIso,
        capacity: Number(shiftForm.capacity || 5),
        notes: shiftForm.notes,
        status: "Scheduled",
        location_name: shiftForm.location_name.trim() || null,
        latitude: latNum,
        longitude: lonNum,
        allowed_radius_meters: radNum,
      });

      if (shiftForm.assigned_volunteer_id) {
        const shiftId = volunteerService.extractShiftId
          ? volunteerService.extractShiftId(createdShift)
          : createdShift?.id || createdShift?.data?.id || (createdShift?.data as any)?.data?.id;
        if (shiftId) {
          await volunteerService.assignShift(shiftId, shiftForm.assigned_volunteer_id).catch(() => {});
        }
      }

      await notificationService
        .sendBroadcastNotification({
          title: `New Volunteer Shift: ${finalRoleName}`,
          message: `A new volunteer shift for ${finalRoleName} has been scheduled. Sign up in your volunteer portal!`,
          type: "volunteer_shift",
          targetRoles: ["volunteer"],
          actionUrl: "/volunteer-dashboard",
        })
        .catch(() => {});

      addToast("Volunteer shift scheduled successfully!", "success");
      onClose();
      setShiftForm({
        ...DEFAULT_FORM_STATE,
        assigned_volunteer_id: "",
      });
      onSuccess?.();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to create shift.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Volunteer Shift Schedule">
      <form onSubmit={handleCreateShift} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
            Work / Shift Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Feeding & Socialization Care"
            value={shiftForm.role_name}
            onChange={(e) => setShiftForm({ ...shiftForm, role_name: e.target.value })}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Volunteer Type / Role *
            </label>
            <select
              value={shiftForm.preferred_role}
              onChange={(e) => setShiftForm({ ...shiftForm, preferred_role: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
            >
              {PREFERRED_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Date *
            </label>
            <input
              type="date"
              required
              value={shiftForm.date}
              onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Start Time *
            </label>
            <input
              type="time"
              required
              value={shiftForm.start_time}
              onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              End Time *
            </label>
            <input
              type="time"
              required
              value={shiftForm.end_time}
              onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
        </div>

        {activeFacilities.length > 0 && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Location (Shelter Facility) *
            </label>
            <select
              value={shiftForm.shelter_facility_id}
              onChange={(e) => setShiftForm({ ...shiftForm, shelter_facility_id: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
            >
              <option value="">Central Shelter Facility</option>
              {activeFacilities.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
            Instructions / Details
          </label>
          <textarea
            rows={3}
            placeholder="Provide specific guidelines, tasks, contact details or directions for the volunteer..."
            value={shiftForm.notes}
            onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }}
          />
        </div>

        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "6px" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#0F172A", fontWeight: 700 }}>
            GPS Geofencing Configuration
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Location Name (e.g. Shelter Entrance)
              </label>
              <input
                type="text"
                placeholder="e.g. PawGuard Main Shelter"
                value={shiftForm.location_name}
                onChange={(e) => setShiftForm({ ...shiftForm, location_name: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Allowed Radius (meters)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Leave empty for backend default (500m)"
                value={shiftForm.allowed_radius_meters}
                onChange={(e) => setShiftForm({ ...shiftForm, allowed_radius_meters: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Latitude
              </label>
              <input
                type="text"
                placeholder="e.g. 17.123456"
                value={shiftForm.latitude}
                onChange={(e) => setShiftForm({ ...shiftForm, latitude: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Longitude
              </label>
              <input
                type="text"
                placeholder="e.g. 78.123456"
                value={shiftForm.longitude}
                onChange={(e) => setShiftForm({ ...shiftForm, longitude: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
              Pick Location on Map
            </label>

            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search location (e.g. Hyderabad, shelter, street name)..."
                value={createSearchQuery}
                onChange={(e) => setCreateSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchLocation(createSearchQuery);
                  }
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                }}
              />
              <button
                type="button"
                onClick={() => handleSearchLocation(createSearchQuery)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1E3A8A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Search
              </button>
            </div>

            <div
              ref={createMapContainerRef}
              style={{
                width: "100%",
                height: "220px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                zIndex: 5,
                position: "relative",
              }}
            />
            <span style={{ display: "block", fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
              Click anywhere on the map to set the shift coordinates.
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Capacity Limit (Available Slots) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={shiftForm.capacity}
              onChange={(e) => setShiftForm({ ...shiftForm, capacity: Number(e.target.value) })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Direct Assignment (Optional)
            </label>
            <select
              value={shiftForm.assigned_volunteer_id}
              onChange={(e) => setShiftForm({ ...shiftForm, assigned_volunteer_id: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
            >
              <option value="">Open Shift (Volunteers can claim via Hub)</option>
              {activeVolunteers.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.user?.full_name || v.full_name || v.emergency_contact_name || "Volunteer"} ({v.preferred_role || "General"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700 }}
          >
            {isSubmitting ? "Saving..." : "Save Shift Schedule"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default VolunteerShiftScheduleModal;
