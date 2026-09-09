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
  outcome: "cleared" | "flagged" | "rejected";
  notes: string;
  references_checked?: boolean;
  reference_notes?: string;
}

export interface FosterHomeInspectionSchedulePayload {
  scheduled_at: string;
  inspector_id?: string;
  inspector_name?: string;
  inspection_type: "in_person" | "virtual" | "shelter_visit" | string;
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
  outcome: "approved" | "rejected";
  notes: string;
  address?: string;
}

export interface FosterSupplyDispatchPayload {
  item_type: "food" | "crate" | "medication" | "bedding" | "toys" | "other" | string;
  description?: string;
  quantity?: number;
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

  // Backwards-compatible alias
  getFosterPlacements: async (params?: Record<string, unknown>) => {
    const response = await api.get("/fosters", { params });
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
  updateProfile: async (profileId: string, data: Record<string, unknown> | FosterProfileUpdatePayload) => {
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

  // DELETE /fosters/{profile_id}
  deleteProfile: async (profileId: string) => {
    const response = await api.delete(`/fosters/${profileId}`);
    return response.data;
  },

  // POST /fosters/{profile_id}/placements - Place dog with foster parent
  placeDog: async (profileId: string, data: FosterPlacementPayload) => {
    const response = await api.post(`/fosters/${profileId}/placements`, data);
    await publishActionEvent({
      module: "foster",
      action: "create",
      title: "Dog Placed in Foster Care",
      message: `Dog ${data.dog_id} placed with foster profile ${profileId}.`,
      targetRoles: ["super_admin", "foster_coordinator", "shelter_manager", "rescue_centre_admin"],
    });
    return response.data;
  },

  // GET /fosters/{profile_id}/placements
  getProfilePlacements: async (profileId: string) => {
    const response = await api.get(`/fosters/${profileId}/placements`);
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/return - Return dog from foster
  returnDog: async (placementId: string, data?: string | FosterReturnPayload) => {
    const payload: FosterReturnPayload =
      typeof data === "string" ? { notes: data, reason: "Normal Placement Conclusion" } : (data || {});
    let resData: any = null;
    try {
      const response = await api.post(`/fosters/placements/${placementId}/return`, payload);
      resData = response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const fallbackRes = await api.post(`/fosters/placements/${placementId}/return-to-shelter`, payload);
        resData = fallbackRes.data;
      } else {
        throw err;
      }
    }
    await publishActionEvent({
      module: "foster",
      action: "update",
      title: "Dog Returned from Foster Care",
      message: `Foster placement ${placementId} concluded and animal returned to shelter.`,
      targetRoles: ["super_admin", "foster_coordinator", "shelter_manager"],
    });
    return resData;
  },

  // POST /fosters/placements/{placement_id}/vet-check - Request Vet Check
  requestVetCheck: async (placementId: string, payload: FosterVetCheckPayload) => {
    let resData: any = null;
    try {
      const response = await api.post(`/fosters/placements/${placementId}/vet-check`, payload);
      resData = response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const fallbackRes = await api.post(`/fosters/placements/${placementId}/request-vet-check`, payload);
        resData = fallbackRes.data;
      } else {
        throw err;
      }
    }
    await publishActionEvent({
      module: "foster",
      action: "create",
      title: "Foster Dog Vet Check Requested",
      message: `Veterinary examination requested (${payload.urgency}): ${payload.reason}`,
      targetRoles: ["super_admin", "foster_coordinator", "veterinarian"],
    });
    return resData;
  },

  // POST /fosters/placements/{placement_id}/progress - Log foster progress report
  logProgress: async (placementId: string, data: Record<string, unknown> | FosterProgressLogPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/progress`, data);
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/progress/weight - Log Weight
  logWeight: async (placementId: string, payload: FosterWeightLogPayload) => {
    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/weight`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.logProgress(placementId, {
          weight_kg: payload.weight_kg,
          notes: payload.notes,
        });
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/behavior - Log Behavior
  logBehavior: async (placementId: string, payload: FosterBehaviorLogPayload) => {
    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/behavior`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.logProgress(placementId, {
          behavior_notes: payload.behavior_notes,
          mood_rating: payload.mood_rating,
          exercise_minutes: payload.exercise_minutes,
          notes: payload.notes,
        });
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/medication - Log Medication Check-in
  logMedication: async (placementId: string, payload: FosterMedicationLogPayload) => {
    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/medication`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.logProgress(placementId, {
          medication_notes: `${payload.medication_notes} (Verified: ${payload.verified ? "Yes" : "No"})`,
          notes: payload.notes,
        });
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/progress/media - Log Media
  logMedia: async (placementId: string, payload: FosterMediaLogPayload) => {
    try {
      const response = await api.post(`/fosters/placements/${placementId}/progress/media`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.logProgress(placementId, {
          photo_urls: payload.photo_urls,
          notes: payload.caption || payload.notes,
        });
      }
      throw err;
    }
  },

  // GET /fosters/placements/{placement_id}/progress
  getProgressLogs: async (placementId: string) => {
    const response = await api.get(`/fosters/placements/${placementId}/progress`);
    return response.data;
  },

  // Background Check Methods
  initiateBackgroundCheck: async (profileId: string, payload: FosterBackgroundCheckInitiatePayload) => {
    try {
      const response = await api.post(`/fosters/${profileId}/background-check/initiate`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.updateProfile(profileId, {
          vetting_notes: `Background check initiated with ${payload.provider || "PawGuard Registry"}. ${payload.notes || ""}`.trim(),
        });
      }
      throw err;
    }
  },

  recordBackgroundCheckOutcome: async (profileId: string, payload: FosterBackgroundCheckOutcomePayload) => {
    try {
      const response = await api.post(`/fosters/${profileId}/background-check/outcome`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const isPassed = payload.outcome === "cleared";
        return fosterService.updateProfile(profileId, {
          background_check_passed: isPassed,
          background_check_notes: `[${payload.outcome.toUpperCase()}] ${payload.notes}`,
          references_checked: payload.references_checked,
          reference_notes: payload.reference_notes,
        });
      }
      throw err;
    }
  },

  // Home Inspection Methods
  scheduleHomeInspection: async (profileId: string, payload: FosterHomeInspectionSchedulePayload) => {
    try {
      const response = await api.post(`/fosters/${profileId}/home-inspection/schedule`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.updateProfile(profileId, {
          home_inspection_address: payload.address,
          home_inspection_notes: `Inspection scheduled for ${payload.scheduled_at} (${payload.inspection_type}). ${payload.notes || ""}`.trim(),
        });
      }
      throw err;
    }
  },

  logHomeInspectionAudit: async (profileId: string, payload: FosterHomeInspectionAuditPayload) => {
    try {
      const response = await api.post(`/fosters/${profileId}/home-inspection/log`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        try {
          const altRes = await api.post(`/fosters/${profileId}/home-inspection/audit`, payload);
          return altRes.data;
        } catch {
          return fosterService.updateProfile(profileId, {
            home_inspection_notes: `Inspection Audit: Yard: ${payload.yard_condition || "N/A"}, Fence: ${payload.fencing_condition || "N/A"}, Hazards: ${payload.hazards || "None"}, Rating: ${payload.rating || 5}/5. ${payload.notes || ""}`.trim(),
          });
        }
      }
      throw err;
    }
  },

  recordHomeInspectionOutcome: async (profileId: string, payload: FosterHomeInspectionOutcomePayload) => {
    try {
      const response = await api.post(`/fosters/${profileId}/home-inspection/outcome`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        return fosterService.updateProfile(profileId, {
          home_inspection_passed: payload.outcome === "approved",
          home_inspection_notes: `[${payload.outcome.toUpperCase()}] ${payload.notes}`,
          home_inspection_address: payload.address,
        });
      }
      throw err;
    }
  },

  // POST /fosters/placements/{placement_id}/supplies - Log supply dispatch
  logSupplyDispatch: async (placementId: string, data: FosterSupplyDispatchPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/supplies`, data);
    return response.data;
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

  // POST /fosters/placements/{placement_id}/convert-to-adopt - Foster to Adopt conversion
  convertToAdopt: async (placementId: string, notes?: string) => {
    const payload = notes ? { notes } : {};
    try {
      const response = await api.post(`/fosters/placements/${placementId}/convert-to-adopt`, payload);
      await publishActionEvent({
        module: "foster",
        action: "approve",
        title: "Foster Placement Converted to Adoption",
        message: `Placement ${placementId} converted into permanent adoption!`,
        targetRoles: ["super_admin", "foster_coordinator", "adoption_coordinator"],
      });
      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      // If 404/405, fallback to alternate registered route aliases
      if (status === 404 || status === 405) {
        try {
          const altRes = await api.post(`/fosters/placements/${placementId}/convert`, payload);
          await publishActionEvent({
            module: "foster",
            action: "approve",
            title: "Foster Placement Converted to Adoption",
            message: `Placement ${placementId} converted into permanent adoption!`,
            targetRoles: ["super_admin", "foster_coordinator", "adoption_coordinator"],
          });
          return altRes.data;
        } catch (altErr: any) {
          if (altErr?.response?.status === 404 || altErr?.response?.status === 405) {
            const singularRes = await api.post(`/foster/placements/${placementId}/convert-to-adopt`, payload);
            await publishActionEvent({
              module: "foster",
              action: "approve",
              title: "Foster Placement Converted to Adoption",
              message: `Placement ${placementId} converted into permanent adoption!`,
              targetRoles: ["super_admin", "foster_coordinator", "adoption_coordinator"],
            });
            return singularRes.data;
          }
          throw altErr;
        }
      }
      // Re-throw genuine errors (including 409 Conflict, 400, 403, 500) directly to caller
      throw err;
    }
  },

  // POST /fosters/bulk/delete
  bulkDeleteProfiles: async (profileIds: string[]) => {
    const response = await api.post("/fosters/bulk/delete", { profile_ids: profileIds });
    return response.data;
  },
};

export default fosterService;
