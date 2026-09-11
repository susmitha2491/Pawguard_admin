import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const unwrapList = (res: unknown): Record<string, unknown>[] => {
  const body = asRecord(res).data;
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const inner = asRecord(body).data;
  return Array.isArray(inner) ? (inner as Record<string, unknown>[]) : [];
};

const unwrapData = (res: unknown): Record<string, unknown> => {
  const body = asRecord(res).data;
  if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  return asRecord(body);
};

export interface VetClinicPayload {
  name: string;
  address: string;
  phone: string;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_emergency?: boolean;
  services?: string | null;
  is_active?: boolean;
}

export interface PartnerClinicPayload {
  name: string;
  address: string;
  phone: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  is_emergency?: boolean;
  services?: string;
  is_active?: boolean;
}

export const vetService = {
  // GET /companion-pets/clinics - list active veterinary clinics
  getClinics: async (params?: Record<string, unknown>) => {
    const response = await api.get("/companion-pets/clinics", { params });
    return {
      data: unwrapList(response),
      meta: asRecord(response).meta,
    };
  },

  // GET /companion-pets/clinics/{clinic_id} - get single clinic by ID
  getClinicById: async (clinicId: string) => {
    const response = await api.get(`/companion-pets/clinics/${clinicId}`);
    return unwrapData(response);
  },

  // POST /companion-pets/clinics - create veterinary clinic
  createClinic: async (payload: VetClinicPayload) => {
    const response = await api.post("/companion-pets/clinics", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Veterinary Clinic Registered",
      message: `Clinic "${payload.name}" was registered in the veterinary directory.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin"],
    });
    return unwrapData(response);
  },

  // PATCH /companion-pets/clinics/{clinic_id} - update veterinary clinic
  updateClinic: async (clinicId: string, payload: Partial<VetClinicPayload>) => {
    const response = await api.patch(`/companion-pets/clinics/${clinicId}`, payload);
    await publishActionEvent({
      module: "medical",
      action: "update",
      title: "Veterinary Clinic Updated",
      message: `Clinic details for "${payload.name || clinicId}" were updated.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin"],
    });
    return unwrapData(response);
  },

  // DELETE /companion-pets/clinics/{clinic_id} - delete veterinary clinic
  deleteClinic: async (clinicId: string) => {
    const response = await api.delete(`/companion-pets/clinics/${clinicId}`);
    await publishActionEvent({
      module: "medical",
      action: "delete",
      title: "Veterinary Clinic Removed",
      message: `Clinic ${clinicId} was removed from the veterinary directory.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin"],
    });
    return unwrapData(response);
  },

  // GET /companion-pets/appointments - list authorized veterinary appointments
  getAppointments: async (params?: Record<string, unknown>) => {
    const response = await api.get("/companion-pets/appointments", { params });
    return {
      data: unwrapList(response),
      meta: asRecord(response).meta,
    };
  },

  // POST /companion-pets/appointments - book a veterinary appointment
  bookAppointment: async (data: Record<string, unknown>) => {
    const response = await api.post("/companion-pets/appointments", data);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Veterinary Appointment Booked",
      message: `Appointment booked for pet ${String(data.pet_id ?? "")} at clinic ${String(data.clinic_id ?? "")}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
    });
    return unwrapData(response);
  },

  // POST /companion-pets/appointments/{appointment_id}/cancel
  cancelAppointment: async (appointmentId: string, reason?: string) => {
    const response = await api.post(`/companion-pets/appointments/${appointmentId}/cancel`, {
      reason: reason || null,
    });
    await publishActionEvent({
      module: "medical",
      action: "update",
      title: "Veterinary Appointment Cancelled",
      message: `Appointment ${appointmentId} cancelled${reason ? ` (${reason})` : ""}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
    });
    return unwrapData(response);
  },

  // POST /companion-pets/appointments/{appointment_id}/confirm
  confirmAppointment: async (appointmentId: string) => {
    const response = await api.post(`/companion-pets/appointments/${appointmentId}/confirm`);
    await publishActionEvent({
      module: "medical",
      action: "approve",
      title: "Veterinary Appointment Confirmed",
      message: `Appointment ${appointmentId} confirmed by clinic staff.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
    });
    return unwrapData(response);
  },

  // POST /companion-pets/appointments/{appointment_id}/complete
  completeAppointment: async (appointmentId: string, notes?: string) => {
    try {
      const response = await api.post(`/companion-pets/appointments/${appointmentId}/complete`, { notes });
      await publishActionEvent({
        module: "medical",
        action: "update",
        title: "Veterinary Appointment Completed",
        message: `Appointment ${appointmentId} completed by attending veterinarian.`,
        targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
      });
      return unwrapData(response);
    } catch {
      return vetService.confirmAppointment(appointmentId);
    }
  },

  // GET /companion-pets/clinics/{clinic_id}/veterinarians - list veterinarians for a clinic
  getClinicVeterinarians: async (clinicId: string) => {
    const response = await api.get(`/companion-pets/clinics/${clinicId}/veterinarians`);
    return {
      data: unwrapList(response),
      meta: asRecord(response).meta,
    };
  },

  // GET /portal/veterinary-network (or /portal/admin/veterinary-network)
  getPartnerVeterinaryNetwork: async (params?: Record<string, unknown>) => {
    try {
      const response = await api.get("/portal/veterinary-network", { params });
      return {
        data: unwrapList(response),
        meta: asRecord(response).meta,
      };
    } catch {
      const response = await api.get("/portal/admin/veterinary-network", { params });
      return {
        data: unwrapList(response),
        meta: asRecord(response).meta,
      };
    }
  },

  // POST /portal/admin/veterinary-network
  createPartnerClinic: async (payload: PartnerClinicPayload) => {
    const response = await api.post("/portal/admin/veterinary-network", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "New Partner Clinic Registered",
      message: `Clinic "${payload.name}" added to partner network directory.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin"],
    });
    return unwrapData(response);
  },

  // PUT /portal/admin/veterinary-network/{partner_id}
  updatePartnerClinic: async (partnerId: string, payload: Partial<PartnerClinicPayload>) => {
    const response = await api.put(`/portal/admin/veterinary-network/${partnerId}`, payload);
    return unwrapData(response);
  },

  // DELETE /portal/admin/veterinary-network/{partner_id}
  deletePartnerClinic: async (partnerId: string) => {
    const response = await api.delete(`/portal/admin/veterinary-network/${partnerId}`);
    return unwrapData(response);
  },
};

export default vetService;