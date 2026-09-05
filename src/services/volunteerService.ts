import api from "../api/axios";
import { getCurrentUser, getCurrentUserRole } from "../utils/roleUtils";

const getMyProfile = async (): Promise<{ id: string; preferred_role: string } | null> => {
  const user = getCurrentUser();
  if (!user) return null;
  const userRole = getCurrentUserRole();
  if (userRole !== "volunteer") return null;

  try {
    const myEmail = user.email?.toLowerCase();
    const response = await api.get("/volunteers");
    const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    const myProfile = list.find((v: any) => 
      (v.email && v.email.toLowerCase() === myEmail) || 
      (v.user?.email && v.user.email.toLowerCase() === myEmail) ||
      String(v.id) === String(user.id) ||
      String(v.user?.id) === String(user.id)
    );
    if (myProfile) {
      return {
        id: myProfile.id || myProfile.profile_id || "",
        preferred_role: myProfile.preferred_role || myProfile.volunteer_type || myProfile.applied_role || "",
      };
    }
  } catch (err) {
    console.error("Error fetching volunteer profile", err);
  }
  return null;
};


export interface VolunteerApplicationPayload {
  emergency_contact_name: string;
  emergency_contact_phone: string;
  full_name?: string;
  email?: string;
  phone?: string;
  preferred_role?: "Foster Care" | "Transport" | "Events & Outreach" | "Shelter Support" | string;
  availability?: string;
  message?: string;
  skills?: string;
  notes?: string;
  medical_conditions?: string;
  animal_handling_experience?: string;
  [key: string]: unknown;
}

export interface VolunteerProfileUpdatePayload {
  status?: "applied" | "pending" | "approved" | "onboarded" | "active" | "inactive" | "rejected";
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  skills?: string | null;
  availability?: string | null;
  notes?: string | null;
  medical_conditions?: string | null;
  animal_handling_experience?: string | null;
  background_check_completed?: boolean | null;
  background_check_notes?: string | null;
}

export type PublicVolunteerStatus = "NOT_APPLIED" | "PENDING" | "APPROVED" | "INACTIVE";

export const mapBackendStatusToPublic = (status?: string): PublicVolunteerStatus => {
  const s = String(status || "").toLowerCase().trim();
  if (s === "active" || s === "onboarded") return "APPROVED";
  if (s === "applied") return "PENDING";
  if (s === "inactive") return "INACTIVE";
  return "NOT_APPLIED";
};

export interface ShiftCreatePayload {
  shelter_facility_id?: string | null;
  role_name: string;
  start_at: string;
  end_at: string;
  capacity?: number;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  allowed_radius_meters?: number | null;
  [key: string]: unknown;
}

export const extractShiftId = (res: any): string => {
  if (!res) return "";
  if (typeof res === "string") return res;
  if (typeof res.id === "string" && res.id) return res.id;
  if (res.data) {
    if (typeof res.data === "string" && res.data) return res.data;
    if (typeof res.data.id === "string" && res.data.id) return res.data.id;
    if (res.data.data && typeof res.data.data.id === "string" && res.data.data.id) return res.data.data.id;
  }
  return "";
};

export const volunteerService = {
  // GET /volunteers - List volunteer profiles
  getVolunteers: async (params?: Record<string, unknown>) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      const user = getCurrentUser();
      const response = await api.get("/volunteers", { params });
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const myProfile = list.find((v: any) => 
        (v.email && v.email.toLowerCase() === user?.email?.toLowerCase()) || 
        (v.user?.email && v.user.email.toLowerCase() === user?.email?.toLowerCase()) ||
        String(v.id) === String(user?.id) ||
        String(v.user?.id) === String(user?.id)
      );
      return myProfile ? [myProfile] : [];
    }
    const response = await api.get("/volunteers", { params });
    return response.data;
  },

  // GET /volunteers/{profile_id} - Get profile details
  getVolunteerById: async (profileId: string) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      const user = getCurrentUser();
      const response = await api.get("/volunteers");
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const myProfile = list.find((v: any) => 
        (v.email && v.email.toLowerCase() === user?.email?.toLowerCase()) || 
        (v.user?.email && v.user.email.toLowerCase() === user?.email?.toLowerCase()) ||
        String(v.id) === String(user?.id) ||
        String(v.user?.id) === String(user?.id)
      );
      if (!myProfile || String(profileId) !== String(myProfile.id)) {
        throw new Error("Unauthorized access to another volunteer profile.");
      }
    }
    const response = await api.get(`/volunteers/${profileId}`);
    return response.data;
  },

  // POST /volunteers/apply - Submit application
  applyVolunteer: async (data: VolunteerApplicationPayload) => {
    const response = await api.post("/volunteers/apply", data);
    return response.data;
  },

  // PUT /volunteers/{profile_id} - Update profile / status
  updateVolunteerProfile: async (profileId: string, data: VolunteerProfileUpdatePayload) => {
    const response = await api.put(`/volunteers/${profileId}`, data);
    return response.data;
  },

  // POST /volunteers/bulk/status - Bulk status update
  bulkUpdateStatus: async (profileIds: string[], status: "applied" | "onboarded" | "active" | "inactive") => {
    const response = await api.post("/volunteers/bulk/status", { profile_ids: profileIds, status });
    return response.data;
  },

  // DELETE /volunteers/{profile_id} - Delete profile
  deleteVolunteerProfile: async (profileId: string) => {
    const response = await api.delete(`/volunteers/${profileId}`);
    return response.data;
  },

  // GET /volunteers/{profile_id}/service-summary
  getServiceSummary: async (profileId: string) => {
    const response = await api.get(`/volunteers/${profileId}/service-summary`);
    return response.data;
  },

  // GET /volunteers/{profile_id}/certificate
  getCertificate: async (profileId: string) => {
    try {
      const response = await api.get(`/volunteers/${profileId}/certificate`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 403 || err?.response?.status === 404 || err?.response?.status === 422) {
        throw err;
      }
      const response = await api.get(`/volunteers/${profileId}/certificate`, {
        responseType: "blob",
      });
      if (response.data && response.data.type === "application/json") {
        const text = await response.data.text();
        try {
          return JSON.parse(text);
        } catch {
          return response.data;
        }
      }
      return response.data;
    }
  },

  // GET /volunteers/me/certificate
  getMyCertificate: async () => {
    try {
      const response = await api.get(`/volunteers/me/certificate`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 403 || err?.response?.status === 404 || err?.response?.status === 422) {
        throw err;
      }
      const response = await api.get(`/volunteers/me/certificate`, {
        responseType: "blob",
      });
      if (response.data && response.data.type === "application/json") {
        const text = await response.data.text();
        try {
          return JSON.parse(text);
        } catch {
          return response.data;
        }
      }
      return response.data;
    }
  },

  // GET /volunteers/shifts - List shifts
  getShifts: async (params?: Record<string, unknown>) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      const myProfile = await getMyProfile();
      if (!myProfile) return [];

      const response = await api.get("/volunteers/shifts", { params });
      const shiftsList = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.items || []);
      
      const filtered = [];
      for (const shift of shiftsList) {
        try {
          const attResponse = await api.get(`/volunteers/shifts/${shift.id}/attendance`);
          const attList = Array.isArray(attResponse.data) ? attResponse.data : (attResponse.data?.data || []);
          const isAssigned = attList.some((att: any) => 
            String(att.volunteer_id) === String(myProfile.id) ||
            String(att.volunteer_profile_id) === String(myProfile.id) ||
            String(att.volunteer?.id) === String(myProfile.id)
          );
          if (isAssigned) {
            const roleName = String(shift.role_name || shift.title || "").toLowerCase();
            const prefRole = String(myProfile.preferred_role || "").toLowerCase();
            let matchesType = false;
            if (prefRole.includes("foster") && roleName.includes("foster")) matchesType = true;
            else if (prefRole.includes("transport") && roleName.includes("transport")) matchesType = true;
            else if (prefRole.includes("shelter") && roleName.includes("shelter")) matchesType = true;
            else if ((prefRole.includes("event") || prefRole.includes("outreach")) && (roleName.includes("event") || roleName.includes("outreach"))) matchesType = true;
            else if (!prefRole.includes("foster") && !prefRole.includes("transport") && !prefRole.includes("shelter") && !prefRole.includes("event") && !prefRole.includes("outreach")) {
              matchesType = true;
            }
            if (matchesType) {
              filtered.push(shift);
            }
          }
        } catch {
          // ignore
        }
      }
      return filtered;
    }
    const response = await api.get("/volunteers/shifts", { params });
    return response.data;
  },

  // POST /volunteers/shifts - Create shift
  createShift: async (data: ShiftCreatePayload) => {
    const response = await api.post("/volunteers/shifts", data);
    return response.data;
  },

  // PUT /volunteers/shifts/{shift_id} - Update shift
  updateShift: async (shiftId: string, data: Partial<ShiftCreatePayload>) => {
    const response = await api.put(`/volunteers/shifts/${shiftId}`, data);
    return response.data;
  },

  // POST /volunteers/shifts/{shift_id}/join - Join or assign volunteer to shift
  joinShift: async (shiftInput: any, volunteerId?: string) => {
    const shiftId = extractShiftId(shiftInput);
    if (!shiftId) {
      throw new Error("Invalid shift ID provided for shift join/assignment.");
    }
    const payload = volunteerId ? { volunteer_id: volunteerId, volunteer_profile_id: volunteerId } : undefined;
    const response = await api.post(`/volunteers/shifts/${shiftId}/join`, payload);
    return response.data;
  },

  // GET /volunteers/shifts/{shift_id}/attendance - List shift attendance
  getShiftAttendance: async (shiftId: string) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      const myProfile = await getMyProfile();
      if (!myProfile) return [];
      const response = await api.get(`/volunteers/shifts/${shiftId}/attendance`);
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      return list.filter((att: any) => 
        String(att.volunteer_id) === String(myProfile.id) ||
        String(att.volunteer_profile_id) === String(myProfile.id) ||
        String(att.volunteer?.id) === String(myProfile.id)
      );
    }
    const response = await api.get(`/volunteers/shifts/${shiftId}/attendance`);
    return response.data;
  },

  // POST /volunteers/attendance/{attendance_id}/check-in - Check in
  checkInAttendance: async (attendanceId: string, checkInAt?: string) => {
    const payload = checkInAt ? { check_in_at: checkInAt } : {};
    const response = await api.post(`/volunteers/attendance/${attendanceId}/check-in`, payload);
    return response.data;
  },

  // POST /volunteers/attendance/{attendance_id}/check-out - Check out
  checkOutAttendance: async (attendanceId: string, notes?: string, checkOutAt?: string) => {
    const payload: Record<string, unknown> = {};
    if (notes) payload.notes = notes;
    if (checkOutAt) payload.check_out_at = checkOutAt;
    const response = await api.post(`/volunteers/attendance/${attendanceId}/check-out`, payload);
    return response.data;
  },

  // GET /volunteers/applications - List volunteer applications
  getApplications: async (params?: Record<string, unknown>) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      return [];
    }
    try {
      const response = await api.get("/volunteers/applications", { params });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await api.get("/volunteers", { params });
        return response.data;
      }
      throw err;
    }
  },

  // GET /volunteers/applications/{id} - Get application details
  getApplicationById: async (id: string) => {
    const userRole = getCurrentUserRole();
    if (userRole === "volunteer") {
      throw new Error("Unauthorized access.");
    }
    try {
      const response = await api.get(`/volunteers/applications/${id}`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await api.get(`/volunteers/${id}`);
        return response.data;
      }
      throw err;
    }
  },

  // POST /api/v1/volunteers/applications/{id}/approve - Approve application
  approveApplication: async (id: string, notes?: string) => {
    const payload = notes ? { notes } : {};
    const response = await api.post(`/volunteers/applications/${id}/approve`, payload);
    return response.data;
  },

  // POST /api/v1/volunteers/applications/{id}/reject - Reject application
  rejectApplication: async (id: string, reason?: string) => {
    const payload = reason ? { reason, rejection_reason: reason } : {};
    const response = await api.post(`/volunteers/applications/${id}/reject`, payload);
    return response.data;
  },

  // GET /dashboards/volunteer - Volunteer Dashboard summary
  getVolunteerDashboard: async () => {
    const response = await api.get("/dashboards/volunteer");
    return response.data;
  },

  // GET /admin/dashboard/volunteer-stats - Admin stats
  getVolunteerStats: async () => {
    const response = await api.get("/admin/dashboard/volunteer-stats");
    return response.data;
  },

  // POST /volunteers/bulk/delete - Bulk delete profiles
  bulkDeleteProfiles: async (profileIds: string[]) => {
    const response = await api.post("/volunteers/bulk/delete", { profile_ids: profileIds });
    return response.data;
  },

  // GET /volunteers/me/status - Current user volunteer status
  getMyStatus: async () => {
    const response = await api.get("/volunteers/me/status");
    return response.data;
  },

  // GET /volunteers/me/application - Current user volunteer application
  getMyApplication: async () => {
    const response = await api.get("/volunteers/me/application");
    return response.data;
  },

  // Helper to safely extract UUID shift ID from any backend response structure
  extractShiftId: (res: any): string => {
    return extractShiftId(res);
  },
};

export default volunteerService;
