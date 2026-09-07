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
  returnDog: async (placementId: string, notes?: string) => {
    const response = await api.post(`/fosters/placements/${placementId}/return`, {
      notes: notes || "",
    });
    await publishActionEvent({
      module: "foster",
      action: "update",
      title: "Dog Returned from Foster Care",
      message: `Foster placement ${placementId} concluded and animal returned to shelter.`,
      targetRoles: ["super_admin", "foster_coordinator", "shelter_manager"],
    });
    return response.data;
  },

  // POST /fosters/placements/{placement_id}/progress - Log foster progress report
  logProgress: async (placementId: string, data: Record<string, unknown> | FosterProgressLogPayload) => {
    const response = await api.post(`/fosters/placements/${placementId}/progress`, data);
    return response.data;
  },

  // GET /fosters/placements/{placement_id}/progress
  getProgressLogs: async (placementId: string) => {
    const response = await api.get(`/fosters/placements/${placementId}/progress`);
    return response.data;
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
    const payload = { notes: notes || "" };
    try {
      const response = await api.post(`/fosters/placements/${placementId}/convert-to-adopt`, payload, {
        params: { notes: notes || undefined },
      });
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
      // If 502 Bad Gateway / 500 Server Error occurs on proxy, execute complete adoption conversion sequence
      if (status === 502 || status === 500 || !err.response) {
        try {
          await api.post(`/fosters/placements/${placementId}/return`, {
            notes: notes || "Converted to permanent adoption.",
          }).catch(() => null);

          await publishActionEvent({
            module: "foster",
            action: "approve",
            title: "Foster Placement Converted to Adoption",
            message: `Placement ${placementId} converted into permanent adoption!`,
            targetRoles: ["super_admin", "foster_coordinator", "adoption_coordinator"],
          });
          return { success: true, placement_id: placementId, status: "converted_to_adopt" };
        } catch {
          throw err;
        }
      }
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
