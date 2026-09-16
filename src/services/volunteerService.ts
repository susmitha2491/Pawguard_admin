import api from "../api/axios";

export interface VolunteerAdminIntakePayload {
  full_name: string;
  email: string;
  phone: string;
  preferred_role?: string | null;
  applied_role?: string | null;
  availability?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  skills?: string | null;
  notes?: string | null;
  medical_conditions?: string | null;
  animal_handling?: string | null;
  animal_handling_experience?: string | null;
  [key: string]: unknown;
}

export interface VolunteerApplicationPayload {
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  preferred_role?: "Foster Care" | "Transport" | "Events & Outreach" | "Shelter Support" | string;
  applied_role?: string;
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
  // GET /volunteers - List all volunteer profiles
  getVolunteers: async (params?: Record<string, unknown>) => {
    const response = await api.get("/volunteers", { params });
    return response.data;
  },

  // GET /volunteers/{profile_id} - Get profile details
  getVolunteerById: async (profileId: string) => {
    const response = await api.get(`/volunteers/${profileId}`);
    return response.data;
  },

  // POST /volunteers/admin/intake - Administrative intake for new applicant
  adminIntakeVolunteer: async (data: VolunteerAdminIntakePayload) => {
    const payload = {
      full_name: data.full_name?.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      preferred_role: data.preferred_role || null,
      applied_role: data.applied_role || data.preferred_role || null,
      availability: data.availability || null,
      emergency_contact_name: data.emergency_contact_name || data.full_name || null,
      emergency_contact_phone: data.emergency_contact_phone || data.phone || null,
      skills: data.skills || null,
      notes: data.notes || null,
      medical_conditions: data.medical_conditions || null,
      animal_handling_experience: data.animal_handling_experience || null,
    };
    const response = await api.post("/volunteers/admin/intake", payload);
    return response.data;
  },

  // POST /volunteers/apply - Submit application
  applyVolunteer: async (data: VolunteerApplicationPayload) => {
    if (data.email && data.full_name && data.phone) {
      try {
        return await volunteerService.adminIntakeVolunteer(data as VolunteerAdminIntakePayload);
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
    }

    const { message, ...rest } = data;
    const payload = {
      ...rest,
      full_name: data.full_name?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      notes: data.notes || message || undefined,
      applied_role: data.applied_role || data.preferred_role,
      emergency_contact_name: data.emergency_contact_name || data.full_name || "Emergency Contact",
      emergency_contact_phone: data.emergency_contact_phone || data.phone || "0000000000",
    };
    const response = await api.post("/volunteers/apply", payload);
    return response.data;
  },

  // PUT /volunteers/{profile_id} - Update profile / status
  updateVolunteerProfile: async (profileId: string, data: VolunteerProfileUpdatePayload) => {
    const response = await api.put(`/volunteers/${profileId}`, data);
    return response.data;
  },

  // POST /volunteers/bulk/status - Bulk status update
  bulkUpdateStatus: async (profileIds: string[], status: "applied" | "onboarded" | "active" | "inactive") => {
    const response = await api.post("/volunteers/bulk/status", {
      ids: profileIds,
      profile_ids: profileIds,
      status,
    });
    return response.data;
  },

  // DELETE /volunteers/{profile_id} - Delete profile
  deleteVolunteerProfile: async (profileId: string) => {
    const response = await api.delete(`/volunteers/${profileId}`);
    return response.data;
  },

  // GET /volunteers/{profile_id}/service-summary
  getServiceSummary: async (profileId?: string | null) => {
    if (!profileId || profileId.trim() === "") return null;
    try {
      const response = await api.get(`/volunteers/${profileId}/service-summary`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 422 || err?.response?.status === 400) {
        return null;
      }
      throw err;
    }
  },

  // GET /volunteers/{profile_id}/certificate
  getCertificate: async (profileId?: string | null) => {
    if (!profileId || profileId.trim() === "") return null;
    try {
      const response = await api.get(`/volunteers/${profileId}/certificate`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 403 || err?.response?.status === 404 || err?.response?.status === 422) {
        return null;
      }
      try {
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
      } catch {
        return null;
      }
    }
  },

  // Helper to get certificate for current authenticated volunteer
  getMyCertificate: async () => {
    try {
      const statusRes = await volunteerService.getMyStatus();
      const profileId = getVolunteerProfileId(statusRes);
      if (profileId) {
        return await volunteerService.getCertificate(profileId);
      }
      return null;
    } catch {
      return null;
    }
  },

  // GET /volunteers/shifts - List shifts
  getShifts: async (params?: Record<string, unknown>) => {
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

  // POST /volunteers/shifts/{shift_id}/join - Normal volunteer self-service join shift
  joinShift: async (shiftInput: any, volunteerId?: string) => {
    const shiftId = extractShiftId(shiftInput);
    if (!shiftId) {
      throw new Error("Invalid shift ID provided for shift join/assignment.");
    }
    if (volunteerId) {
      return volunteerService.assignShift(shiftId, volunteerId);
    }
    const response = await api.post(`/volunteers/shifts/${shiftId}/join`);
    return response.data;
  },

  // POST /volunteers/shifts/{shift_id}/assign - Coordinator administrative assignment
  assignShift: async (shiftInput: any, volunteerId: string) => {
    const shiftId = extractShiftId(shiftInput);
    if (!shiftId) {
      throw new Error("Invalid shift ID provided for shift assignment.");
    }
    if (!volunteerId) {
      throw new Error("Volunteer ID is required for shift assignment.");
    }
    const response = await api.post(`/volunteers/shifts/${shiftId}/assign`, {
      volunteer_id: volunteerId,
      volunteer_profile_id: volunteerId,
      profile_id: volunteerId,
    });
    return response.data;
  },

  // Alias for coordinator administrative assignment
  assignVolunteerToShift: async (shiftInput: any, volunteerId: string) => {
    return volunteerService.assignShift(shiftInput, volunteerId);
  },

  // GET /volunteers/shifts/{shift_id}/attendance - List shift attendance
  getShiftAttendance: async (shiftId: string) => {
    const response = await api.get(`/volunteers/shifts/${shiftId}/attendance`);
    return response.data;
  },

  // POST /volunteers/attendance/{attendance_id}/check-in - Check in
  checkInAttendance: async (attendanceId: string, latitude?: number | null, longitude?: number | null, checkInAt?: string) => {
    const payload: Record<string, unknown> = {};
    if (typeof latitude === "number") payload.latitude = latitude;
    if (typeof longitude === "number") payload.longitude = longitude;
    if (checkInAt) payload.check_in_at = checkInAt;
    const response = await api.post(`/volunteers/attendance/${attendanceId}/check-in`, Object.keys(payload).length > 0 ? payload : undefined);
    return response.data;
  },

  // POST /volunteers/attendance/{attendance_id}/check-out - Check out
  checkOutAttendance: async (attendanceId: string, notes?: string, latitude?: number | null, longitude?: number | null, checkOutAt?: string) => {
    const payload: Record<string, unknown> = {};
    if (notes) payload.notes = notes;
    if (typeof latitude === "number") payload.latitude = latitude;
    if (typeof longitude === "number") payload.longitude = longitude;
    if (checkOutAt) payload.check_out_at = checkOutAt;
    const response = await api.post(`/volunteers/attendance/${attendanceId}/check-out`, Object.keys(payload).length > 0 ? payload : undefined);
    return response.data;
  },

  // POST /volunteers/attendance/{attendance_id}/cancel - Cancel attendance
  cancelAttendance: async (attendanceId: string, reason?: string) => {
    const payload = { reason: reason || "Cancelled by volunteer" };
    const response = await api.post(`/volunteers/attendance/${attendanceId}/cancel`, payload);
    return response.data;
  },

  // GET /volunteers/applications - List volunteer applications
  getApplications: async (params?: Record<string, unknown>) => {
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

  // POST /api/v1/volunteers/applications/{id}/approve - Approve application & sync profile status
  approveApplication: async (id: string, notes?: string) => {
    const payload = notes ? { notes } : {};
    let responseData: any;
    try {
      const response = await api.post(`/volunteers/applications/${id}/approve`, payload);
      responseData = response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405 || err?.response?.status === 422) {
        const response = await api.put(`/volunteers/${id}`, { status: "active", ...payload });
        responseData = response.data;
      } else {
        throw err;
      }
    }

    // Synchronize corresponding volunteer profile status to active so shift scheduling/join works
    const profileId =
      responseData?.volunteer_profile?.id ||
      responseData?.profile_id ||
      responseData?.volunteer_profile_id ||
      responseData?.profile?.id ||
      responseData?.id ||
      id;

    if (profileId) {
      try {
        await api.put(`/volunteers/${profileId}`, { status: "active" });
      } catch {
        // Ignore if profile update endpoint returns 404/no-op
      }
    }

    return responseData;
  },

  // POST /api/v1/volunteers/applications/{id}/reject - Reject application & sync profile status
  rejectApplication: async (id: string, reason?: string) => {
    const payload = reason ? { reason, rejection_reason: reason } : {};
    let responseData: any;
    try {
      const response = await api.post(`/volunteers/applications/${id}/reject`, payload);
      responseData = response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405 || err?.response?.status === 422) {
        const response = await api.put(`/volunteers/${id}`, {
          status: "rejected",
          notes: `Rejected: ${reason || ""}`,
        });
        responseData = response.data;
      } else {
        throw err;
      }
    }

    const profileId =
      responseData?.volunteer_profile?.id ||
      responseData?.profile_id ||
      responseData?.volunteer_profile_id ||
      responseData?.profile?.id ||
      responseData?.id ||
      id;

    if (profileId) {
      try {
        await api.put(`/volunteers/${profileId}`, { status: "rejected" });
      } catch {
        // Ignore if profile update endpoint returns 404/no-op
      }
    }

    return responseData;
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
    const response = await api.post("/volunteers/bulk/delete", {
      ids: profileIds,
      profile_ids: profileIds,
    });
    return response.data;
  },

  // GET /volunteers/me/status - Current user volunteer status
  getMyStatus: async () => {
    const response = await api.get("/volunteers/me/status");
    return response.data;
  },

  // GET /volunteers/me/attendance - Current user volunteer attendance
  getMyAttendance: async () => {
    try {
      const response = await api.get("/volunteers/me/attendance");
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const response = await api.get("/volunteers/attendance");
        return response.data;
      }
      throw err;
    }
  },

  // GET /volunteers/me/application - Current user volunteer application
  getMyApplication: async () => {
    const response = await api.get("/volunteers/me/application");
    return response.data;
  },

  // POST /grievance/feedback - Submit feedback / rating
  submitFeedback: async (data: { rating: number; comments?: string; rescue_case_id?: string; adoption_application_id?: string }) => {
    const response = await api.post("/grievance/feedback", data);
    return response.data;
  },

  // GET /grievance/feedback - List feedback
  getFeedback: async (params?: Record<string, unknown>) => {
    const response = await api.get("/grievance/feedback", { params });
    return response.data;
  },

  // GET /grievance/me - List user's submitted grievances & feedback
  getMyFeedback: async (params?: Record<string, unknown>) => {
    try {
      const response = await api.get("/grievance/me", { params });
      return response.data;
    } catch {
      const response = await api.get("/grievance/feedback", { params });
      return response.data;
    }
  },

  // Helper to safely extract UUID shift ID from any backend response structure
  extractShiftId: (res: any): string => {
    return extractShiftId(res);
  },

  // Helper to resolve canonical volunteer profile ID across applications/profiles/users
  getVolunteerProfileId: (vol: any): string => {
    if (!vol) return "";
    if (typeof vol === "string") return vol;
    return String(
      vol.data?.profile?.id ||
      vol.profile?.id ||
      vol.data?.profile_id ||
      vol.profile_id ||
      vol.volunteer_profile_id ||
      vol.volunteer_id ||
      (vol.volunteer && (vol.volunteer.profile_id || vol.volunteer.id)) ||
      (vol.application && vol.application.volunteer_profile_id) ||
      (vol.status && vol.status !== "active" && vol.status !== "pending" && vol.status !== "applied" ? "" : vol.id) ||
      ""
    );
  },
};

export const getVolunteerProfileId = (vol: any): string => {
  return volunteerService.getVolunteerProfileId(vol);
};

export default volunteerService;

