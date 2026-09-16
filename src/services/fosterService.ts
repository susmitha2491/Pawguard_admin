import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export interface FosterProfileCreatePayload {
  preferences?: string;
  max_capacity?: number;
  notes?: string;
}

export interface FosterProfileUpdatePayload {
  status?: "applied" | "approved" | "rejected" | "inactive";
  preferences?: string | null;
  max_capacity?: number | null;
  is_available?: boolean | null;
  notes?: string | null;
  background_check_passed?: boolean | null;
  background_check_notes?: string | null;
  references_checked?: boolean | null;
  reference_notes?: string | null;
  vetting_notes?: string | null;
  home_inspection_passed?: boolean | null;
  home_inspection_notes?: string | null;
  home_inspection_address?: string | null;
}

export interface FosterPlacementPayload {
  dog_id: string;
  notes?: string;
}

export interface FosterReturnPayload {
  reason?: string;
  notes?: string;
}

export interface FosterVetCheckPayload {
  urgency: "routine" | "urgent" | "emergency";
  reason: string;
  preferred_date?: string;
  notes?: string;
}

export interface FosterProgressLogPayload {
  weight_kg?: number;
  behavior_notes?: string;
  feeding_notes?: string;
  medication_notes?: string;
  exercise_minutes?: number;
  photo_urls?: string[];
  mood_rating?: number;
  notes?: string;
}

export interface FosterWeightLogPayload {
  weight_kg: number;
  date?: string;
  notes?: string;
}

export interface FosterBehaviorLogPayload {
  behavior_notes: string;
  mood_rating?: number;
  exercise_minutes?: number;
  notes?: string;
}

export interface FosterMedicationLogPayload {
  medication_notes: string;
  verified: boolean;
  date?: string;
  notes?: string;
}

export interface FosterMediaLogPayload {
  photo_urls: string[];
  caption?: string;
  notes?: string;
}

export interface FosterBackgroundCheckInitiatePayload {
  provider?: string;
  notes?: string;
}

export interface FosterBackgroundCheckOutcomePayload {
  outcome: "cleared" | "flagged" | "rejected" | string;
  notes?: string;
  references_checked?: boolean;
  reference_notes?: string;
}

export interface FosterHomeInspectionSchedulePayload {
  scheduled_at: string;
  inspector_id?: string;
  inspector_name?: string;
  inspection_type?: "physical" | "virtual" | string;
  address?: string;
  notes?: string;
}

export interface FosterHomeInspectionAuditPayload {
  yard_condition?: string;
  fencing_condition?: string;
  household_info?: string;
  existing_pets_info?: string;
  hazards?: string;
  rating?: number;
  evidence_urls?: string[];
  notes?: string;
}

export interface FosterHomeInspectionOutcomePayload {
  outcome?: "approved" | "rejected" | string;
  notes?: string;
  address?: string;
}

export interface FosterSupplyDispatchPayload {
  item_type: "food" | "crate" | "medication" | "bedding" | "toys" | "other" | string;
  description?: string;
  quantity?: number;
}

export interface FosterRejectPayload {
  reason?: string;
  rejection_reason?: string;
  notes?: string;
  vetting_notes?: string;
  status?: string;
}

export const fosterService = {
  // GET /dashboards/foster
  getFosterDashboard: async () => {
    const response = await api.get("/dashboards/foster");
    return response.data;
  },

  // GET /admin/dashboard/foster-stats
  getFosterStats: async () => {
    const response = await api.get("/admin/dashboard/foster-stats");
    return response.data;
  },

  // GET /fosters - list foster profiles (paginated FosterProfileResponse)
  getFosterProfiles: async (params?: Record<string, unknown>) => {
    const response = await api.get("/fosters", { params });
    return response.data;
  },

  // GET /fosters/{profile_id} - get single foster profile
  getFosterProfile: async (profileId: string) => {
    const response = await api.get(`/fosters/${profileId}`);
    return response.data;
  },

  // Alias for getFosterProfile
  getProfile: async (profileId: string) => {
    return fosterService.getFosterProfile(profileId);
  },

  // GET /fosters/placements - list all foster placements
  getPlacements: async (params?: Record<string, unknown>) => {
    const response = await api.get("/fosters/placements", { params });
    return response.data;
  },

  // Backwards-compatible alias for getPlacements
  getFosterPlacements: async (params?: Record<string, unknown>) => {
    const response = await api.get("/fosters/placements", { params });
    return response.data;
  },

  // GET /fosters/me - Get my foster profile
  getMyProfile: async () => {
    const response = await api.get("/fosters/me");
    return response.data;
  },

  // GET /fosters/me/placements - Get my active placements
  getMyPlacements: async () => {
    const response = await api.get("/fosters/me/placements");
    return response.data;
  },

  // POST /fosters/apply - FosterProfileCreate
  apply: async (data: Record<string, unknown> | FosterProfileCreatePayload) => {
    const response = await api.post("/fosters/apply", data);
    await publishActionEvent({
      module: "foster",
      action: "create",
      title: "Foster Profile Application Submitted",
      message: "A new foster parent application was registered.",
      targetRoles: ["super_admin", "foster_coordinator"],
    });
    return response.data;
  },

  // PUT /fosters/{profile_id} - FosterProfileUpdate
  updateFosterProfile: async (profileId: string, data: Record<string, unknown> | FosterProfileUpdatePayload) => {
    const response = await api.put(`/fosters/${profileId}`, data);
    await publishActionEvent({
      module: "foster",
      action: "update",
      title: "Foster Profile Updated",
      message: `Foster profile ${profileId} was updated.`,
      targetRoles: ["super_admin", "foster_coordinator"],
    });
    return response.data;
  },

  // Alias for updateFosterProfile
  updateProfile: async (profileId: string, data: Record<string, unknown> | FosterProfileUpdatePayload) => {
    return fosterService.updateFosterProfile(profileId, data);
  },

  // POST /fosters/{profile_id}/approve - Approve foster profile (Direct Dedicated Endpoint)
  approveProfile: async (profileId: string, data?: Record<string, unknown> | FosterProfileUpdatePayload) => {
    const response = await api.post(`/fosters/${profileId}/approve`, data || {});
    await publishActionEvent({
      module: "foster",
      action: "approve",
      title: "Foster Caregiver Application Approved",
      message: `Foster profile ${profileId} was approved and is now eligible for placements.`,
      targetRoles: ["super_admin", "foster_coordinator"],
    });
    return response.data;
  },

  // POST /fosters/{profile_id}/reject - Reject foster application (Direct Dedicated Endpoint)
  rejectProfile: async (profileId: string, payload?: FosterRejectPayload | string) => {
    const data: FosterRejectPayload =
      typeof payload === "string"
        ? { reason: payload, rejection_reason: payload, notes: payload, status: "rejected" }
        : {
            reason: payload?.reason || payload?.rejection_reason || "Application rejected by coordinator",
            rejection_reason: payload?.rejection_reason || payload?.reason || "Application rejected by coordinator",
            notes: payload?.notes || payload?.vetting_notes || "",
            vetting_notes: payload?.vetting_notes || payload?.notes || "",
            status: "rejected",
          };

    const response = await api.post(`/fosters/${profileId}/reject`, data);
    await publishActionEvent({
      module: "foster",
      action: "update",
      title: "Foster Application Rejected",
      message: `Foster application ${profileId} was rejected.`,
      targetRoles: ["super_admin", "foster_coordinator"],
    });
    return response.data;
  },

  // POST /fosters/{profile_id}/status - Update Foster Status (Direct Dedicated Endpoint)
  updateProfileStatus: async (profileId: string, status: string, notes?: string) => {
    const data: FosterRejectPayload = {
      status,
      reason: notes || `Status changed to ${status}`,
      notes: notes || "",
    };
    const response = await api.post(`/fosters/${profileId}/status`, data);
    return response.data;
  },

  // DELETE /fosters/{profile_id}
  deleteProfile: async (profileId: string) => {
    const response = await api.delete(`/fosters/${profileId}`);
    return response.data;
  },

  // POST /fosters/{profile_id}/placements - Place dog with foster parent (Direct Dedicated Endpoint)
  placeDog: async (profileId: string, data: FosterPlacementPayload) => {
    const payload: Record<string, unknown> = {
      foster_profile_id: profileId,
      profile_id: profileId,
      dog_id: data.dog_id,
    };
    if (data.notes) payload.notes = data.notes;

    try {
      const response = await api.post(`/fosters/${profileId}/placements`, payload);
      await publishActionEvent({
        module: "foster",
        action: "create",
        title: "Dog Placed in Foster Care",
        message: `Dog ${data.dog_id} placed with foster profile ${profileId}.`,
        targetRoles: ["super_admin", "foster_coordinator", "shelter_manager", "rescue_centre_admin"],
      });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const response = await api.post("/fosters/placements", payload);
        await publishActionEvent({
          module: "foster",
          action: "create",
          title: "Dog Placed in Foster Care",
          message: `Dog ${data.dog_id} placed with foster profile ${profileId}.`,
          targetRoles: ["super_admin", "foster_coordinator", "shelter_manager", "rescue_centre_admin"],
        });
        return response.data;
      }
      throw err;
    }
  },

  // Alias for placeDog
  createFosterPlacement: async (profileId: string, data: FosterPlacementPayload) => {
    return fosterService.placeDog(profileId, data);
  },

  // GET /fosters/{profile_id}/placements
  getProfilePlacements: async (profileId: string) => {
    const response = await api.get(`/fosters/${profileId}/placements`);
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/return - Return dog from foster (Direct Dedicated Endpoint)
  returnDog: async (placementId: string, data?: string | FosterReturnPayload) => {
    const payload: FosterReturnPayload =
      typeof data === "string" ? { notes: data, reason: "Normal Placement Conclusion" } : (data || {});

    // Publish event asynchronously without blocking or failing the successful return
    publishActionEvent({
      module: "foster",
      action: "update",
      title: "Dog Returned from Foster Care",
      message: `Foster placement ${placementId} concluded and animal returned to shelter.`,
      targetRoles: ["super_admin", "foster_coordinator", "shelter_manager"],
    }).catch(() => null);

    try {
      const response = await api.post(`/fosters/placements/${placementId}/return`, payload);
      return response.data;
    } catch (primaryErr: any) {
      // If primary POST returns 404/405, fallback to alternate valid OpenAPI paths
      if (primaryErr?.response?.status === 404 || primaryErr?.response?.status === 405) {
        try {
          const putRes = await api.put(`/fosters/placements/${placementId}/return`, payload);
          return putRes.data;
        } catch {
          const altRes = await api.post(`/fosters/placements/${placementId}/return-to-shelter`, payload);
          return altRes.data;
        }
      }
      throw primaryErr;
    }
  },

  // Alias for returnDog
  returnPlacement: async (placementId: string, data?: string | FosterReturnPayload) => {
    return fosterService.returnDog(placementId, data);
  },

  // POST /fosters/placements/{placement_id}/vet-check - Request Vet Check (Direct Dedicated Endpoint)
  requestVetCheck: async (placementId: string, payload: FosterVetCheckPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/vet-check`, payload);
    await publishActionEvent({
      module: "foster",
      action: "create",
      title: "Foster Dog Vet Check Requested",
      message: `Veterinary examination requested (${payload.urgency}): ${payload.reason}`,
      targetRoles: ["super_admin", "foster_coordinator", "veterinarian"],
    });
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/progress - Log foster progress report (Direct Dedicated Endpoint)
  logProgress: async (placementId: string, data: Record<string, unknown> | FosterProgressLogPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/progress`, data);
    return response.data;
  },

  // Alias for logProgress
  addProgress: async (placementId: string, data: Record<string, unknown> | FosterProgressLogPayload) => {
    return fosterService.logProgress(placementId, data);
  },

  // POST /fosters/placements/{placement_id}/progress/weight - Log Weight
  logWeight: async (placementId: string, payload: FosterWeightLogPayload) => {
    const cleanPayload: { weight_kg: number; notes?: string } = {
      weight_kg: Number(payload.weight_kg),
    };
    if (payload.notes) cleanPayload.notes = payload.notes.trim();

    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/weight`, cleanPayload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        try {
          const alt1 = await api.post(`/fosters/placements/${placementId}/weight`, cleanPayload);
          return alt1.data;
        } catch {
          const alt2 = await api.post(`/fosters/${placementId}/progress/weight`, cleanPayload);
          return alt2.data;
        }
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/behavior - Log Behavior
  logBehavior: async (placementId: string, payload: FosterBehaviorLogPayload) => {
    const cleanPayload: {
      behavior_notes: string;
      mood_rating?: number;
      exercise_minutes?: number;
      notes?: string;
    } = {
      behavior_notes: payload.behavior_notes.trim(),
    };
    if (payload.mood_rating) cleanPayload.mood_rating = Number(payload.mood_rating);
    if (payload.exercise_minutes !== undefined) cleanPayload.exercise_minutes = Number(payload.exercise_minutes);
    if (payload.notes) cleanPayload.notes = payload.notes.trim();

    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/behavior`, cleanPayload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const alt = await api.post(`/fosters/${placementId}/progress/behavior`, cleanPayload);
        return alt.data;
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/medication - Log Medication Check-in
  logMedication: async (placementId: string, payload: FosterMedicationLogPayload) => {
    const cleanPayload: {
      medication_notes: string;
      verified: boolean;
      notes?: string;
    } = {
      medication_notes: payload.medication_notes.trim(),
      verified: payload.verified ?? true,
    };
    if (payload.notes) cleanPayload.notes = payload.notes.trim();

    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/medication`, cleanPayload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const alt = await api.post(`/fosters/${placementId}/progress/medication`, cleanPayload);
        return alt.data;
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/media - Log Media
  logMedia: async (placementId: string, payload: FosterMediaLogPayload) => {
    const cleanPayload: {
      photo_urls: string[];
      caption?: string;
      notes?: string;
    } = {
      photo_urls: Array.isArray(payload.photo_urls) ? payload.photo_urls : [payload.photo_urls],
    };
    if (payload.caption) cleanPayload.caption = payload.caption.trim();
    if (payload.notes) cleanPayload.notes = payload.notes.trim();

    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/media`, cleanPayload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const alt = await api.post(`/fosters/${placementId}/progress/media`, cleanPayload);
        return alt.data;
      }
      throw err;
    }
  },

  // GET /fosters/placements/{placement_id}/progress
  getProgressLogs: async (placementId: string) => {
    const response = await api.get(`/fosters/placements/${placementId}/progress`);
    return response.data;
  },

  // POST /fosters/{profile_id}/background-check/initiate - Initiate Background Check (Direct Dedicated Endpoint)
  initiateBackgroundCheck: async (profileId: string, payload?: FosterBackgroundCheckInitiatePayload) => {
    const response = await api.post(`/fosters/${profileId}/background-check/initiate`, payload || {});
    return response.data;
  },

  // POST /fosters/{profile_id}/background-check/outcome - Record Outcome (Direct Dedicated Endpoint)
  submitBackgroundCheckOutcome: async (profileId: string, payload: FosterBackgroundCheckOutcomePayload) => {
    const response = await api.post(`/fosters/${profileId}/background-check/outcome`, payload);
    return response.data;
  },

  recordBackgroundCheckOutcome: async (profileId: string, payload: FosterBackgroundCheckOutcomePayload) => {
    return fosterService.submitBackgroundCheckOutcome(profileId, payload);
  },

  updateBackgroundCheck: async (profileId: string, payload: FosterBackgroundCheckOutcomePayload) => {
    return fosterService.submitBackgroundCheckOutcome(profileId, payload);
  },

  // POST /fosters/{profile_id}/home-inspection/schedule - Schedule Inspection (Direct Dedicated Endpoint)
  scheduleHomeInspection: async (profileId: string, payload: FosterHomeInspectionSchedulePayload) => {
    const response = await api.post(`/fosters/${profileId}/home-inspection/schedule`, payload);
    return response.data;
  },

  logHomeInspectionAudit: async (profileId: string, payload: FosterHomeInspectionAuditPayload) => {
    const response = await api.post(`/fosters/${profileId}/home-inspection/log`, payload);
    return response.data;
  },

  // POST /fosters/{profile_id}/home-inspection/outcome - Record Home Inspection Outcome (Direct Dedicated Endpoint)
  submitHomeInspectionOutcome: async (profileId: string, payload: FosterHomeInspectionOutcomePayload) => {
    const response = await api.post(`/fosters/${profileId}/home-inspection/outcome`, payload);
    return response.data;
  },

  recordHomeInspectionOutcome: async (profileId: string, payload: FosterHomeInspectionOutcomePayload) => {
    return fosterService.submitHomeInspectionOutcome(profileId, payload);
  },

  updateHomeInspection: async (profileId: string, payload: FosterHomeInspectionSchedulePayload | FosterHomeInspectionOutcomePayload) => {
    if ("outcome" in payload) {
      return fosterService.submitHomeInspectionOutcome(profileId, payload);
    }
    return fosterService.scheduleHomeInspection(profileId, payload as FosterHomeInspectionSchedulePayload);
  },

  // POST /fosters/placements/{placement_id}/supplies - Log supply dispatch (Direct Dedicated Endpoint)
  logSupplyDispatch: async (placementId: string, data: FosterSupplyDispatchPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/supplies`, data);
    return response.data;
  },

  // Alias for logSupplyDispatch
  dispatchSupplies: async (placementId: string, data: FosterSupplyDispatchPayload) => {
    return fosterService.logSupplyDispatch(placementId, data);
  },

  // GET /fosters/placements/{placement_id}/supplies
  getSupplyDispatches: async (placementId: string) => {
    const response = await api.get(`/fosters/placements/${placementId}/supplies`);
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/supplies/request
  requestSupplies: async (placementId: string, data: FosterSupplyDispatchPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/supplies/request`, data);
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/convert-to-adoption - Foster to Adopt conversion
  convertToAdopt: async (placementId: string, notes?: string) => {
    const payload = notes ? { notes } : {};
    try {
      const response = await api.post(`/fosters/placements/${placementId}/convert-to-adoption`, payload);
      await publishActionEvent({
        module: "foster",
        action: "approve",
        title: "Foster Placement Converted to Adoption",
        message: `Placement ${placementId} converted into permanent adoption!`,
        targetRoles: ["super_admin", "foster_coordinator", "adoption_coordinator"],
      });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const altRes = await api.post(`/fosters/placements/${placementId}/convert-to-adopt`, payload);
        return altRes.data;
      }
      throw err;
    }
  },

  // Alias for convertToAdopt
  convertToAdoption: async (placementId: string, notes?: string) => {
    return fosterService.convertToAdopt(placementId, notes);
  },

  // POST /fosters/bulk/delete
  bulkDeleteProfiles: async (profileIds: string[]) => {
    const response = await api.post("/fosters/bulk/delete", {
      ids: profileIds,
      profile_ids: profileIds,
    });
    return response.data;
  },
};

export default fosterService;
