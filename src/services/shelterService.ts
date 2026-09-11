import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export type FacilityType = "shelter" | "clinic" | "foster_home" | "partner";
export type FacilityStatus = "active" | "inactive" | "maintenance";
export type SectionType =
  | "quarantine"
  | "isolation"
  | "surgical"
  | "puppy"
  | "general"
  | "adoption";

export type KennelSanitationState =
  | "clean"
  | "needs_cleaning"
  | "disinfecting"
  | "out_of_service";

export interface ShelterFacilityPayload {
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  total_capacity?: number;
  facility_type?: FacilityType;
}

export interface SectionPayload {
  name: string;
  section_type?: SectionType;
  capacity?: number;
}

export interface KennelPayload {
  identifier: string;
  capacity?: number;
}

export interface CleaningLogPayload {
  sanitation_state_after?: KennelSanitationState;
  cleaning_method?: string;
  notes?: string;
}

export interface CareLogPayload {
  dog_id: string;
  log_type: string;
  notes: string;
}

export interface KennelAssignmentRequest {
  emergency_override?: boolean;
  override_notes?: string;
}

export interface ShelterVetCheckRequest {
  vet_id: string;
  reason: string;
  notes?: string;
  urgency?: "routine" | "urgent" | "emergency";
}

export interface ShelterVetRequestListResponse {
  [key: string]: any;
  id: string;
  dog_id: string;
  dog_name?: string;
  shelter_facility_id: string;
  shelter_facility_name?: string;
  vet_id: string;
  vet_name?: string;
  requested_by_id: string;
  requester_name?: string;
  reason: string;
  notes?: string | null;
  urgency: "routine" | "urgent" | "emergency";
  status: "pending" | "in_progress" | "completed" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface ShelterMedicalRequestStatusUpdate {
  status: "pending" | "in_progress" | "completed" | "rejected" | "cancelled";
}

export const shelterService = {
  // GET /dashboards/shelter - Aggregate Dashboard Data
  getShelterDashboard: async () => {
    const response = await api.get("/dashboards/shelter");
    return response.data;
  },

  // GET /admin/dashboard/shelter-stats - Admin Shelter Statistics
  getShelterStats: async () => {
    const response = await api.get("/admin/dashboard/shelter-stats");
    return response.data;
  },

  // GET /shelter/facilities (paginated, with search & filters)
  getShelters: async (params?: Record<string, unknown>) => {
    const response = await api.get("/shelter/facilities", { params });
    return response.data;
  },

  // POST /shelter/facilities - ShelterFacilityCreate { name, address, phone, ... }
  createShelter: async (data: ShelterFacilityPayload) => {
    const response = await api.post("/shelter/facilities", data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "New Shelter Facility Added",
      message: `Facility "${data.name}" registered with capacity ${data.total_capacity ?? "unspecified"}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // GET /shelter/facilities/{facility_id}
  getShelterById: async (facilityId: string) => {
    const response = await api.get(`/shelter/facilities/${facilityId}`);
    return response.data;
  },

  // PUT /shelter/facilities/{facility_id} - ShelterFacilityUpdate
  updateFacility: async (facilityId: string, data: Partial<ShelterFacilityPayload> & { status?: FacilityStatus }) => {
    const response = await api.put(`/shelter/facilities/${facilityId}`, data);
    await publishActionEvent({
      module: "shelter",
      action: "update",
      title: "Shelter Facility Updated",
      message: `Facility details updated for ${data.name || facilityId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // DELETE /shelter/facilities/{facility_id}
  deleteFacility: async (facilityId: string) => {
    const response = await api.delete(`/shelter/facilities/${facilityId}`);
    await publishActionEvent({
      module: "shelter",
      action: "delete",
      title: "Shelter Facility Removed",
      message: `Facility ${facilityId} removed from shelter directory.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // PUT /shelter/facilities/{facility_id}/status - FacilityStatusUpdate
  updateFacilityStatus: async (facilityId: string, status: FacilityStatus) => {
    const response = await api.put(`/shelter/facilities/${facilityId}/status`, { status });
    return response.data;
  },

  // POST /shelter/facilities/bulk/delete
  bulkDeleteFacilities: async (facilityIds: string[]) => {
    const response = await api.post("/shelter/facilities/bulk/delete", {
      ids: facilityIds,
      facility_ids: facilityIds,
    });
    return response.data;
  },

  // POST /shelter/facilities/bulk/status
  bulkUpdateFacilityStatus: async (facilityIds: string[], status: FacilityStatus) => {
    const response = await api.post("/shelter/facilities/bulk/status", {
      ids: facilityIds,
      facility_ids: facilityIds,
      status,
    });
    return response.data;
  },

  // POST /shelter/facilities/{facility_id}/sections - ShelterSectionCreate
  createFacilitySection: async (facilityId: string, data: SectionPayload) => {
    const response = await api.post(`/shelter/facilities/${facilityId}/sections`, data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "Shelter Section Created",
      message: `Section "${data.name}" (${data.section_type || "general"}) added.`,
      targetRoles: ["super_admin", "shelter_manager"],
    });
    return response.data;
  },

  // GET /shelter/facilities/{facility_id}/sections
  getFacilitySections: async (facilityId: string) => {
    const response = await api.get(`/shelter/facilities/${facilityId}/sections`);
    return response.data;
  },

  // POST /shelter/sections/{section_id}/kennels - KennelCreate
  createSectionKennel: async (sectionId: string, data: KennelPayload) => {
    const response = await api.post(`/shelter/sections/${sectionId}/kennels`, data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "New Kennel Added",
      message: `Kennel unit "${data.identifier}" registered.`,
      targetRoles: ["super_admin", "shelter_manager"],
    });
    return response.data;
  },

  // GET /shelter/sections/{section_id}/kennels
  getSectionKennels: async (sectionId: string) => {
    const response = await api.get(`/shelter/sections/${sectionId}/kennels`);
    return response.data;
  },

  // PATCH /shelter/kennels/{kennel_id}/assign/{dog_id} (primary) with POST fallback
  assignDogToKennel: async (
    kennelId: string,
    dogId: string,
    payload?: KennelAssignmentRequest
  ) => {
    const body = payload && Object.keys(payload).length > 0 ? payload : {};
    try {
      const response = await api.patch(
        `/shelter/kennels/${kennelId}/assign/${dogId}`,
        body
      );
      await publishActionEvent({
        module: "shelter",
        action: "update",
        title: "Animal Assigned to Kennel",
        message: `Animal ${dogId} assigned to kennel ${kennelId}.`,
        targetRoles: ["super_admin", "shelter_manager", "rescue_centre_admin"],
      });
      return response.data;
    } catch (patchErr: any) {
      if (patchErr?.response?.status === 403 || patchErr?.response?.status === 422) {
        throw patchErr;
      }
      try {
        const fallback = await api.post(
          `/shelter/kennels/${kennelId}/assign/${dogId}`,
          body
        );
        return fallback.data;
      } catch {
        throw patchErr;
      }
    }
  },

  // PUT /shelter/kennels/{kennel_id}/sanitation (marks sanitized/clean)
  updateKennelSanitation: async (kennelId: string) => {
    const response = await api.put(`/shelter/kennels/${kennelId}/sanitation`);
    return response.data;
  },

  // GET /shelter/kennels/{kennel_id}/cleaning-logs
  getKennelCleaningLogs: async (kennelId: string, params?: Record<string, unknown>) => {
    const response = await api.get(`/shelter/kennels/${kennelId}/cleaning-logs`, { params });
    return response.data;
  },

  // POST /shelter/kennels/{kennel_id}/cleaning-logs
  createKennelCleaningLog: async (kennelId: string, data: CleaningLogPayload) => {
    const response = await api.post(`/shelter/kennels/${kennelId}/cleaning-logs`, data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "Kennel Cleaning Logged",
      message: `Kennel ${kennelId} status set to ${data.sanitation_state_after || "clean"}.`,
      targetRoles: ["super_admin", "shelter_manager"],
    });
    return response.data;
  },

  // GET /shelter/transfers
  getTransfers: async (params?: Record<string, unknown>) => {
    const response = await api.get("/shelter/transfers", { params });
    return response.data;
  },

  // GET /shelter/transfers/{transfer_id}
  getTransferById: async (transferId: string) => {
    const response = await api.get(`/shelter/transfers/${transferId}`);
    return response.data;
  },

  // POST /shelter/transfers - FacilityTransferCreate
  createTransfer: async (data: {
    dog_id: string;
    from_facility_id: string;
    to_facility_id: string;
    notes?: string;
  }) => {
    const response = await api.post("/shelter/transfers", data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "Shelter Placement Requested",
      message: `Placement requested for animal ${data.dog_id} to facility ${data.to_facility_id}.`,
      targetRoles: ["super_admin", "shelter_manager", "rescue_centre_admin"],
    });
    return response.data;
  },

  // POST /shelter/transfers/{transfer_id}/confirm-sender
  confirmTransferSender: async (transferId: string) => {
    const response = await api.post(`/shelter/transfers/${transferId}/confirm-sender`);
    await publishActionEvent({
      module: "shelter",
      action: "approve",
      title: "Sender Confirmed Placement",
      message: `Sender facility confirmed handover for placement ${transferId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // POST /shelter/transfers/{transfer_id}/confirm-receiver
  confirmTransferReceiver: async (transferId: string) => {
    const response = await api.post(`/shelter/transfers/${transferId}/confirm-receiver`);
    await publishActionEvent({
      module: "shelter",
      action: "approve",
      title: "Receiver Confirmed Placement",
      message: `Receiver facility confirmed placement ${transferId}.`,
      targetRoles: ["super_admin", "shelter_manager", "rescue_centre_admin"],
    });
    return response.data;
  },

  // POST /shelter/care-logs
  createCareLog: async (data: CareLogPayload) => {
    const response = await api.post("/shelter/care-logs", data);
    return response.data;
  },

  // GET /shelter/dogs/{dog_id}/care-logs
  getCareLogs: async (dogId: string) => {
    const response = await api.get(`/shelter/dogs/${dogId}/care-logs`);
    return response.data;
  },

  // POST /shelter/dogs/{dog_id}/request-vet-check
  requestVetCheck: async (dogId: string, data: ShelterVetCheckRequest) => {
    const response = await api.post(`/shelter/dogs/${dogId}/request-vet-check`, data);
    return response.data;
  },

  // GET /shelter/medical-requests
  getMedicalRequests: async (params?: { status?: string }) => {
    const response = await api.get("/shelter/medical-requests", { params });
    return response.data;
  },

  // PATCH /shelter/medical-requests/{request_id}/status
  updateMedicalRequestStatus: async (requestId: string, status: string) => {
    const response = await api.patch(`/shelter/medical-requests/${requestId}/status`, { status });
    await publishActionEvent({
      module: "shelter",
      action: "update",
      title: "Medical Request Status Updated",
      message: `Shelter veterinary check request ${requestId} updated to ${status}.`,
      targetRoles: ["super_admin", "veterinarian", "shelter_manager", "rescue_centre_admin"],
    });
    return response.data;
  },
};

export default shelterService;
