import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaUsers,
  FaCalendarAlt,
  FaClipboardList,
  FaUserCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaFilter,
  FaSearch,
  FaEye,
  FaClock,
  FaSignInAlt,
  FaSignOutAlt,
  FaAward,
  FaPaperPlane,
  FaFileDownload,
  FaChartBar,
  FaCheckDouble,
  FaEdit,
} from "react-icons/fa";
import volunteerService from "../../../services/volunteerService";
import dashboardService from "../../../services/dashboardService";
import shelterService from "../../../services/shelterService";
import notificationService from "../../../services/notificationService";
import reportsService from "../../../services/reportsService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";

const PREFERRED_ROLES = [
  "Foster Care",
  "Transport",
  "Events & Outreach",
  "Shelter Support",
];

const DEFAULT_APPROVAL_MSG =
  "Thank you for applying to volunteer with PawGuard. Your volunteer application has been approved. We will contact you when a suitable volunteer opportunity becomes available based on your preferred role and availability.";

const DEFAULT_REJECTION_MSG =
  "Thank you for your interest in volunteering with PawGuard. After reviewing your application, we are unable to proceed with your application at this time. We appreciate your interest in supporting animal welfare.";

type TabKey = "overview" | "pipeline" | "roster" | "schedules" | "attendance" | "completed" | "performance_reports";

const VolunteerCoordinatorDashboard = () => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [_stats, setStats] = useState<any>(null);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [volunteerFilter, setVolunteerFilter] = useState<string>("");

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAssignWorkModalOpen, setIsAssignWorkModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [selectedShiftToAssign, setSelectedShiftToAssign] = useState<any | null>(null);
  const [selectedAssignVolunteerId, setSelectedAssignVolunteerId] = useState<string>("");
  const [selectedVolunteerRecord, setSelectedVolunteerRecord] = useState<any | null>(null);
  const [volunteerSummary, setVolunteerSummary] = useState<any | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assignWorkForm, setAssignWorkForm] = useState({
    volunteer_id: "",
    role_name: "Shelter Support & Care",
    notes: "Assigned volunteer work task.",
    shelter_facility_id: "",
    assignment_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "13:00",
    priority: "Normal",
    status: "Scheduled",
  });

  // Review Form
  const [customMessage, setCustomMessage] = useState<string>("");
  const [reviewRole, setReviewRole] = useState<string>("Shelter Support");

  // Application Intake Form
  const [applyForm, setApplyForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    preferred_role: "Shelter Support",
    availability: "Weekends & Mornings",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    skills: "Dog Walking, Grooming",
    notes: "",
  });

  // Shift Form
  const [shiftForm, setShiftForm] = useState({
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
  });

  // Edit Shift Form & State
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
  const [_selectedShiftToEdit, setSelectedShiftToEdit] = useState<any>(null);
  const [editShiftForm, setEditShiftForm] = useState({
    id: "",
    role_name: "",
    preferred_role: "",
    date: "",
    start_time: "",
    end_time: "",
    shelter_facility_id: "",
    notes: "",
    capacity: 5,
    location_name: "",
    latitude: "",
    longitude: "",
    allowed_radius_meters: "",
  });

  // Map references
  const createMapRef = useRef<any>(null);
  const editMapRef = useRef<any>(null);
  const createMapContainerRef = useRef<HTMLDivElement>(null);
  const editMapContainerRef = useRef<HTMLDivElement>(null);
  const createMarkerRef = useRef<any>(null);
  const editMarkerRef = useRef<any>(null);
  const createCircleRef = useRef<any>(null);
  const editCircleRef = useRef<any>(null);

  // Map search query states & temp marker refs
  const [createSearchQuery, setCreateSearchQuery] = useState("");
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const createTempMarkerRef = useRef<any>(null);
  const editTempMarkerRef = useRef<any>(null);

  // Volunteer Certificate Issued tracking
  const [issuedCertificates, setIssuedCertificates] = useState<Record<string, boolean>>({});

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
    if (!isShiftModalOpen || !L || !createMapContainerRef.current) {
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
      const facility = facilities.find((f: any) => String(f.id) === String(shiftForm.shelter_facility_id));
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
        attribution: '&copy; OpenStreetMap contributors',
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
  }, [isShiftModalOpen]);

  // Center Create Map when shelter facility changes
  useEffect(() => {
    if (!createMapRef.current || !shiftForm.shelter_facility_id) return;
    const facility = facilities.find((f: any) => String(f.id) === String(shiftForm.shelter_facility_id));
    if (facility && facility.latitude && facility.longitude) {
      const lat = parseFloat(facility.latitude);
      const lng = parseFloat(facility.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        createMapRef.current.setView([lat, lng], 14);
      }
    }
  }, [shiftForm.shelter_facility_id, facilities]);

  // Initialize Map for Edit Shift Modal
  useEffect(() => {
    const L = (window as any).L;
    if (!isEditShiftModalOpen || !L || !editMapContainerRef.current) {
      if (editMapRef.current) {
        editMapRef.current.remove();
        editMapRef.current = null;
        editMarkerRef.current = null;
        editCircleRef.current = null;
      }
      return;
    }

    let defaultLat = 17.385044; // default center coords
    let defaultLng = 78.486671;

    // Center on existing shift coordinates if available
    const initialLat = parseFloat(editShiftForm.latitude);
    const initialLng = parseFloat(editShiftForm.longitude);
    const hasInitialCoords = !isNaN(initialLat) && !isNaN(initialLng);

    if (hasInitialCoords) {
      defaultLat = initialLat;
      defaultLng = initialLng;
    } else if (editShiftForm.shelter_facility_id) {
      // Center on facility fallback coordinates
      const facility = facilities.find((f: any) => String(f.id) === String(editShiftForm.shelter_facility_id));
      if (facility && facility.latitude && facility.longitude) {
        defaultLat = parseFloat(facility.latitude);
        defaultLng = parseFloat(facility.longitude);
      }
    }

    // Initialize map with a small timeout to ensure DOM container is rendered
    const timer = setTimeout(() => {
      if (!editMapContainerRef.current) return;
      const map = L.map(editMapContainerRef.current).setView([defaultLat, defaultLng], 14);
      editMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // If coordinates are present, draw marker and circle
      if (hasInitialCoords) {
        const marker = L.marker([initialLat, initialLng], { icon: customMarkerIcon() }).addTo(map);
        editMarkerRef.current = marker;

        const radius = parseFloat(editShiftForm.allowed_radius_meters) || 500;
        const circle = L.circle([initialLat, initialLng], {
          color: "#1E3A8A",
          fillColor: "#93C5FD",
          fillOpacity: 0.4,
          radius: radius,
        }).addTo(map);
        editCircleRef.current = circle;
        map.setView([initialLat, initialLng], 14);
      }

      // Map Click Handler to pick location
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const roundedLat = parseFloat(lat.toFixed(6));
        const roundedLng = parseFloat(lng.toFixed(6));

        setEditShiftForm((prev) => ({
          ...prev,
          latitude: String(roundedLat),
          longitude: String(roundedLng),
        }));

        if (editMarkerRef.current) {
          editMarkerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          editMarkerRef.current = L.marker([roundedLat, roundedLng], { icon: customMarkerIcon() }).addTo(map);
        }

        const radius = parseFloat(editShiftForm.allowed_radius_meters) || 500;
        if (editCircleRef.current) {
          editCircleRef.current.setLatLng([roundedLat, roundedLng]);
          editCircleRef.current.setRadius(radius);
        } else {
          editCircleRef.current = L.circle([roundedLat, roundedLng], {
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
      setEditSearchQuery("");
      editTempMarkerRef.current = null;
      if (editMapRef.current) {
        editMapRef.current.remove();
        editMapRef.current = null;
        editMarkerRef.current = null;
        editCircleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditShiftModalOpen]);

  // Center Edit Map when shelter facility changes
  useEffect(() => {
    if (!editMapRef.current || !editShiftForm.shelter_facility_id) return;
    const facility = facilities.find((f: any) => String(f.id) === String(editShiftForm.shelter_facility_id));
    if (facility && facility.latitude && facility.longitude) {
      const lat = parseFloat(facility.latitude);
      const lng = parseFloat(facility.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        editMapRef.current.setView([lat, lng], 14);
      }
    }
  }, [editShiftForm.shelter_facility_id, facilities]);

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

  // Synchronize manual inputs with Edit Shift Map Marker and Circle
  useEffect(() => {
    const L = (window as any).L;
    if (!editMapRef.current || !L) return;

    const lat = parseFloat(editShiftForm.latitude);
    const lng = parseFloat(editShiftForm.longitude);
    const radius = parseFloat(editShiftForm.allowed_radius_meters) || 500;

    const hasValidCoords = !isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180;

    if (hasValidCoords) {
      if (editMarkerRef.current) {
        editMarkerRef.current.setLatLng([lat, lng]);
      } else {
        editMarkerRef.current = L.marker([lat, lng], { icon: customMarkerIcon() }).addTo(editMapRef.current);
      }

      if (editCircleRef.current) {
        editCircleRef.current.setLatLng([lat, lng]);
        editCircleRef.current.setRadius(radius);
      } else {
        editCircleRef.current = L.circle([lat, lng], {
          color: "#1E3A8A",
          fillColor: "#93C5FD",
          fillOpacity: 0.4,
          radius: radius,
        }).addTo(editMapRef.current);
      }

      if (String(editShiftForm.latitude).length > 7 && String(editShiftForm.longitude).length > 7) {
        editMapRef.current.setView([lat, lng]);
      }
    } else {
      if (editMarkerRef.current) {
        editMarkerRef.current.remove();
        editMarkerRef.current = null;
      }
      if (editCircleRef.current) {
        editCircleRef.current.remove();
        editCircleRef.current = null;
      }
    }
  }, [editShiftForm.latitude, editShiftForm.longitude, editShiftForm.allowed_radius_meters]);

  // Handle Map Search Location geocoding via Nominatim OSM
  const handleSearchLocation = async (query: string, isEditMode: boolean) => {
    if (!query.trim()) return;

    const map = isEditMode ? editMapRef.current : createMapRef.current;
    if (!map) {
      addToast("Map is not initialized yet.", "error");
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            "User-Agent": "PawGuardAdminPortal/1.0 (contact@pawguard.org)"
          }
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
            // Use custom icon in distinct red color to separate from pinned location marker
            const tempIcon = customMarkerIcon("#DC2626");
            
            if (isEditMode) {
              if (editTempMarkerRef.current) {
                editTempMarkerRef.current.setLatLng([lat, lon]);
              } else {
                editTempMarkerRef.current = L.marker([lat, lon], { icon: tempIcon }).addTo(map);
              }
              editTempMarkerRef.current.bindPopup("Searched location. Click map near here to set final GPS point.").openPopup();
            } else {
              if (createTempMarkerRef.current) {
                createTempMarkerRef.current.setLatLng([lat, lon]);
              } else {
                createTempMarkerRef.current = L.marker([lat, lon], { icon: tempIcon }).addTo(map);
              }
              createTempMarkerRef.current.bindPopup("Searched location. Click map near here to set final GPS point.").openPopup();
            }
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

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [volRes, shiftRes, facRes, statRes, dashRes] = await Promise.allSettled([
        volunteerService.getVolunteers({ page_size: 500 }),
        volunteerService.getShifts({ page_size: 500 }),
        shelterService.getShelters({ page_size: 50 }),
        volunteerService.getVolunteerStats(),
        dashboardService.getVolunteerDashboard().catch(() => null),
      ]);

      const volList = volRes.status === "fulfilled"
        ? (Array.isArray(volRes.value) ? volRes.value : volRes.value?.data || volRes.value?.items || [])
        : [];
      const shiftList = shiftRes.status === "fulfilled"
        ? (Array.isArray(shiftRes.value) ? shiftRes.value : shiftRes.value?.data || shiftRes.value?.items || [])
        : [];
      const facList = facRes.status === "fulfilled"
        ? (Array.isArray(facRes.value) ? facRes.value : facRes.value?.data || [])
        : [];
      let statObj = statRes.status === "fulfilled" ? statRes.value?.data || statRes.value || {} : {};
      if (dashRes.status === "fulfilled" && dashRes.value) {
        const dashData = dashRes.value?.data || dashRes.value;
        statObj = { ...statObj, ...dashData };
      }

      setVolunteers(volList);
      setShifts(shiftList);
      setFacilities(facList);
      setStats(statObj);

      // Fetch attendance streams across shifts
      if (shiftList.length > 0) {
        const attPromises = shiftList.slice(0, 15).map((s: any) =>
          volunteerService.getShiftAttendance(s.id).catch(() => [])
        );
        const attResults = await Promise.allSettled(attPromises);
        const combinedAtt: any[] = [];
        attResults.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            const list = Array.isArray(res.value) ? res.value : (res.value as any)?.data || [];
            list.forEach((item: any) => {
              combinedAtt.push({ ...item, shift: shiftList[idx] });
            });
          }
        });
        setAllAttendance(combinedAtt);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load volunteer coordinator data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useDataSync(fetchDashboardData);

  // Handle Application Submit
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.full_name || !applyForm.email || !applyForm.phone) {
      addToast("Full Name, Email, and Phone are required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await volunteerService.applyVolunteer({
        full_name: applyForm.full_name,
        email: applyForm.email,
        phone: applyForm.phone,
        preferred_role: applyForm.preferred_role,
        availability: applyForm.availability,
        emergency_contact_name: applyForm.emergency_contact_name || applyForm.full_name,
        emergency_contact_phone: applyForm.emergency_contact_phone || applyForm.phone,
        skills: applyForm.skills,
        notes: applyForm.notes,
      });
      addToast("Volunteer application submitted successfully!", "success");
      setIsApplyModalOpen(false);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to submit application.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Application Review Approval
  const handleApproveApplication = async (applicant: any) => {
    if (!applicant?.id) return;
    try {
      setIsSubmitting(true);
      const assignedRole = reviewRole || applicant.preferred_role || applicant.skills || "Shelter Support";
      await volunteerService.updateVolunteerProfile(applicant.id, {
        status: "onboarded",
        background_check_completed: true,
        background_check_notes: `Completed during volunteer onboarding. Role: ${assignedRole}`,
        notes: `Approved for role: ${assignedRole}`,
      });

      const messageBody = customMessage.trim() || DEFAULT_APPROVAL_MSG;

      await notificationService.sendBroadcastNotification({
        title: "Volunteer Application Approved!",
        message: messageBody,
        type: "volunteer_update",
        targetRoles: ["volunteer"],
        actionUrl: "/volunteer-dashboard",
      }).catch(() => {});

      addToast(`Application for ${applicant.user?.full_name || applicant.full_name || "Volunteer"} approved as ${assignedRole}!`, "success");
      setIsReviewModalOpen(false);
      setSelectedApplicant(null);
      setCustomMessage("");
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to approve application.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Application Review Rejection
  const handleRejectApplication = async (applicant: any) => {
    if (!applicant?.id) return;
    const reasonText = customMessage.trim() || DEFAULT_REJECTION_MSG;
    try {
      setIsSubmitting(true);
      try {
        await volunteerService.rejectApplication(applicant.id, reasonText);
      } catch {
        await volunteerService.updateVolunteerProfile(applicant.id, {
          status: "rejected",
          notes: `Rejected: ${reasonText}`,
        });
      }

      await notificationService.sendBroadcastNotification({
        title: "Volunteer Application Status Update",
        message: reasonText,
        type: "volunteer_update",
        targetRoles: ["volunteer"],
        actionUrl: "/volunteer-dashboard",
      }).catch(() => {});

      addToast(`Application for ${applicant.user?.full_name || applicant.full_name || "Volunteer"} rejected.`, "info");
      setIsReviewModalOpen(false);
      setSelectedApplicant(null);
      setCustomMessage("");
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to reject application.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Shift
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
          : (createdShift?.id || createdShift?.data?.id || (createdShift?.data as any)?.data?.id);
        if (shiftId) {
          await volunteerService.joinShift(shiftId, shiftForm.assigned_volunteer_id).catch(() => {});
        }
      }

      await notificationService.sendBroadcastNotification({
        title: `New Volunteer Shift: ${finalRoleName}`,
        message: `A new volunteer shift for ${finalRoleName} has been scheduled. Sign up in your volunteer portal!`,
        type: "volunteer_shift",
        targetRoles: ["volunteer"],
        actionUrl: "/volunteer-dashboard",
      }).catch(() => {});

      addToast("Volunteer shift scheduled successfully!", "success");
      setIsShiftModalOpen(false);
      setShiftForm({
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
      });
      fetchDashboardData();
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

  // Handle Open Edit Shift Modal
  const handleOpenEditShiftModal = (shift: any) => {
    setSelectedShiftToEdit(shift);
    
    // Extract date and times
    let shiftDate = "";
    let shiftStart = "";
    let shiftEnd = "";
    if (shift.start_at) {
      const dObj = new Date(shift.start_at);
      shiftDate = dObj.toISOString().split("T")[0];
      shiftStart = dObj.toTimeString().split(" ")[0].slice(0, 5);
    }
    if (shift.end_at) {
      shiftEnd = new Date(shift.end_at).toTimeString().split(" ")[0].slice(0, 5);
    }

    // Try to extract role name (without prefRole parenthesis suffix)
    let baseRoleName = shift.role_name || shift.title || "";
    let prefRole = "Shelter Support";
    PREFERRED_ROLES.forEach((r) => {
      if (baseRoleName.includes(`(${r})`)) {
        baseRoleName = baseRoleName.replace(`(${r})`, "").trim();
        prefRole = r;
      }
    });

    setEditShiftForm({
      id: shift.id || "",
      role_name: baseRoleName,
      preferred_role: prefRole,
      date: shiftDate,
      start_time: shiftStart,
      end_time: shiftEnd,
      shelter_facility_id: shift.shelter_facility_id || "",
      notes: shift.notes || "",
      capacity: Number(shift.capacity || 5),
      location_name: shift.location_name || "",
      latitude: shift.latitude !== undefined && shift.latitude !== null ? String(shift.latitude) : "",
      longitude: shift.longitude !== undefined && shift.longitude !== null ? String(shift.longitude) : "",
      allowed_radius_meters: shift.allowed_radius_meters !== undefined && shift.allowed_radius_meters !== null ? String(shift.allowed_radius_meters) : "",
    });
    setIsEditShiftModalOpen(true);
  };

  // Handle Edit Shift Submit
  const handleEditShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShiftForm.id || !editShiftForm.role_name || !editShiftForm.date || !editShiftForm.start_time || !editShiftForm.end_time) {
      addToast("Shift ID, role name, date, start time, and end time are required.", "error");
      return;
    }
    if (editShiftForm.start_time >= editShiftForm.end_time) {
      addToast("End time must be after start time.", "error");
      return;
    }

    let latNum: number | null = null;
    let lonNum: number | null = null;
    let radNum: number | null = null;

    if (String(editShiftForm.latitude || "").trim()) {
      latNum = parseFloat(String(editShiftForm.latitude));
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        addToast("Latitude must be a valid number between -90 and 90.", "error");
        return;
      }
    }
    if (String(editShiftForm.longitude || "").trim()) {
      lonNum = parseFloat(String(editShiftForm.longitude));
      if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        addToast("Longitude must be a valid number between -180 and 180.", "error");
        return;
      }
    }
    if (String(editShiftForm.allowed_radius_meters || "").trim()) {
      radNum = parseInt(String(editShiftForm.allowed_radius_meters), 10);
      if (isNaN(radNum) || radNum <= 0) {
        addToast("Allowed radius must be a positive number greater than 0.", "error");
        return;
      }
    }

    if ((latNum !== null || lonNum !== null) && !String(editShiftForm.location_name || "").trim()) {
      addToast("Location Name is required when configuring GPS coordinates.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const startIso = new Date(`${editShiftForm.date}T${editShiftForm.start_time}:00`).toISOString();
      const endIso = new Date(`${editShiftForm.date}T${editShiftForm.end_time}:00`).toISOString();

      let finalRoleName = editShiftForm.role_name.trim();
      const selectedRole = editShiftForm.preferred_role;
      if (selectedRole && !finalRoleName.toLowerCase().includes(selectedRole.toLowerCase())) {
        finalRoleName = `${finalRoleName} (${selectedRole})`;
      }

      await volunteerService.updateShift(editShiftForm.id, {
        role_name: finalRoleName,
        shelter_facility_id: editShiftForm.shelter_facility_id || null,
        start_at: startIso,
        end_at: endIso,
        capacity: Number(editShiftForm.capacity || 5),
        notes: editShiftForm.notes,
        location_name: String(editShiftForm.location_name || "").trim() || null,
        latitude: latNum,
        longitude: lonNum,
        allowed_radius_meters: radNum,
      });

      addToast("Volunteer shift updated successfully!", "success");
      setIsEditShiftModalOpen(false);
      setSelectedShiftToEdit(null);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to update shift.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Assign Modal
  const handleOpenAssignModal = (shift: any) => {
    setSelectedShiftToAssign(shift);
    if (approvedVolunteers.length > 0) {
      setSelectedAssignVolunteerId(String(approvedVolunteers[0].id));
    } else {
      setSelectedAssignVolunteerId("");
    }
    setIsAssignModalOpen(true);
  };

  // Handle Confirm Assign Volunteer to Shift
  const handleConfirmAssignVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftToAssign || !selectedAssignVolunteerId) {
      addToast("Shift and Volunteer selection are required.", "error");
      return;
    }

    // Capacity Check
    const enrolledCount = allAttendance.filter(
      (a) => a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id
    ).length;
    const capacity = Number(selectedShiftToAssign.capacity || 5);
    if (enrolledCount >= capacity) {
      addToast(`Cannot assign volunteer: Shift capacity is full (${enrolledCount}/${capacity} enrolled).`, "error");
      return;
    }

    // Duplicate Enrollment Check
    const isAlreadyEnrolled = allAttendance.some(
      (a) =>
        (a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id) &&
        (String(a.volunteer_id) === String(selectedAssignVolunteerId) ||
          String(a.volunteer_profile_id) === String(selectedAssignVolunteerId) ||
          String(a.volunteer?.id) === String(selectedAssignVolunteerId))
    );
    if (isAlreadyEnrolled) {
      addToast("Selected volunteer is already enrolled in this shift.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await volunteerService.joinShift(selectedShiftToAssign.id, selectedAssignVolunteerId);

      const volObj = volunteers.find((v) => String(v.id) === String(selectedAssignVolunteerId));
      const volName = volObj?.user?.full_name || volObj?.full_name || "Volunteer";

      addToast(`Successfully assigned ${volName} to shift: ${selectedShiftToAssign.role_name || "Volunteer Shift"}!`, "success");

      await notificationService.sendBroadcastNotification({
        title: `Shift Assignment: ${selectedShiftToAssign.role_name || "Volunteer Shift"}`,
        message: `You have been assigned to ${selectedShiftToAssign.role_name || "a shift"}. Check your volunteer dashboard schedule!`,
        type: "volunteer_shift",
        targetRoles: ["volunteer"],
        actionUrl: "/volunteer-dashboard",
      }).catch(() => {});

      setIsAssignModalOpen(false);
      setSelectedShiftToAssign(null);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to assign volunteer to shift.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSuggestedAssignmentTitle = (role?: string) => {
    const r = String(role || "").toLowerCase();
    if (r.includes("foster")) return "Foster Home Visit Support";
    if (r.includes("transport")) return "Animal Rescue & Vet Transport";
    if (r.includes("events") || r.includes("outreach")) return "Adoption Event Assistance";
    if (r.includes("shelter")) return "Shelter Habitat Maintenance & Feeding";
    return "Volunteer Work Task";
  };

  // Handle Open Assign Work Modal for specific volunteer
  const handleOpenAssignWorkModal = (vol: any) => {
    const volId = String(vol?.id || vol?._id || "");
    const volStatus = String(vol?.status || "").toLowerCase();
    if (volStatus === "applied") {
      addToast("Cannot assign work: Volunteer application is pending approval.", "error");
      return;
    }

    const volRole = vol?.preferred_role || vol?.skills || "Shelter Support";
    const suggestedTitle = getSuggestedAssignmentTitle(volRole);

    setAssignWorkForm({
      volunteer_id: volId,
      role_name: suggestedTitle,
      notes: "",
      shelter_facility_id: facilities[0]?.id || "",
      assignment_date: new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "13:00",
      priority: "Normal",
      status: "Scheduled",
    });
    setIsAssignWorkModalOpen(true);
  };

  // Handle Submit Assign Work Form
  const handleConfirmAssignWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignWorkForm.volunteer_id) {
      addToast("Volunteer selection is required.", "error");
      return;
    }
    if (!assignWorkForm.role_name || !assignWorkForm.role_name.trim()) {
      addToast("Assignment Title is required.", "error");
      return;
    }
    if (!assignWorkForm.assignment_date) {
      addToast("Assignment Date is required.", "error");
      return;
    }
    if (assignWorkForm.start_time >= assignWorkForm.end_time) {
      addToast("End Time must be after Start Time.", "error");
      return;
    }

    const volObj = volunteers.find((v) => String(v.id) === String(assignWorkForm.volunteer_id));
    const volStatus = String(volObj?.status || "").toLowerCase();
    if (volStatus === "applied") {
      addToast("Cannot assign work: Volunteer must be onboarded or active.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const startIso = new Date(`${assignWorkForm.assignment_date}T${assignWorkForm.start_time}:00`).toISOString();
      const endIso = new Date(`${assignWorkForm.assignment_date}T${assignWorkForm.end_time}:00`).toISOString();

      const createdShift = await volunteerService.createShift({
        role_name: assignWorkForm.role_name.trim(),
        shelter_facility_id: assignWorkForm.shelter_facility_id || null,
        start_at: startIso,
        end_at: endIso,
        capacity: 5,
      });

      const shiftId = volunteerService.extractShiftId ? volunteerService.extractShiftId(createdShift) : (createdShift?.id || createdShift?.data?.id || (createdShift?.data as any)?.data?.id);
      if (!shiftId) {
        throw new Error("Failed to retrieve valid shift ID from server response.");
      }

      try {
        await volunteerService.joinShift(shiftId, assignWorkForm.volunteer_id);
      } catch (joinErr: any) {
        const joinMsg = joinErr?.response?.data?.detail || joinErr?.response?.data?.message || joinErr?.message || "Failed to assign volunteer to shift.";
        addToast(`Work shift created, but volunteer assignment failed: ${joinMsg}`, "error");
        fetchDashboardData();
        return;
      }

      const volName = volObj?.user?.full_name || volObj?.full_name || volObj?.emergency_contact_name || "Volunteer";

      addToast(`Successfully assigned "${assignWorkForm.role_name}" to ${volName}!`, "success");

      await notificationService.sendBroadcastNotification({
        title: `New Work Assignment: ${assignWorkForm.role_name}`,
        message: `You have been assigned to ${assignWorkForm.role_name}. Check your schedule!`,
        type: "volunteer_shift",
        targetRoles: ["volunteer"],
        actionUrl: "/volunteer-dashboard",
      }).catch(() => {});

      setIsAssignWorkModalOpen(false);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to assign work to volunteer.";
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Volunteer Profile Details Modal
  const handleOpenProfileModal = async (vol: any) => {
    setSelectedVolunteerRecord(vol);
    setIsProfileModalOpen(true);
    try {
      const summary = await volunteerService.getServiceSummary(vol.id).catch(() => null);
      setVolunteerSummary(summary);
    } catch {
      setVolunteerSummary(null);
    }
  };

  // Handle Shift Attendance Drawer
  const handleOpenAttendance = async (shift: any) => {
    setSelectedShift(shift);
    setIsAttendanceModalOpen(true);
    try {
      setAttLoading(true);
      const res = await volunteerService.getShiftAttendance(shift.id);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setAttendanceList(list);
    } catch {
      setAttendanceList([]);
    } finally {
      setAttLoading(false);
    }
  };

  const handleCheckIn = async (attendanceId: string) => {
    try {
      await volunteerService.checkInAttendance(attendanceId);
      addToast("Volunteer checked in successfully!", "success");
      if (selectedShift?.id) void handleOpenAttendance(selectedShift);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Check-in failed.", "error");
    }
  };

  const handleCheckOut = async (attendanceId: string) => {
    try {
      await volunteerService.checkOutAttendance(attendanceId, "Shift completed successfully");
      addToast("Volunteer checked out successfully!", "success");
      if (selectedShift?.id) void handleOpenAttendance(selectedShift);
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Check-out failed.", "error");
    }
  };

  const isVolunteerEligibleForCertificate = useCallback((vol: any) => {
    if (!vol) return false;
    const volProfileId = String(vol.id || "").trim();
    const volUserId = String(vol.user_id || vol.user?.id || "").trim();

    const hours = Number(vol.total_hours || vol.hours_served || 0);
    const shifts = Number(vol.completed_shifts || vol.shifts_completed || 0);
    if (hours > 0 || shifts > 0) return true;

    const volAttendance = allAttendance.filter((a: any) => {
      const attVolId = String(a.volunteer_id || a.volunteer?.id || "").trim();
      const attProfileId = String(a.volunteer_profile_id || a.volunteer?.profile_id || "").trim();
      const attUserId = String(a.user_id || a.user?.id || a.volunteer?.user_id || "").trim();

      const matchesProfile = Boolean(volProfileId && (attVolId === volProfileId || attProfileId === volProfileId));
      const matchesUser = Boolean(volUserId && (attVolId === volUserId || attUserId === volUserId));
      return matchesProfile || matchesUser;
    });

    const completedLogs = volAttendance.filter((a: any) => Boolean(a.check_out_at));
    const totalHours = completedLogs.reduce((acc, curr) => acc + (Number(curr.hours_served) || 0), 0);
    return completedLogs.length > 0 || totalHours > 0;
  }, [allAttendance]);

  const handleIssueCertificate = async (profileId: string, volunteerRecord?: any) => {
    if (!profileId) {
      addToast("Invalid volunteer profile ID.", "error");
      return;
    }

    const vol = volunteerRecord || volunteers.find((v: any) => String(v.id) === String(profileId));
    if (vol && !isVolunteerEligibleForCertificate(vol)) {
      addToast("Volunteer must have at least 1 completed shift or logged service hours to issue a certificate.", "info");
      return;
    }

    try {
      addToast("Generating verified service certificate...", "info");
      const cert = await volunteerService.getCertificate(profileId);

      setIssuedCertificates((prev) => ({ ...prev, [profileId]: true }));

      const certUrl =
        cert?.certificate_url ||
        cert?.download_url ||
        cert?.url ||
        cert?.pdf_url ||
        cert?.data?.certificate_url ||
        cert?.data?.download_url ||
        cert?.data?.url;

      if (certUrl) {
        window.open(certUrl, "_blank");
        addToast("Service Certificate opened in a new tab.", "success");
        return;
      }

      const htmlContent = cert?.certificate_html || cert?.html || cert?.content;
      const base64Pdf = cert?.pdf_base64 || cert?.base64;

      if (base64Pdf) {
        const blob = new Blob([Uint8Array.from(atob(base64Pdf), (c) => c.charCodeAt(0))], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        addToast("Service Certificate generated successfully!", "success");
        return;
      }

      if (htmlContent) {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        addToast("Service Certificate generated & opened.", "success");
        return;
      }

      if (cert instanceof Blob) {
        const blobUrl = URL.createObjectURL(cert);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `volunteer_certificate_${String(profileId).slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addToast("Service Certificate downloaded successfully!", "success");
        return;
      }

      addToast("Service Certificate generated successfully!", "success");
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to issue certificate.";

      addToast(errorMsg, "error");
    }
  };

  // Export Reports
  const handleExportReports = async (format: "csv" | "pdf") => {
    try {
      addToast(`Exporting Volunteer Activity Report (${format.toUpperCase()})...`, "info");
      await reportsService.generateAndDownloadReport({
        report_type: "volunteer",
        format,
        period_start: dateStart || undefined,
        period_end: dateEnd || undefined,
      });
      addToast(`Volunteer Activity Report exported successfully as ${format.toUpperCase()}!`, "success");
    } catch (err: any) {
      // Fallback CSV generator if backend report type endpoint is not present
      if (format === "csv") {
        try {
          const csvRows = [
            ["Volunteer ID", "Shift Role", "Check-In", "Check-Out", "Hours Served", "Status"].join(","),
            ...allAttendance.map((a) =>
              [
                `"${a.volunteer_id || a.id || ""}"`,
                `"${a.shift?.role_name || a.role_name || "Volunteer Work"}"`,
                `"${a.check_in_at ? formatDateTime(a.check_in_at) : "Pending"}"`,
                `"${a.check_out_at ? formatDateTime(a.check_out_at) : "In Progress"}"`,
                `"${a.hours_served || 0}"`,
                `"${a.check_out_at ? "Completed" : a.check_in_at ? "In Progress" : "Scheduled"}"`,
              ].join(",")
            ),
          ].join("\n");

          const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `PawGuard_Volunteer_Activity_Report_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          addToast("Volunteer Activity CSV Report exported successfully!", "success");
          return;
        } catch {
          // ignore
        }
      }
      addToast(err?.message || "Failed to export volunteer report.", "error");
    }
  };

  // Lists & Derived States
  const pendingApplications = useMemo(() =>
    volunteers.filter((v) => {
      const s = String(v.status || "applied").toLowerCase();
      if (s !== "applied" && s !== "pending" && s !== "submitted") return false;
      if (roleFilter) {
        const role = String(v.preferred_role || v.skills || "").toLowerCase();
        if (!role.includes(roleFilter.toLowerCase())) return false;
      }
      return true;
    }),
    [volunteers, roleFilter]
  );

  const approvedVolunteers = useMemo(() =>
    volunteers.filter((v) => ["onboarded", "active"].includes(String(v.status || "").toLowerCase())),
    [volunteers]
  );

  const filteredRoster = useMemo(() =>
    volunteers.filter((v) => {
      const s = String(v.status || "applied").toLowerCase();
      const matchesStatus = !statusFilter || s === statusFilter.toLowerCase();
      const role = String(v.preferred_role || v.skills || "").toLowerCase();
      const matchesRole = !roleFilter || role.includes(roleFilter.toLowerCase());
      const name = String(v.user?.full_name || v.full_name || v.emergency_contact_name || "").toLowerCase();
      const email = String(v.user?.email || v.email || "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || role.includes(q);
      return matchesStatus && matchesRole && matchesSearch;
    }),
    [volunteers, statusFilter, roleFilter, searchQuery]
  );

  const completedWorkList = useMemo(() =>
    allAttendance.filter((a) => Boolean(a.check_out_at)),
    [allAttendance]
  );

  // Performance calculations
  const totalShiftCount = shifts.length;
  const totalAttendanceCount = allAttendance.length;
  const totalCompletedCount = completedWorkList.length;
  const totalHoursSum = useMemo(() =>
    completedWorkList.reduce((acc, curr) => acc + (Number(curr.hours_served) || 0), 0),
    [completedWorkList]
  );
  const completionRate = totalAttendanceCount > 0 ? Math.round((totalCompletedCount / totalAttendanceCount) * 100) : 100;



  const pipelineColumns = [
    {
      key: "name",
      header: "Applicant Name & Contact",
      render: (_: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>
            {r.user?.full_name || r.full_name || r.emergency_contact_name || "Volunteer Applicant"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            {r.user?.email || r.email || "No email"} &bull; {r.user?.phone || r.phone || r.emergency_contact_phone || "No phone"}
          </div>
        </div>
      ),
    },
    {
      key: "preferred_role",
      header: "Preferred Role",
      render: (_: string, r: any) => {
        const role = r.preferred_role || r.skills || "Shelter Support";
        return (
          <span style={{ padding: "4px 10px", borderRadius: "999px", background: "#EFF6FF", color: "#1E3A8A", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
            {role}
          </span>
        );
      },
    },
    {
      key: "availability",
      header: "Availability",
      render: (v: string) => <span style={{ fontWeight: 600, color: "#334155" }}>{v || "Weekends & Mornings"}</span>,
    },
    {
      key: "skills",
      header: "Skills / Experience",
      render: (v: string) => <span style={{ fontSize: "12px", color: "#475569" }}>{v || "No skills specified"}</span>,
    },
    {
      key: "created_at",
      header: "Applied Date",
      render: (v: string) => (v ? formatDateTime(v) : "Recent"),
    },
    {
      key: "status",
      header: "Status",
      render: (v: string) => {
        const s = String(v || "applied").toLowerCase();
        return (
          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: "#FEF3C7", color: "#D97706", textTransform: "uppercase" }}>
            {s}
          </span>
        );
      },
    },
  ];

  const rosterColumns = [
    {
      key: "name",
      header: "Volunteer Name & Contact",
      render: (_: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>
            {r.user?.full_name || r.full_name || r.emergency_contact_name || "Volunteer Record"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            {r.user?.email || r.email || `ID: ${String(r.id).slice(0, 8)}`}
          </div>
        </div>
      ),
    },
    {
      key: "preferred_role",
      header: "Preferred Role / Skill",
      render: (_: string, r: any) => (
        <span style={{ fontWeight: 700, color: "#1E3A8A" }}>
          {r.preferred_role || r.skills || "General Support"}
        </span>
      ),
    },
    {
      key: "availability",
      header: "Availability",
      render: (v: string) => <span style={{ color: "#475569" }}>{v || "Flexible"}</span>,
    },
    {
      key: "skills",
      header: "Skills / Experience",
      render: (v: string) => <span style={{ fontSize: "12px", color: "#475569" }}>{v || "None specified"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (v: string) => {
        const s = String(v || "applied").toLowerCase();
        const color = s === "active" ? "#15803D" : s === "onboarded" ? "#1E3A8A" : s === "applied" ? "#D97706" : "#DC2626";
        const bg = s === "active" ? "#ECFDF5" : s === "onboarded" ? "#EFF6FF" : s === "applied" ? "#FEF3C7" : "#FEE2E2";
        return (
          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: bg, color, textTransform: "uppercase" }}>
            {s}
          </span>
        );
      },
    },
  ];

  const shiftColumns = [
    {
      key: "role_name",
      header: "Work / Shift Title",
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{v || r.title || "Volunteer Shift"}</div>
          {r.notes && <div style={{ fontSize: "11px", color: "#64748B", fontStyle: "italic", marginTop: "2px" }}>Instr: {r.notes}</div>}
        </div>
      ),
    },
    {
      key: "preferred_role",
      header: "Volunteer Type",
      render: (_: any, r: any) => {
        const titleLower = String(r.role_name || r.title || "").toLowerCase();
        let type = "General Support";
        if (titleLower.includes("foster")) type = "Foster Care";
        else if (titleLower.includes("transport")) type = "Transport";
        else if (titleLower.includes("shelter")) type = "Shelter Support";
        else if (titleLower.includes("event") || titleLower.includes("outreach")) type = "Events & Outreach";
        return (
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1E3A8A" }}>
            {type}
          </span>
        );
      },
    },
    {
      key: "volunteer",
      header: "Claimed By",
      render: (_: any, r: any) => {
        const enrollments = allAttendance.filter((a) => a.shift_id === r.id || a.shift?.id === r.id);
        if (enrollments.length === 0) {
          return <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Unclaimed</span>;
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {enrollments.map((e: any, idx: number) => {
              const vol = volunteers.find((v) => String(v.id) === String(e.volunteer_id));
              const name = vol?.user?.full_name || vol?.full_name || `Vol ${String(e.volunteer_id).slice(0, 5)}`;
              return (
                <div key={idx} style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  ✓ {name}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "start_at",
      header: "Date & Time",
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatDateTime(r.start_at).split(" ")[0]}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            {formatDateTime(r.start_at).split(" ").slice(1).join(" ")} — {formatDateTime(r.end_at).split(" ").slice(1).join(" ")}
          </div>
        </div>
      ),
    },
    {
      key: "shelter_facility_id",
      header: "Location",
      render: (v: string, r: any) => {
        const facility = facilities.find((f) => String(f.id) === String(v));
        const facilityName = facility?.name || r.location || "Central Shelter";
        if (r.location_name) {
          const lat = r.latitude !== null && r.latitude !== undefined ? ` (${r.latitude}, ${r.longitude})` : "";
          const rad = r.allowed_radius_meters !== null && r.allowed_radius_meters !== undefined ? ` - Radius: ${r.allowed_radius_meters}m` : "";
          return (
            <div>
              <div style={{ fontWeight: 600, color: "#0F172A" }}>{r.location_name}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>
                {facilityName}{lat}{rad}
              </div>
            </div>
          );
        }
        return <span>{facilityName}</span>;
      },
    },
    {
      key: "capacity",
      header: "Slots & Status",
      render: (_: number, r: any) => {
        const enrollments = allAttendance.filter((a) => a.shift_id === r.id || a.shift?.id === r.id);
        const enrolled = enrollments.length;
        const cap = Number(r.capacity ?? 5);
        
        let status = "Available";
        let color = "#1E3A8A";
        let bg = "#EFF6FF";

        if (enrollments.every(e => e.check_out_at && e.check_in_at)) {
          status = "Completed";
          color = "#16A34A";
          bg = "#ECFDF5";
        } else if (enrollments.some(e => e.check_in_at && !e.check_out_at)) {
          status = "In Progress";
          color = "#1E3A8A";
          bg = "#F5F3FF";
        } else if (enrolled >= cap) {
          status = "Claimed (Full)";
          color = "#D97706";
          bg = "#FEF3C7";
        } else if (enrolled > 0) {
          status = "Claimed";
          color = "#1E3A8A";
          bg = "#EEF2FF";
        }

        if (r.status === "Cancelled") {
          status = "Cancelled";
          color = "#DC2626";
          bg = "#FEF2F2";
        }

        return (
          <div>
            <div style={{ fontWeight: 600 }}>{enrolled} / {cap} Slots</div>
            <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: bg, color, marginTop: "4px", display: "inline-block" }}>
              {status}
            </span>
          </div>
        );
      },
    },
  ];

  const attendanceColumns = [
    {
      key: "volunteer_id",
      header: "Volunteer",
      render: (v: string) => {
        const vol = volunteers.find((x) => String(x.id) === String(v));
        const name = vol?.user?.full_name || vol?.full_name || `Volunteer ${String(v).slice(0, 8)}`;
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{name}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>ID: {String(v).slice(0, 8)}</div>
          </div>
        );
      },
    },
    {
      key: "shift",
      header: "Shift / Work",
      render: (v: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700 }}>{v?.role_name || r.role_name || "Volunteer Shift"}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>ID: {String(r.id).slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (_: any, r: any) => {
        const start = r.shift?.start_at || r.start_at;
        return <span>{start ? formatDateTime(start).split(" ")[0] : "-"}</span>;
      },
    },
    {
      key: "check_in_at",
      header: "Check-In Time",
      render: (v: string) => (v ? formatDateTime(v) : "⏳ Not checked in"),
    },
    {
      key: "check_out_at",
      header: "Check-Out Time",
      render: (v: string) => (v ? formatDateTime(v) : "⏳ Not checked out"),
    },
    {
      key: "status",
      header: "Attendance Status",
      render: (_: any, r: any) => {
        const checkedIn = Boolean(r.check_in_at);
        const checkedOut = Boolean(r.check_out_at);
        
        let status = "Scheduled";
        let color = "#475569";
        let bg = "#F1F5F9";

        if (checkedOut) {
          status = "Completed";
          color = "#15803D";
          bg = "#ECFDF5";
        } else if (checkedIn) {
          status = "In Progress";
          color = "#1E3A8A";
          bg = "#EFF6FF";
        }

        return (
          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: bg, color, textTransform: "uppercase" }}>
            {status}
          </span>
        );
      },
    },
    {
      key: "hours_served",
      header: "Hours Served",
      render: (v: number) => <strong style={{ color: "#1E3A8A" }}>{v || 0} Hours</strong>,
    },
  ];

  const completedColumns = [
    {
      key: "volunteer_id",
      header: "Volunteer",
      render: (v: string) => {
        const vol = volunteers.find((x) => String(x.id) === String(v));
        const name = vol?.user?.full_name || vol?.full_name || `Volunteer ${String(v).slice(0, 8)}`;
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{name}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>ID: {String(v).slice(0, 8)}</div>
          </div>
        );
      },
    },
    {
      key: "preferred_role",
      header: "Volunteer Type",
      render: (_: any, r: any) => {
        const vol = volunteers.find((x) => String(x.id) === String(r.volunteer_id));
        const type = vol?.preferred_role || vol?.skills || "General Support";
        return (
          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: "#F5F3FF", color: "#1E3A8A", textTransform: "uppercase" }}>
            {type}
          </span>
        );
      },
    },
    {
      key: "shift",
      header: "Work / Shift",
      render: (v: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700 }}>{v?.role_name || r.role_name || "Volunteer Shift"}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>ID: {String(r.id).slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "completed_at",
      header: "Completion Date",
      render: (_: any, r: any) => formatDateTime(r.check_out_at || r.updated_at || r.created_at).split(" ")[0],
    },
    {
      key: "status",
      header: "Completion Status",
      render: () => (
        <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: "#ECFDF5", color: "#15803D", textTransform: "uppercase" }}>
          Completed
        </span>
      ),
    },
    {
      key: "hours_served",
      header: "Hours Contributed",
      render: (v: number) => <strong style={{ color: "#16A34A" }}>{v || 0} Hours</strong>,
    },
    {
      key: "notes",
      header: "Notes / Details",
      render: (v: string) => <span style={{ fontSize: "12px", color: "#475569" }}>{v || "No notes logged"}</span>,
    },
  ];

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {/* Dashboard Header */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>
              Volunteer Coordinator Dashboard
            </h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
              Overview of volunteer applications, assignments, schedules, attendance, and work completion tracking.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: "none",
                background: "#16A34A",
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaCalendarAlt size={12} /> Schedule Shift
            </button>

            <button
              type="button"
              onClick={() => void handleExportReports("csv")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaFileDownload size={12} /> Export Report CSV
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* TABBED OPERATIONAL WORKSPACE */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        {/* Navigation Tabs */}
        <div style={{ borderBottom: "2px solid #E2E8F0", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "overview" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "overview" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "overview" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaChartBar /> Overview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pipeline")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "pipeline" ? "2px solid #F59E0B" : "1px solid #CBD5E1",
                background: activeTab === "pipeline" ? "#FFFBEB" : "#FFFFFF",
                color: activeTab === "pipeline" ? "#B45309" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaClipboardList /> Applications ({pendingApplications.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "roster" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "roster" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "roster" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaUsers /> Roster ({approvedVolunteers.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("schedules")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "schedules" ? "2px solid #16A34A" : "1px solid #CBD5E1",
                background: activeTab === "schedules" ? "#ECFDF5" : "#FFFFFF",
                color: activeTab === "schedules" ? "#15803D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaCalendarAlt /> Shift Schedules ({shifts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "attendance" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "attendance" ? "#EEF2FF" : "#FFFFFF",
                color: activeTab === "attendance" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaClock /> Attendance Log ({allAttendance.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "completed" ? "2px solid #15803D" : "1px solid #CBD5E1",
                background: activeTab === "completed" ? "#D1FAE5" : "#FFFFFF",
                color: activeTab === "completed" ? "#15803D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaCheckDouble /> Completed Work ({completedWorkList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("performance_reports")}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: activeTab === "performance_reports" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "performance_reports" ? "#FCE7F3" : "#FFFFFF",
                color: activeTab === "performance_reports" ? "#BE185D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaChartBar /> Performance &amp; Reports
            </button>
          </div>
        </div>

        {/* TAB 0: OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Volunteer Operations Overview
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <StatCard
                title="Total Volunteers"
                value={loading ? "..." : String(volunteers.length)}
                trend="All registered profiles"
                color="#1E3A8A"
                icon={<FaUsers />}
                onClick={() => setActiveTab("roster")}
              />
              <StatCard
                title="Pending Applications"
                value={loading ? "..." : String(pendingApplications.length)}
                trend="Awaiting review"
                color="#F59E0B"
                icon={<FaClipboardList />}
                onClick={() => setActiveTab("pipeline")}
              />
              <StatCard
                title="Active Volunteers"
                value={loading ? "..." : String(approvedVolunteers.length)}
                trend="Onboarded &amp; active"
                color="#16A34A"
                icon={<FaUserCheck />}
                onClick={() => setActiveTab("roster")}
              />
              <StatCard
                title="Scheduled Shifts"
                value={loading ? "..." : String(shifts.length)}
                trend="Total calendar shifts"
                color="#1E3A8A"
                icon={<FaCalendarAlt />}
                onClick={() => setActiveTab("schedules")}
              />
              <StatCard
                title="Attendance Logs"
                value={loading ? "..." : String(allAttendance.length)}
                trend="Active stream logs"
                color="#1E3A8A"
                icon={<FaClock />}
                onClick={() => setActiveTab("attendance")}
              />
              <StatCard
                title="Completed Work"
                value={loading ? "..." : String(completedWorkList.length)}
                trend="Successfully completed"
                color="#1E3A8A"
                icon={<FaCheckDouble />}
                onClick={() => setActiveTab("completed")}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0F172A", fontWeight: 700 }}>Quick Actions</h4>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setIsApplyModalOpen(true)}
                    style={{ padding: "8px 12px", background: "#1E3A8A", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                  >
                    + New Application (Intake)
                  </button>
                  <button
                    onClick={() => setIsShiftModalOpen(true)}
                    style={{ padding: "8px 12px", background: "#16A34A", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                  >
                    + Schedule New Shift
                  </button>
                </div>
              </div>
              
              <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0F172A", fontWeight: 700 }}>Operations Notice</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748B", lineHeight: "1.5" }}>
                  Use the tabs above to manage the volunteer lifecycle. Ensure work assignments align with the volunteer's preferred type (Foster Care, Transport, Shelter Support, Events &amp; Outreach) to match their skills and availability.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: APPLICATIONS PIPELINE */}
        {activeTab === "pipeline" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Pending Volunteer Applications ({pendingApplications.length})
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FaFilter size={12} color="#64748B" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
                >
                  <option value="">All Volunteer Types</option>
                  {PREFERRED_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <DataTable
              columns={pipelineColumns}
              data={pendingApplications}
              loading={loading}
              emptyMessage="No pending volunteer applications awaiting review."
              onRowClick={(row: any) => void handleOpenProfileModal(row)}
              renderRowActions={(row: any) => (
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => void handleOpenProfileModal(row)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      color: "#1E3A8A",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FaEye /> Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApplicant(row);
                      setReviewRole(row.preferred_role || row.skills || "Shelter Support");
                      setCustomMessage("");
                      setIsReviewModalOpen(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#16A34A",
                      color: "#FFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FaCheckCircle /> Approve / Onboard
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRejectApplication(row)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#DC2626",
                      color: "#FFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FaTimesCircle /> Reject
                  </button>
                </div>
              )}
            />
          </div>
        )}

        {/* TAB 2: APPROVED VOLUNTEERS ROSTER */}
        {activeTab === "roster" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Volunteer Directory & Role Matching ({filteredRoster.length})
              </h3>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaFilter size={12} color="#64748B" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
                  >
                    <option value="">All Preferred Roles</option>
                    {PREFERRED_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
                  >
                    <option value="">All Application Statuses</option>
                    <option value="applied">Applied (Pending)</option>
                    <option value="onboarded">Onboarded</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div style={{ position: "relative" }}>
                  <FaSearch style={{ position: "absolute", left: "10px", top: "11px", color: "#94A3B8" }} size={12} />
                  <input
                    type="text"
                    placeholder="Search name, email, role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: "8px 12px 8px 30px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "220px" }}
                  />
                </div>
              </div>
            </div>

            <DataTable
              columns={rosterColumns}
              data={filteredRoster}
              loading={loading}
              emptyMessage="No matching volunteers found in roster."
              onRowClick={(row: any) => void handleOpenProfileModal(row)}
              renderRowActions={(row: any) => {
                const s = String(row.status || "").toLowerCase();
                return (
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => void handleOpenProfileModal(row)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#1E3A8A",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaEye /> Details
                    </button>

                    {s === "onboarded" && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await volunteerService.updateVolunteerProfile(row.id, { status: "active" });
                              addToast(`Volunteer ${row.user?.full_name || row.full_name || "Profile"} activated!`, "success");
                              fetchDashboardData();
                              notifyDataChanged();
                            } catch (err: any) {
                              const errorMsg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Failed to activate profile.";
                              addToast(errorMsg, "error");
                            }
                          }}
                          style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignWorkModal(row)}
                          style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaClipboardList /> Assign Work
                        </button>
                      </>
                    )}

                    {s === "active" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignWorkModal(row)}
                          style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaClipboardList /> Assign Work
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await volunteerService.updateVolunteerProfile(row.id, { status: "inactive" });
                              addToast(`Volunteer ${row.user?.full_name || row.full_name || "Profile"} deactivated.`, "info");
                              fetchDashboardData();
                              notifyDataChanged();
                            } catch (err: any) {
                              const errorMsg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Failed to deactivate profile.";
                              addToast(errorMsg, "error");
                            }
                          }}
                          style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Deactivate
                        </button>
                      </>
                    )}

                    {s === "inactive" && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await volunteerService.updateVolunteerProfile(row.id, { status: "active" });
                            addToast(`Volunteer ${row.user?.full_name || row.full_name || "Profile"} re-activated!`, "success");
                            fetchDashboardData();
                            notifyDataChanged();
                          } catch (err: any) {
                            const errorMsg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Failed to activate profile.";
                            addToast(errorMsg, "error");
                          }
                        }}
                        style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Re-Activate
                      </button>
                    )}

                    {(() => {
                      const isEligible = isVolunteerEligibleForCertificate(row);
                      const isIssued = Boolean(issuedCertificates[row.id]);
                      return (
                        <button
                          type="button"
                          onClick={() => void handleIssueCertificate(row.id, row)}
                          title={isEligible ? (isIssued ? "Download existing certificate" : "Issue volunteer certificate") : "Volunteer must complete verified service first"}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            border: isEligible ? "1px solid #1E3A8A" : "1px solid #CBD5E1",
                            background: isEligible ? (isIssued ? "#EEF2FF" : "#FFFFFF") : "#F8FAFC",
                            color: isEligible ? "#1E3A8A" : "#94A3B8",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: isEligible ? "pointer" : "not-allowed",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            opacity: isEligible ? 1 : 0.7
                          }}
                        >
                          <FaAward /> {isIssued ? "Download Cert" : isEligible ? "Issue Cert" : "No Service"}
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            />
          </div>
        )}

        {/* TAB 3: SHIFT SCHEDULES */}
        {activeTab === "schedules" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Active Volunteer Shift Schedules ({shifts.length})
              </h3>
            </div>
            <DataTable
              columns={shiftColumns}
              data={shifts}
              loading={loading}
              emptyMessage="No volunteer shifts scheduled."
              renderRowActions={(row: any) => {
                const enrolledCount = allAttendance.filter((a) => a.shift_id === row.id || a.shift?.id === row.id).length;
                const capacity = Number(row.capacity ?? 5);
                const isFull = enrolledCount >= capacity;
                return (
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignModal(row)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        background: isFull ? "#94A3B8" : "#16A34A",
                        color: "#FFF",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaUserCheck /> {isFull ? "Shift Full" : "Assign / Join"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleOpenAttendance(row)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#1E3A8A",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaClock /> View Roster ({enrolledCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditShiftModal(row)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFF",
                        color: "#475569",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaEdit /> Edit
                    </button>
                  </div>
                );
              }}
            />
          </div>
        )}

        {/* TAB 4: ATTENDANCE LOG */}
        {activeTab === "attendance" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Real-Time Attendance Stream ({allAttendance.length})
              </h3>
            </div>
            <DataTable
              columns={attendanceColumns}
              data={allAttendance}
              loading={loading}
              emptyMessage="No attendance logs recorded yet."
              renderRowActions={(row: any) => (
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  {!row.check_in_at && (
                    <button
                      type="button"
                      onClick={() => void handleCheckIn(row.id)}
                      style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaSignInAlt /> Check In
                    </button>
                  )}
                  {row.check_in_at && !row.check_out_at && (
                    <button
                      type="button"
                      onClick={() => void handleCheckOut(row.id)}
                      style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaSignOutAlt /> Check Out
                    </button>
                  )}
                  {row.check_out_at && (
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#15803D", background: "#D1FAE5", padding: "4px 8px", borderRadius: "999px" }}>
                      COMPLETED
                    </span>
                  )}
                </div>
              )}
            />
          </div>
        )}

        {/* TAB 5: COMPLETED WORK */}
        {activeTab === "completed" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Verified Completed Volunteer Work Units ({completedWorkList.length})
              </h3>
            </div>
            <DataTable
              columns={completedColumns}
              data={completedWorkList}
              loading={loading}
              emptyMessage="No completed volunteer work items logged yet."
            />
          </div>
        )}

        {/* TAB 6: PERFORMANCE & ACTIVITY REPORTS */}
        {activeTab === "performance_reports" && (
          <div>
            {/* Metrics Visual Panel */}
            <div style={{ background: "#F8FAFC", padding: "20px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                    Volunteer Network Performance &amp; Activity Stream
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
                    Real-time operational summary of scheduled shifts, attendance rates, verified work hours, and report exports.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => void handleExportReports("csv")}
                    style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaFileDownload /> Export CSV Report
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportReports("pdf")}
                    style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaFileDownload /> Export PDF Report
                  </button>
                </div>
              </div>

              {/* Performance Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Shifts Scheduled</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#1E3A8A", marginTop: "4px" }}>{totalShiftCount} Shifts</div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Enrolled / Active Logs</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#F59E0B", marginTop: "4px" }}>{totalAttendanceCount} Logs</div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Completed Assignments</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#16A34A", marginTop: "4px" }}>{totalCompletedCount} Tasks</div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Hours Contributed</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#1E3A8A", marginTop: "4px" }}>{totalHoursSum} Hours</div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Completion Index</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#15803D", marginTop: "4px" }}>{completionRate}%</div>
                </div>
              </div>
            </div>

            {/* Filter Bar for Activity Reports */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>From:</span>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>To:</span>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <select value={volunteerFilter} onChange={(e) => setVolunteerFilter(e.target.value)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", background: "#FFF" }}>
                  <option value="">All Volunteers</option>
                  {approvedVolunteers.map((v) => (
                    <option key={v.id} value={v.id}>{v.user?.full_name || v.full_name || `Volunteer ${String(v.id).slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <DataTable
              columns={completedColumns}
              data={completedWorkList.filter((c) => !volunteerFilter || String(c.volunteer_id) === volunteerFilter)}
              loading={loading}
              emptyMessage="No activity records matching selected filters."
            />
          </div>
        )}
      </div>

      {/* MODAL 1: Public / Intake Application Submission */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Volunteer Public Application Intake">
        <form onSubmit={handleApplySubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Full Name *</label>
              <input type="text" required placeholder="e.g. Jane Doe" value={applyForm.full_name} onChange={(e) => setApplyForm({ ...applyForm, full_name: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Email Address *</label>
              <input type="email" required placeholder="jane@example.com" value={applyForm.email} onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Phone Number *</label>
              <input type="text" required placeholder="+91-9876543210" value={applyForm.phone} onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Preferred Volunteer Role *</label>
              <select value={applyForm.preferred_role} onChange={(e) => setApplyForm({ ...applyForm, preferred_role: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}>
                {PREFERRED_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Availability &amp; Preferred Timings</label>
            <input type="text" placeholder="e.g. Weekends & Morning shifts" value={applyForm.availability} onChange={(e) => setApplyForm({ ...applyForm, availability: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Application Message / Experience Notes</label>
            <textarea rows={3} placeholder="Tell us about your background and interest in supporting animal welfare..." value={applyForm.notes} onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsApplyModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Submitting..." : "Submit Volunteer Application"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Application Review & Response Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedApplicant(null);
        }}
        title={`Review Application — ${selectedApplicant?.user?.full_name || selectedApplicant?.full_name || "Applicant"}`}
        size="lg"
        footer={
          selectedApplicant ? (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleApproveApplication(selectedApplicant)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaCheckCircle size={12} /> Approve Application
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleRejectApplication(selectedApplicant)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaTimesCircle size={12} /> Reject Application
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedApplicant(null);
                }}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#334155", cursor: "pointer" }}
              >
                Close
              </button>
            </>
          ) : null
        }
      >
        {selectedApplicant && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Applicant Name</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{selectedApplicant.user?.full_name || selectedApplicant.full_name || "-"}</div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Email &amp; Phone</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>
                  {selectedApplicant.user?.email || selectedApplicant.email || "-"} / {selectedApplicant.user?.phone || selectedApplicant.phone || selectedApplicant.emergency_contact_phone || "-"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                  Assigned Volunteer Role
                </div>
                <select
                  value={reviewRole}
                  onChange={(e) => setReviewRole(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, color: "#1E3A8A", background: "#FFF", outline: "none" }}
                >
                  {PREFERRED_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Availability / Timings</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{selectedApplicant.availability || "Weekends"}</div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Application Notes / Message</div>
                <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>{selectedApplicant.notes || selectedApplicant.message || "No notes submitted."}</div>
              </div>
            </div>

            {/* Custom Notification Message Override */}
            <div style={{ background: "#EFF6FF", padding: "12px", borderRadius: "8px", border: "1px solid #BFDBFE", marginTop: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaPaperPlane /> Optional Personal Message to Applicant
              </div>
              <div style={{ fontSize: "11px", color: "#1E3A8A", marginTop: "2px", marginBottom: "6px" }}>
                Leave empty to send the standard PawGuard application approval/rejection message.
              </div>
              <textarea
                rows={3}
                placeholder="Enter custom response message to be delivered via notification..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #93C5FD", fontSize: "12px", resize: "vertical" }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: Create Volunteer Shift */}
      <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title="Create Volunteer Shift Schedule">
        <form onSubmit={handleCreateShift} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Work / Shift Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Feeding &amp; Socialization Care"
              value={shiftForm.role_name}
              onChange={(e) => setShiftForm({ ...shiftForm, role_name: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Volunteer Type / Role *</label>
              <select
                value={shiftForm.preferred_role}
                onChange={(e) => setShiftForm({ ...shiftForm, preferred_role: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                {PREFERRED_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Date *</label>
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
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Start Time *</label>
              <input
                type="time"
                required
                value={shiftForm.start_time}
                onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>End Time *</label>
              <input
                type="time"
                required
                value={shiftForm.end_time}
                onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          {facilities.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Location (Shelter Facility) *</label>
              <select
                value={shiftForm.shelter_facility_id}
                onChange={(e) => setShiftForm({ ...shiftForm, shelter_facility_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                <option value="">Central Shelter Facility</option>
                {facilities.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Instructions / Details</label>
            <textarea
              rows={3}
              placeholder="Provide specific guidelines, tasks, contact details or directions for the volunteer..."
              value={shiftForm.notes}
              onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "6px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#0F172A", fontWeight: 700 }}>GPS Geofencing Configuration</h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Location Name (e.g. Shelter Entrance)</label>
                <input
                  type="text"
                  placeholder="e.g. PawGuard Main Shelter"
                  value={shiftForm.location_name}
                  onChange={(e) => setShiftForm({ ...shiftForm, location_name: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Allowed Radius (meters)</label>
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
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Latitude</label>
                <input
                  type="text"
                  placeholder="e.g. 17.123456"
                  value={shiftForm.latitude}
                  onChange={(e) => setShiftForm({ ...shiftForm, latitude: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Longitude</label>
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
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Pick Location on Map</label>
              
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  placeholder="Search location (e.g. Hyderabad, shelter, street name)..."
                  value={createSearchQuery}
                  onChange={(e) => setCreateSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchLocation(createSearchQuery, false);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px"
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSearchLocation(createSearchQuery, false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer"
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
                  position: "relative" 
                }} 
              />
              <span style={{ display: "block", fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                Click anywhere on the map to set the shift coordinates.
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Capacity Limit (Available Slots) *</label>
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
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Direct Assignment (Optional)</label>
              <select
                value={shiftForm.assigned_volunteer_id}
                onChange={(e) => setShiftForm({ ...shiftForm, assigned_volunteer_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                <option value="">Open Shift (Volunteers can claim via Hub)</option>
                {approvedVolunteers.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.user?.full_name || v.full_name || v.emergency_contact_name || "Volunteer"} ({v.preferred_role || "General"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsShiftModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Saving..." : "Save Shift Schedule"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Volunteer Shift Location & Details */}
      <Modal isOpen={isEditShiftModalOpen} onClose={() => { setIsEditShiftModalOpen(false); setSelectedShiftToEdit(null); }} title="Edit Shift Location & Details">
        <form onSubmit={handleEditShiftSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Work / Shift Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Feeding &amp; Socialization Care"
              value={editShiftForm.role_name}
              onChange={(e) => setEditShiftForm({ ...editShiftForm, role_name: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Volunteer Type / Role *</label>
              <select
                value={editShiftForm.preferred_role}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, preferred_role: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                {PREFERRED_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Date *</label>
              <input
                type="date"
                required
                value={editShiftForm.date}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, date: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Start Time *</label>
              <input
                type="time"
                required
                value={editShiftForm.start_time}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, start_time: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>End Time *</label>
              <input
                type="time"
                required
                value={editShiftForm.end_time}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, end_time: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          {facilities.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Location (Shelter Facility) *</label>
              <select
                value={editShiftForm.shelter_facility_id}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, shelter_facility_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
              >
                <option value="">Central Shelter Facility</option>
                {facilities.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Instructions / Details</label>
            <textarea
              rows={3}
              placeholder="Provide specific guidelines, tasks, contact details or directions for the volunteer..."
              value={editShiftForm.notes}
              onChange={(e) => setEditShiftForm({ ...editShiftForm, notes: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "6px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#0F172A", fontWeight: 700 }}>GPS Geofencing Configuration</h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Location Name (e.g. Shelter Entrance)</label>
                <input
                  type="text"
                  placeholder="e.g. PawGuard Main Shelter"
                  value={editShiftForm.location_name}
                  onChange={(e) => setEditShiftForm({ ...editShiftForm, location_name: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Allowed Radius (meters)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave empty for backend default (500m)"
                  value={editShiftForm.allowed_radius_meters}
                  onChange={(e) => setEditShiftForm({ ...editShiftForm, allowed_radius_meters: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Latitude</label>
                <input
                  type="text"
                  placeholder="e.g. 17.123456"
                  value={editShiftForm.latitude}
                  onChange={(e) => setEditShiftForm({ ...editShiftForm, latitude: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Longitude</label>
                <input
                  type="text"
                  placeholder="e.g. 78.123456"
                  value={editShiftForm.longitude}
                  onChange={(e) => setEditShiftForm({ ...editShiftForm, longitude: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Pick Location on Map</label>
              
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  placeholder="Search location (e.g. Hyderabad, shelter, street name)..."
                  value={editSearchQuery}
                  onChange={(e) => setEditSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchLocation(editSearchQuery, true);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px"
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSearchLocation(editSearchQuery, true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Search
                </button>
              </div>

              <div 
                ref={editMapContainerRef} 
                style={{ 
                  width: "100%", 
                  height: "220px", 
                  borderRadius: "8px", 
                  border: "1px solid #CBD5E1", 
                  zIndex: 5,
                  position: "relative" 
                }} 
              />
              <span style={{ display: "block", fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                Click anywhere on the map to set the shift coordinates.
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Capacity Limit (Available Slots) *</label>
              <input
                type="number"
                min="1"
                required
                value={editShiftForm.capacity}
                onChange={(e) => setEditShiftForm({ ...editShiftForm, capacity: Number(e.target.value) })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => { setIsEditShiftModalOpen(false); setSelectedShiftToEdit(null); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Saving..." : "Update Shift Details"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Attendance & Check-In Control Drawer */}
      <Modal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} title="Shift Attendance & Check-In Control" maxWidth="680px">
        {selectedShift && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "#0F172A" }}>{selectedShift.role_name || "Shift Activity"}</div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                Start: {formatDateTime(selectedShift.start_at)} &bull; End: {formatDateTime(selectedShift.end_at)}
              </div>
            </div>

            {attLoading ? (
              <p style={{ color: "#64748B" }}>Loading shift roster...</p>
            ) : attendanceList.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", color: "#64748B" }}>
                No volunteers currently enrolled for this shift.
              </div>
            ) : (
              <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {attendanceList.map((att: any) => (
                  <div key={att.id} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>Volunteer ID: {String(att.volunteer_id).slice(0, 8)}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>
                        Check-In: {att.check_in_at ? formatDateTime(att.check_in_at) : "Not Checked In"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {!att.check_in_at && (
                        <button
                          type="button"
                          onClick={() => void handleCheckIn(att.id)}
                          style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaSignInAlt /> Check In
                        </button>
                      )}

                      {att.check_in_at && !att.check_out_at && (
                        <button
                          type="button"
                          onClick={() => void handleCheckOut(att.id)}
                          style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaSignOutAlt /> Check Out
                        </button>
                      )}

                      {att.check_out_at && (
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#15803D", background: "#D1FAE5", padding: "4px 8px", borderRadius: "999px" }}>
                          COMPLETED ({att.hours_served || 0} hrs)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setIsAttendanceModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", fontWeight: 600 }}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ASSIGN VOLUNTEER TO SHIFT MODAL */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Volunteer to Shift: ${selectedShiftToAssign?.role_name || selectedShiftToAssign?.title || "Shift"}`}
      >
        {selectedShiftToAssign && (
          <form onSubmit={handleConfirmAssignVolunteer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "12px 14px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                {selectedShiftToAssign.role_name || selectedShiftToAssign.title || "Shelter Activity"}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Time: {formatDateTime(selectedShiftToAssign.start_at)} — {formatDateTime(selectedShiftToAssign.end_at)}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                Capacity Status:{" "}
                <strong style={{ color: "#1E3A8A" }}>
                  {allAttendance.filter((a) => a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id).length} / {selectedShiftToAssign.capacity || 5} Enrolled
                </strong>
              </div>
            </div>

            {/* Check Capacity */}
            {allAttendance.filter((a) => a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id).length >= (selectedShiftToAssign.capacity || 5) ? (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEE2E2", color: "#991B1B", fontSize: "13px", fontWeight: 700 }}>
                ⚠️ Shift capacity is full. You cannot assign additional volunteers to this shift.
              </div>
            ) : approvedVolunteers.length === 0 ? (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF3C7", color: "#92400E", fontSize: "13px", fontWeight: 700 }}>
                ⚠️ No active or onboarded volunteers available. Please approve pending applications first.
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Select Approved Volunteer *
                </label>
                <select
                  value={selectedAssignVolunteerId}
                  onChange={(e) => setSelectedAssignVolunteerId(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none" }}
                  required
                >
                  {approvedVolunteers.map((vol) => {
                    const volName = vol.user?.full_name || vol.full_name || vol.emergency_contact_name || "Volunteer Record";
                    const volRole = vol.preferred_role || vol.skills || "Shelter Support";
                    const volAvail = vol.availability || "Flexible";
                    return (
                      <option key={vol.id} value={vol.id}>
                        {volName} — Role: {volRole} ({volAvail})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Check Duplicate Enrollment */}
            {selectedAssignVolunteerId &&
              allAttendance.some(
                (a) =>
                  (a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id) &&
                  (String(a.volunteer_id) === String(selectedAssignVolunteerId) ||
                    String(a.volunteer_profile_id) === String(selectedAssignVolunteerId) ||
                    String(a.volunteer?.id) === String(selectedAssignVolunteerId))
              ) && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF3C7", color: "#92400E", fontSize: "13px", fontWeight: 700 }}>
                  ⚠️ Selected volunteer is already enrolled in this shift.
                </div>
              )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#475569", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  approvedVolunteers.length === 0 ||
                  allAttendance.filter((a) => a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id).length >= (selectedShiftToAssign.capacity || 5) ||
                  allAttendance.some(
                    (a) =>
                      (a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id) &&
                      (String(a.volunteer_id) === String(selectedAssignVolunteerId) ||
                        String(a.volunteer_profile_id) === String(selectedAssignVolunteerId) ||
                        String(a.volunteer?.id) === String(selectedAssignVolunteerId))
                  )
                }
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    isSubmitting ||
                    approvedVolunteers.length === 0 ||
                    allAttendance.filter((a) => a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id).length >= (selectedShiftToAssign.capacity || 5) ||
                    allAttendance.some(
                      (a) =>
                        (a.shift_id === selectedShiftToAssign.id || a.shift?.id === selectedShiftToAssign.id) &&
                        (String(a.volunteer_id) === String(selectedAssignVolunteerId) ||
                          String(a.volunteer_profile_id) === String(selectedAssignVolunteerId) ||
                          String(a.volunteer?.id) === String(selectedAssignVolunteerId))
                    )
                      ? "#94A3B8"
                      : "#16A34A",
                  color: "#FFF",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isSubmitting ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: ASSIGN WORK TASK TO VOLUNTEER */}
      <Modal
        isOpen={isAssignWorkModalOpen}
        onClose={() => setIsAssignWorkModalOpen(false)}
        title="Assign Work Task to Volunteer"
        size="lg"
      >
        <form onSubmit={handleConfirmAssignWork} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* SECTION 1: VOLUNTEER INFORMATION (READ-ONLY CONTEXT) */}
          <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Volunteer Information
            </div>
            {(() => {
              const targetVol = volunteers.find((v) => String(v.id) === String(assignWorkForm.volunteer_id));
              const volName = targetVol?.user?.full_name || targetVol?.full_name || targetVol?.emergency_contact_name || "Volunteer Record";
              const volRole = targetVol?.preferred_role || targetVol?.skills || "Shelter Support";
              const volStatus = String(targetVol?.status || "applied").toUpperCase();
              const isEligible = ["ONBOARDED", "ACTIVE"].includes(volStatus);

              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Volunteer Name</label>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>{volName}</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Volunteer Role</label>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E3A8A", marginTop: "2px" }}>{volRole}</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Account Status</label>
                    <div style={{ marginTop: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: isEligible ? "#ECFDF5" : "#FEF3C7", color: isEligible ? "#15803D" : "#D97706" }}>
                        {volStatus}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: WORK ASSIGNMENT DETAILS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Work Assignment Details
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Assignment / Work Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Foster Home Visit Support, Morning Kennel Feeding, Adoption Event Assistance"
                value={assignWorkForm.role_name}
                onChange={(e) => setAssignWorkForm({ ...assignWorkForm, role_name: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Description / Work Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Describe specific task duties, location details, safety protocols, and care requirements..."
                value={assignWorkForm.notes}
                onChange={(e) => setAssignWorkForm({ ...assignWorkForm, notes: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            {facilities.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Work Location / Shelter Facility
                </label>
                <select
                  value={assignWorkForm.shelter_facility_id}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, shelter_facility_id: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
                >
                  <option value="">Central Shelter Facility</option>
                  {facilities.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Date *</label>
                <input
                  type="date"
                  required
                  value={assignWorkForm.assignment_date}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, assignment_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Start Time *</label>
                <input
                  type="time"
                  required
                  value={assignWorkForm.start_time}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, start_time: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>End Time *</label>
                <input
                  type="time"
                  required
                  value={assignWorkForm.end_time}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, end_time: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Priority</label>
                <select
                  value={assignWorkForm.priority}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, priority: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", background: "#FFF" }}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Status</label>
                <select
                  value={assignWorkForm.status}
                  onChange={(e) => setAssignWorkForm({ ...assignWorkForm, status: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", background: "#FFF" }}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsAssignWorkModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#475569", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Assigning..." : "Assign Work Task"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VOLUNTEER PROFILE DETAILS */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedVolunteerRecord(null);
          setVolunteerSummary(null);
        }}
        title={`Volunteer Details — ${selectedVolunteerRecord?.user?.full_name || selectedVolunteerRecord?.full_name || "Record"}`}
        size="lg"
      >
        {selectedVolunteerRecord && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Full Name &amp; Contact</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                  {selectedVolunteerRecord.user?.full_name || selectedVolunteerRecord.full_name || "Volunteer Record"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>
                  {selectedVolunteerRecord.user?.email || selectedVolunteerRecord.email || "No email"} &bull; {selectedVolunteerRecord.user?.phone || selectedVolunteerRecord.phone || selectedVolunteerRecord.emergency_contact_phone || "No phone"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Assigned / Preferred Role</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#1E3A8A", marginTop: "2px" }}>
                  {selectedVolunteerRecord.preferred_role || selectedVolunteerRecord.skills || "Shelter Support"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>
                  Availability: {selectedVolunteerRecord.availability || "Flexible"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Emergency Contact</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                  {selectedVolunteerRecord.emergency_contact_name || selectedVolunteerRecord.full_name || "Primary Contact"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>
                  Phone: {selectedVolunteerRecord.emergency_contact_phone || selectedVolunteerRecord.phone || "-"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Background Check Status</div>
                <div style={{ marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: selectedVolunteerRecord.background_check_completed ? "#D1FAE5" : "#FEF3C7", color: selectedVolunteerRecord.background_check_completed ? "#15803D" : "#D97706", textTransform: "uppercase" }}>
                    {selectedVolunteerRecord.background_check_completed ? "Completed & Verified" : "Pending"}
                  </span>
                  {selectedVolunteerRecord.background_check_notes && (
                    <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                      {selectedVolunteerRecord.background_check_notes}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Application Date</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                  {selectedVolunteerRecord.created_at ? formatDateTime(selectedVolunteerRecord.created_at) : "Recent"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Account Status</div>
                <div style={{ marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", background: selectedVolunteerRecord.status === "active" ? "#ECFDF5" : selectedVolunteerRecord.status === "onboarded" ? "#EFF6FF" : "#FEF3C7", color: selectedVolunteerRecord.status === "active" ? "#15803D" : selectedVolunteerRecord.status === "onboarded" ? "#1E3A8A" : "#D97706", textTransform: "uppercase" }}>
                    {selectedVolunteerRecord.status || "Applied"}
                  </span>
                </div>
              </div>
            </div>

            {/* Service Summary & Attendance History Section */}
            <div style={{ background: "#EFF6FF", padding: "16px", borderRadius: "12px", border: "1px solid #BFDBFE" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E40AF", marginBottom: "10px" }}>
                Verified Service Record &amp; Attendance History
              </div>

              {(() => {
                const volProfileId = String(selectedVolunteerRecord.id || "").trim();
                const volUserId = String(selectedVolunteerRecord.user_id || selectedVolunteerRecord.user?.id || "").trim();

                const volAttendance = allAttendance.filter((a) => {
                  const attVolId = String(a.volunteer_id || a.volunteer?.id || "").trim();
                  const attProfileId = String(a.volunteer_profile_id || a.volunteer?.profile_id || "").trim();
                  const attUserId = String(a.user_id || a.user?.id || a.volunteer?.user_id || "").trim();

                  const matchesProfile = Boolean(volProfileId && (attVolId === volProfileId || attProfileId === volProfileId));
                  const matchesUser = Boolean(volUserId && (attVolId === volUserId || attUserId === volUserId));
                  return matchesProfile || matchesUser;
                });

                const completedLogs = volAttendance.filter((a) => Boolean(a.check_out_at));
                const totalHours = completedLogs.reduce((acc, curr) => acc + (Number(curr.hours_served) || 0), 0);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #93C5FD" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Hours Served</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#1E3A8A", marginTop: "2px" }}>
                          {volunteerSummary?.total_hours || volunteerSummary?.hours_served || totalHours} Hrs
                        </div>
                      </div>
                      <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #93C5FD" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Completed Shifts</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#16A34A", marginTop: "2px" }}>
                          {volunteerSummary?.completed_shifts || completedLogs.length} Shifts
                        </div>
                      </div>
                      <div style={{ background: "#FFF", padding: "10px", borderRadius: "8px", border: "1px solid #93C5FD" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Joined Shifts</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#1E3A8A", marginTop: "2px" }}>
                          {volunteerSummary?.total_shifts || volAttendance.length} Enrolled
                        </div>
                      </div>
                    </div>

                    {/* Individual Shift Attendance Log Stream */}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E3A8A", marginBottom: "6px" }}>
                        Individual Shift Attendance Logs ({volAttendance.length})
                      </div>
                      {volAttendance.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#64748B", background: "#FFF", padding: "10px", borderRadius: "6px", border: "1px solid #CBD5E1" }}>
                          No shift attendance records logged for this volunteer yet.
                        </div>
                      ) : (
                        <div style={{ maxHeight: "180px", overflowY: "auto", background: "#FFF", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                                <th style={{ padding: "8px 10px" }}>Shift Activity</th>
                                <th style={{ padding: "8px 10px" }}>Check-In</th>
                                <th style={{ padding: "8px 10px" }}>Check-Out</th>
                                <th style={{ padding: "8px 10px" }}>Hours</th>
                                <th style={{ padding: "8px 10px" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {volAttendance.map((log: any, idx: number) => {
                                const isDone = Boolean(log.check_out_at);
                                const isCheckedIn = Boolean(log.check_in_at && !log.check_out_at);
                                return (
                                  <tr key={log.id || idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0F172A" }}>
                                      {log.shift?.role_name || log.shift_name || "Volunteer Shift"}
                                    </td>
                                    <td style={{ padding: "8px 10px", color: "#475569" }}>
                                      {log.check_in_at ? formatDateTime(log.check_in_at) : "-"}
                                    </td>
                                    <td style={{ padding: "8px 10px", color: "#475569" }}>
                                      {log.check_out_at ? formatDateTime(log.check_out_at) : "-"}
                                    </td>
                                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "#1E3A8A" }}>
                                      {log.hours_served || 0} Hrs
                                    </td>
                                    <td style={{ padding: "8px 10px" }}>
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 800,
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background: isDone ? "#D1FAE5" : isCheckedIn ? "#FEF3C7" : "#EFF6FF",
                                          color: isDone ? "#15803D" : isCheckedIn ? "#D97706" : "#1E3A8A",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {isDone ? "Completed" : isCheckedIn ? "Checked In" : "Enrolled"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Status-Dependent Action Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
              {String(selectedVolunteerRecord.status || "").toLowerCase() === "applied" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      setSelectedApplicant(selectedVolunteerRecord);
                      setReviewRole(selectedVolunteerRecord.preferred_role || selectedVolunteerRecord.skills || "Shelter Support");
                      setCustomMessage("");
                      setIsReviewModalOpen(true);
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaCheckCircle size={12} /> Approve / Onboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      void handleRejectApplication(selectedVolunteerRecord);
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaTimesCircle size={12} /> Reject
                  </button>
                </>
              )}

              {String(selectedVolunteerRecord.status || "").toLowerCase() === "onboarded" && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await volunteerService.updateVolunteerProfile(selectedVolunteerRecord.id, { status: "active" });
                        addToast(`Volunteer ${selectedVolunteerRecord.user?.full_name || selectedVolunteerRecord.full_name || "Profile"} activated!`, "success");
                        setIsProfileModalOpen(false);
                        fetchDashboardData();
                        notifyDataChanged();
                      } catch (err: any) {
                        const errorMsg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Failed to activate profile.";
                        addToast(errorMsg, "error");
                      }
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
                  >
                    Activate Volunteer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      handleOpenAssignWorkModal(selectedVolunteerRecord);
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaClipboardList size={12} /> Assign Work
                  </button>
                </>
              )}

              {String(selectedVolunteerRecord.status || "").toLowerCase() === "active" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      handleOpenAssignWorkModal(selectedVolunteerRecord);
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaClipboardList size={12} /> Assign Work
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      setShiftForm((prev) => ({ ...prev, assigned_volunteer_id: String(selectedVolunteerRecord.id) }));
                      setIsShiftModalOpen(true);
                    }}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #16A34A", background: "#ECFDF5", color: "#15803D", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaCalendarAlt size={12} /> Schedule Shift
                  </button>
                </>
              )}

              {String(selectedVolunteerRecord.status || "").toLowerCase() === "inactive" && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await volunteerService.updateVolunteerProfile(selectedVolunteerRecord.id, { status: "active" });
                      addToast(`Volunteer ${selectedVolunteerRecord.user?.full_name || selectedVolunteerRecord.full_name || "Profile"} re-activated!`, "success");
                      setIsProfileModalOpen(false);
                      fetchDashboardData();
                      notifyDataChanged();
                    } catch (err: any) {
                      const errorMsg = typeof err?.response?.data?.detail === "string" ? err.response.data.detail : "Failed to activate profile.";
                      addToast(errorMsg, "error");
                    }
                  }}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
                >
                  Re-Activate
                </button>
              )}

              {(() => {
                const isEligible = isVolunteerEligibleForCertificate(selectedVolunteerRecord);
                const isIssued = Boolean(issuedCertificates[selectedVolunteerRecord.id]);
                return (
                  <button
                    type="button"
                    onClick={() => void handleIssueCertificate(selectedVolunteerRecord.id, selectedVolunteerRecord)}
                    title={isEligible ? (isIssued ? "Download existing certificate" : "Issue volunteer certificate") : "Volunteer must complete verified service first"}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: isEligible ? "1px solid #1E3A8A" : "1px solid #CBD5E1",
                      background: isEligible ? (isIssued ? "#EEF2FF" : "#1E3A8A") : "#F1F5F9",
                      color: isEligible ? (isIssued ? "#1E3A8A" : "#FFFFFF") : "#94A3B8",
                      fontWeight: 700,
                      cursor: isEligible ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <FaAward size={12} /> {isIssued ? "Download Certificate" : isEligible ? "Issue Certificate" : "Ineligible (No Verified Service)"}
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VolunteerCoordinatorDashboard;

