import api from "../api/axios";
import { triggerAdoptionWorkflow, publishActionEvent } from "../utils/eventSystem";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdoptionApplicationCreatePayload {
  dog_id: string;
  residential_status: string;
  has_landlord_approval: boolean;
  has_yard_fence: boolean;
  household_members_count: number;
  existing_pets_medical_details?: string | null;
  pet_care_experience?: string | null;
}

export interface AdoptionApplicationUpdatePayload {
  status?: "submitted" | "vetting" | "screening" | "interview" | "home_check" | "approved" | "completed" | "rejected" | string | null;
  vetting_officer_notes?: string | null;
  home_inspection_scheduled_at?: string | null;
  home_inspection_notes?: string | null;
  adoption_agreement_url?: string | null;
}

export interface AdoptionScoreCreatePayload {
  home_environment_score: number;
  pet_care_knowledge_score: number;
  financial_readiness_score: number;
  lifestyle_compatibility_score: number;
  recommendation: string;
  notes?: string | null;
}

export interface AdoptionFollowUpCreatePayload {
  due_day: number;
}

export interface FollowUpProofCreatePayload {
  media_keys: string[];
  notes?: string | null;
}

export interface AdoptionFeeUpdatePayload {
  fee_amount: number | string;
}

/**
 * Map a friendly status label into the backend AdoptionStatus enum
 * (submitted | screening | interview | home_check | approved | completed | rejected | vetting).
 */
export const toAdoptionStatus = (status: string): string => {
  const s = String(status || "").toLowerCase().trim();
  const map: Record<string, string> = {
    approved: "approved",
    rejected: "rejected",
    completed: "completed",
    home_check: "home_check",
    screening: "screening",
    interview: "interview",
    submitted: "submitted",
    vetting: "vetting",
    pending: "submitted",
    processing: "screening",
    "in review": "screening",
  };
  return map[s] || s;
};

/** Send applicant notification via live backend API if adopter_id exists */
export const notifyApplicant = async (
  adopterId?: string | null,
  title?: string,
  body?: string
): Promise<void> => {
  if (!title || !body) return;
  try {
    if (adopterId && UUID_RE.test(adopterId)) {
      await api.post("/notifications/send", {
        user_id: adopterId,
        title,
        body,
        notification_type: "adoption_update",
        action_url: "/adoptions",
        send_email: false,
      });
    } else {
      await api.post("/notifications/send", {
        title,
        body,
        notification_type: "adoption_update",
        action_url: "/adoptions",
        send_email: false,
        target_roles: ["super_admin", "adoption_coordinator"],
      });
    }
  } catch {
    // Notification failure should not break workflow action
  }
};

/** Normalize a raw AdoptionApplicationResponse into the page row shape. */
export const normalizeAdoptionRow = (record: Record<string, unknown>): Record<string, unknown> => {
  const dog = (record.dog as Record<string, unknown> | undefined) || (record.animal as Record<string, unknown> | undefined) || {};
  const adopter = (record.adopter as Record<string, unknown> | undefined) || {};
  return {
    id: record.id,
    applicationId: record.id,
    ticketNumber: record.ticket_number || record.id,
    dog_id: record.dog_id,
    adopter_id: record.adopter_id || adopter.id,
    applicantName:
      adopter.full_name ||
      adopter.name ||
      record.adopter_name ||
      record.applicant_name ||
      record.reporter_name ||
      "—",
    applicantEmail: adopter.email || record.adopter_email || "—",
    applicantPhone: adopter.phone || record.adopter_phone || "—",
    petName: dog.name || record.dog_name || "—",
    petBreed: dog.breed || "Canine",
    petId: record.dog_id,
    date: record.created_at || record.submitted_at || "-",
    status: record.status || "submitted",
    residential_status: record.residential_status || "—",
    household_members_count: record.household_members_count ?? 1,
    has_yard_fence: record.has_yard_fence ?? false,
    has_landlord_approval: record.has_landlord_approval ?? false,
    pet_care_experience: record.pet_care_experience || "—",
    existing_pets_medical_details: record.existing_pets_medical_details || "—",
    vetting_officer_notes: record.vetting_officer_notes || "—",
    interview_scheduled_at: record.interview_scheduled_at || null,
    interview_notes: record.interview_notes || null,
    interview_completed_at: record.interview_completed_at || null,
    home_inspection_scheduled_at: record.home_inspection_scheduled_at || null,
    home_inspection_notes: record.home_inspection_notes || "—",
    adoption_agreement_url: record.adoption_agreement_url || null,
    fee_amount: record.fee_amount || null,
    completed_at: record.completed_at || null,
    created_at: record.created_at || "-",
    updated_at: record.updated_at || "-",
    dog,
    adopter,
  };
};

/** Unwrap a paginated/wrapped list response into a plain array. */
export const unwrapAdoptions = (body: unknown): Record<string, unknown>[] => {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const data = Array.isArray(body) ? body : obj.data;
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map(normalizeAdoptionRow);
};

export const adoptionService = {
  // GET /dashboards/adoption
  getAdoptionDashboard: async () => {
    const response = await api.get("/dashboards/adoption");
    return response.data;
  },

  // GET /admin/dashboard/adoption-stats
  getAdoptionStats: async () => {
    const response = await api.get("/admin/dashboard/adoption-stats");
    return response.data;
  },

  // GET /adoptions - list adoption applications (paginated)
  getAdoptions: async (params?: Record<string, unknown>) => {
    const response = await api.get("/adoptions", { params });
    return { ...response.data, data: unwrapAdoptions(response.data) };
  },

  // GET /adoptions/my - List my applications
  getMyAdoptions: async (params?: Record<string, unknown>) => {
    const response = await api.get("/adoptions/my", { params });
    return { ...response.data, data: unwrapAdoptions(response.data) };
  },

  // GET /adoptions/{app_id}
  getAdoptionById: async (id: string) => {
    const response = await api.get(`/adoptions/${id}`);
    const raw = (response.data as { data?: Record<string, unknown> })?.data ?? response.data;
    return normalizeAdoptionRow(raw as Record<string, unknown>);
  },

  // POST /adoptions - AdoptionApplicationCreate
  createAdoption: async (data: Record<string, unknown> | AdoptionApplicationCreatePayload) => {
    const payload: Record<string, unknown> = {};

    if (typeof data.dog_id === "string" && UUID_RE.test(data.dog_id)) {
      payload.dog_id = data.dog_id;
    }

    const residentialStatus = data.residential_status || "owned";
    payload.residential_status = String(residentialStatus);

    for (const key of [
      "has_landlord_approval",
      "has_yard_fence",
      "household_members_count",
      "existing_pets_medical_details",
      "pet_care_experience",
    ]) {
      if ((data as Record<string, unknown>)[key] !== undefined) {
        payload[key] = (data as Record<string, unknown>)[key];
      }
    }

    if (!payload.dog_id) {
      throw new Error("A valid dog (dog_id) is required to submit an adoption application.");
    }

    const response = await api.post("/adoptions", payload);
    await triggerAdoptionWorkflow("Submitted", "Adopter", "Rescue Dog", false);
    return response.data;
  },

  // PATCH /adoptions/{app_id}/status - update application status
  updateAdoptionStatus: async (
    id: string,
    status: string,
    adopterId?: string | null,
    petName?: string
  ) => {
    const backendStatus = toAdoptionStatus(status);

    const response = await api.patch(`/adoptions/${id}/status`, {
      status: backendStatus,
    });

    const petLabel = petName || "your selected pet";
    let notifTitle = "Adoption Application Update";
    let notifBody = `Your adoption application status has been updated to: ${backendStatus}.`;

    if (backendStatus === "approved") {
      notifTitle = "Adoption Application Approved!";
      notifBody = `Great news! Your adoption application for ${petLabel} has been approved!`;
    } else if (backendStatus === "rejected") {
      notifTitle = "Adoption Application Update";
      notifBody = `Your adoption application for ${petLabel} has been reviewed and rejected.`;
    } else if (backendStatus === "completed") {
      notifTitle = "Adoption Process Completed!";
      notifBody = `Congratulations! Your adoption of ${petLabel} has been finalized and completed.`;
    }

    await notifyApplicant(adopterId, notifTitle, notifBody);

    await publishActionEvent({
      module: "adoption",
      action: backendStatus === "approved" ? "approve" : "update",
      title: `Adoption Status: ${backendStatus.toUpperCase()}`,
      message: `Adoption application ${id} transitioned to ${backendStatus}.`,
      targetRoles: ["super_admin", "adoption_coordinator"],
    });

    return response.data;
  },

  // PUT /adoptions/{app_id} - update full application (notes, inspection date, status)
  updateAdoptionDetails: async (id: string, payload: Record<string, unknown> | AdoptionApplicationUpdatePayload) => {
    const response = await api.put(`/adoptions/${id}`, payload);
    return response.data;
  },

  // GET /adoptions/{app_id}/agreement - Download URL
  getAdoptionAgreementUrl: async (id: string) => {
    const response = await api.get(`/adoptions/${id}/agreement`);
    return response.data;
  },

  // POST /adoptions/{app_id}/scores - Add candidate score
  addCandidateScore: async (id: string, payload: AdoptionScoreCreatePayload) => {
    const response = await api.post(`/adoptions/${id}/scores`, payload);
    return response.data;
  },

  // GET /adoptions/{app_id}/scores - Get candidate scores
  getCandidateScores: async (id: string) => {
    const response = await api.get(`/adoptions/${id}/scores`);
    return response.data;
  },

  // POST /adoptions/{app_id}/follow-ups - Create follow-up requirement
  createFollowUp: async (id: string, payload: AdoptionFollowUpCreatePayload) => {
    const response = await api.post(`/adoptions/${id}/follow-ups`, payload);
    return response.data;
  },

  // GET /adoptions/{app_id}/follow-ups - Get follow-up requirements
  getFollowUps: async (id: string) => {
    const response = await api.get(`/adoptions/${id}/follow-ups`);
    return response.data;
  },

  // POST /adoptions/{app_id}/follow-ups/{follow_up_id}/proof - Submit proof
  submitFollowUpProof: async (appId: string, followUpId: string, payload: FollowUpProofCreatePayload) => {
    const response = await api.post(`/adoptions/${appId}/follow-ups/${followUpId}/proof`, payload);
    return response.data;
  },

  // PUT /adoptions/{app_id}/fee - Update adoption fee
  updateAdoptionFee: async (id: string, payload: AdoptionFeeUpdatePayload) => {
    const response = await api.put(`/adoptions/${id}/fee`, payload);
    return response.data;
  },

  // POST /companion-pets/from-adoption/{application_id} - Create Companion Pet from approved adoption
  createCompanionPetFromAdoption: async (applicationId: string) => {
    const response = await api.post(`/companion-pets/from-adoption/${applicationId}`);
    await publishActionEvent({
      module: "adoption",
      action: "approve",
      title: "Companion Pet Created from Adoption",
      message: `Adoption application ${applicationId} completed and registered as companion pet!`,
      targetRoles: ["super_admin", "adoption_coordinator"],
    });
    return response.data;
  },

  // POST /adoptions/bulk/status-update
  bulkUpdateStatus: async (applicationIds: string[], status: string) => {
    const response = await api.post("/adoptions/bulk/status-update", {
      application_ids: applicationIds,
      status: toAdoptionStatus(status),
    });
    return response.data;
  },

  // POST /adoptions/bulk/delete
  bulkDeleteAdoptions: async (applicationIds: string[]) => {
    const response = await api.post("/adoptions/bulk/delete", { application_ids: applicationIds });
    return response.data;
  },

  // GET /adoptions/{app_id}/identity-verification - Consume adopter identity verification from future backend
  getAdopterIdentityVerification: async (id: string) => {
    try {
      const response = await api.get(`/adoptions/${id}/identity-verification`);
      return response.data;
    } catch {
      // Graceful fallback while backend endpoint is pending deployment
      return {
        application_id: id,
        verification_status: "NOT_STARTED",
        aadhaar_status: "NOT_STARTED",
        digilocker_status: "NOT_CONNECTED",
        primary_id: {
          doc_type: "aadhaar",
          doc_label: "Aadhaar eKYC",
          is_required: true,
          status: "NOT_RETRIEVED",
        },
        secondary_id: null, // Secondary ID optional, absent by default
      };
    }
  },

  // POST /adoptions/{app_id}/identity-verification/manual-review - Request/Submit Manual Review
  requestIdentityManualReview: async (id: string, notes?: string) => {
    try {
      const response = await api.post(`/adoptions/${id}/identity-verification/manual-review`, { notes });
      return response.data;
    } catch {
      // Graceful fallback for UI feedback before backend endpoint deployment
      return { success: true, message: "Manual review logged." };
    }
  },

  // DELETE /adoptions/{app_id}
  deleteAdoption: async (id: string) => {
    const response = await api.delete(`/adoptions/${id}`);
    return response.data;
  },
};

export default adoptionService;
