import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";
import { unwrapList } from "../utils/chartUtils";

export interface RescueCasePayload {
  id?: string;
  case_number?: string;
  dog_name?: string;
  location?: string;
  urgency_level?: string;
  status?: string;
  assigned_agent?: string;
  reporter_name?: string;
  reporter_phone?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface DispatchPayload {
  id?: string;
  case_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  agent_id?: string;
  agent_ids?: string[];
  assigned_vehicle_id?: string;
  dispatch_time?: string;
  status?: string;
  notes?: string;
  [key: string]: unknown;
}

export const rescueService = {
  getRescueCases: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue", { params });
    return response.data;
  },

  // GET /rescue — fetch page 1 without multi-page sequential loops
  getAllRescueCases: async (params?: Record<string, unknown>) => {
    const pageSize = (params?.page_size as number) || 50;
    try {
      const firstParams = { page: 1, page_size: pageSize, ...params };
      const response = await api.get("/rescue", { params: firstParams });
      const firstBody = response.data;
      const collected = unwrapList(firstBody);
      return { success: true, data: collected, meta: firstBody?.meta };
    } catch (err) {
      console.error("getAllRescueCases error:", err);
      return { success: false, data: [], meta: { total: 0 } };
    }
  },

  getRescueCaseById: async (requestId: string) => {
    const response = await api.get(`/rescue/${requestId}`);
    return response.data;
  },

  // POST /rescue/report - RescueRequestCreate
  createRescueCase: async (data: RescueCasePayload) => {
    const response = await api.post("/rescue/report", data);
    await publishActionEvent({
      module: "rescue",
      action: "create",
      title: "New Rescue Incident Reported",
      message: `Rescue incident reported for ${data.dog_name || "dog"} at ${data.location || "field location"}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // POST /rescue/{request_id}/verify - RescueRequestUpdate
  // The backend only supports {status, rejection_rationale, severity, is_urgent, media_evidence}.
  updateRescueCase: async (requestId: string, data: Partial<RescueCasePayload>) => {
    const payload: Record<string, unknown> = {};
    if (data.status) payload.status = data.status;
    if (data.severity !== undefined && data.severity !== null && data.severity !== "") {
      payload.severity = String(data.severity).toLowerCase();
    }
    if (typeof data.is_urgent === "boolean") payload.is_urgent = data.is_urgent;
    if (data.assigned_agent_id) payload.assigned_agent_id = data.assigned_agent_id;
    if (data.assigned_agent_name) payload.assigned_agent_name = data.assigned_agent_name;
    if (data.assigned_vehicle_id) payload.assigned_vehicle_id = data.assigned_vehicle_id;
    if (data.assigned_vehicle_number) payload.assigned_vehicle_number = data.assigned_vehicle_number;

    const response = await api.post(`/rescue/${requestId}/verify`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Rescue Incident Updated",
      message: `Rescue case ${requestId} updated (${payload.severity || "no change"} severity${typeof payload.is_urgent === "boolean" ? `, urgent: ${payload.is_urgent}` : ""}).`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator"],
    });
    return response.data;
  },

  acceptRescueRequest: async (requestId: string, agentId: string, agentName?: string) => {
    // Instead of calling verify with status: "accepted" (which fails validation),
    // we assign the coordinator. The frontend maps verified + assigned coordinator to accepted.
    const response = await api.post(`/rescue/${requestId}/assign-coordinator`, {
      coordinator_id: agentId,
    });
    await publishActionEvent({
      module: "rescue",
      action: "approve",
      title: "Rescue Request Accepted",
      message: `Rescue request ${requestId} accepted by coordinator/agent ${agentName || agentId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  acceptDispatch: async (requestId: string) => {
    const response = await api.post(`/rescue/${requestId}/accept`);
    return response.data;
  },

  // POST /rescue/{request_id}/assign-coordinator - RescueAssignCoordinator
  // Assigns a rescue coordinator to own/track this case (PRR 3.2).
  assignCoordinator: async (requestId: string, coordinatorId: string, notes?: string) => {
    const payload: Record<string, unknown> = { coordinator_id: coordinatorId };
    if (notes) payload.notes = notes;
    const response = await api.post(`/rescue/${requestId}/assign-coordinator`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "assign",
      title: "Rescue Coordinator Assigned",
      message: `Coordinator assigned to rescue case ${requestId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator"],
    });
    return response.data;
  },

  updateRescueStatus: async (requestId: string, status: string) => {
    const response = await api.post(`/rescue/${requestId}/verify`, { status });
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Rescue Status Verified",
      message: `Rescue incident ${requestId} verified with status: ${status}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator"],
    });
    return response.data;
  },

  deleteRescueCase: async (id: string) => {
    const response = await api.delete(`/rescue/${id}`);
    await publishActionEvent({
      module: "rescue",
      action: "delete",
      title: "Rescue Record Archived",
      message: `Rescue case record ${id} removed from active system.`,
      targetRoles: ["super_admin", "rescue_centre_admin"],
    });
    return response.data;
  },

  // Rescue Requests (same GET /rescue source)
  getRescueRequests: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue", { params });
    return response.data;
  },

  createRescueRequest: async (data: Record<string, unknown>) => {
    const response = await api.post("/rescue/report", data);
    await publishActionEvent({
      module: "rescue",
      action: "create",
      title: "Public Rescue Request Submitted",
      message: `Emergency rescue request logged from field reporter.`,
      targetRoles: ["super_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  approveRescueRequest: async (
    requestId: string,
    data?: {
      status?: string;
      severity?: string;
      is_urgent?: boolean;
      rejection_rationale?: string;
      media_evidence?: string[];
    }
  ) => {
    const payload: Record<string, unknown> = {
      status: data?.status || "verified",
    };
    if (data?.severity) payload.severity = String(data.severity).toLowerCase();
    if (typeof data?.is_urgent === "boolean") payload.is_urgent = data.is_urgent;
    if (data?.rejection_rationale) payload.rejection_rationale = data.rejection_rationale;
    if (Array.isArray(data?.media_evidence)) payload.media_evidence = data.media_evidence;

    const response = await api.post(`/rescue/${requestId}/verify`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "approve",
      title: "Rescue Request Approved",
      message: `Rescue request ${requestId} approved and dispatched for field response.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  rejectRescueRequest: async (requestId: string, reason?: string) => {
    // POST /rescue/{request_id}/fail expects `failure_reason` as a required
    // query parameter (no request body) per the backend OpenAPI spec.
    const response = await api.post(`/rescue/${requestId}/fail`, null, {
      params: { failure_reason: reason || "" },
    });
    await publishActionEvent({
      module: "rescue",
      action: "reject",
      title: "Rescue Request Closed",
      message: `Rescue request ${requestId} reviewed and closed.`,
      targetRoles: ["super_admin", "rescue_coordinator"],
    });
    return response.data;
  },

  // GET /rescue/dispatches - RescueDispatchResponse (real backend endpoint)
  getDispatches: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue/dispatches", { params });
    return response.data;
  },

  getAllDispatches: async (params?: Record<string, unknown>) => {
    const pageSize = (params?.page_size as number) || 50;
    try {
      const firstParams = { page: 1, page_size: pageSize, ...params };
      const response = await api.get("/rescue/dispatches", { params: firstParams });
      const firstBody = response.data;
      const collected = unwrapList(firstBody);
      return { success: true, data: collected, meta: firstBody?.meta };
    } catch (err) {
      console.error("getAllDispatches error:", err);
      return { success: false, data: [], meta: { total: 0 } };
    }
  },

  // GET /rescue/dispatches/{dispatch_id}
  getRescueDispatchById: async (dispatchId: string) => {
    const response = await api.get(`/rescue/dispatches/${dispatchId}`);
    return response.data;
  },

  // POST /rescue/{request_id}/dispatch - RescueDispatchCreate
  createDispatch: async (data: DispatchPayload) => {
    const requestId = data.case_id;
    if (!requestId) {
      throw new Error("A target rescue case (case_id) is required to dispatch a team.");
    }
    const payload: Record<string, unknown> = {};
    if (data.assigned_vehicle_id) payload.assigned_vehicle_id = data.assigned_vehicle_id;
    else if (data.vehicle_id) payload.assigned_vehicle_id = data.vehicle_id;
    if (data.driver_id) payload.assigned_driver_id = data.driver_id;
    const agentIds = data.agent_ids && data.agent_ids.length > 0 ? data.agent_ids : data.agent_id ? [data.agent_id] : [];
    if (agentIds.length > 0) payload.assigned_agent_ids = agentIds;
    if (data.notes) payload.equipment_details = data.notes;

    const response = await api.post(`/rescue/${requestId}/dispatch`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "assign",
      title: "Rescue Vehicle Dispatched",
      message: `Dispatch team assigned for rescue request ${requestId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // PATCH /rescue/dispatch/{dispatch_id} - RescueDispatchUpdate
  updateDispatchStatus: async (dispatchId: string, status: string) => {
    const response = await api.patch(`/rescue/dispatch/${dispatchId}`, {
      status: String(status || "").toLowerCase(),
    });
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Dispatch Progress Updated",
      message: `Field agent confirmed status update for dispatch ${dispatchId}.`,
      targetRoles: ["super_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  updateDispatch: async (dispatchId: string, payload: Record<string, unknown>) => {
    const response = await api.patch(`/rescue/dispatch/${dispatchId}`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Dispatch Updated",
      message: `Dispatch ${dispatchId} details updated.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  startTracking: async (requestId: string) => {
    const response = await api.post(`/rescue/${requestId}/tracking/start`);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "GPS Tracking Started",
      message: `GPS tracking started for rescue case ${requestId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  stopTracking: async (requestId: string) => {
    const response = await api.post(`/rescue/${requestId}/tracking/stop`);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "GPS Tracking Stopped",
      message: `GPS tracking stopped for rescue case ${requestId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // GET /rescue/agents/location - Live Field Agent GPS Locations (PRR 3.2 & 3.4)
  getAgentLocations: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue/agents/location", { params });
    return response.data;
  },

  // GET /rescue/{request_id}/location - Real-Time Case GPS Location
  getCaseLocation: async (requestId: string) => {
    const response = await api.get(`/rescue/${requestId}/location`);
    return response.data;
  },

  // GET /rescue/{request_id}/suggest-agents - Nearest Agent GPS Suggestions (PRR 3.2)
  suggestNearestAgents: async (requestId: string, radiusKm: number = 50) => {
    const response = await api.get(`/rescue/${requestId}/suggest-agents`, {
      params: { radius: radiusKm },
    });
    return response.data;
  },

  // GET /rescue/agents/availability - Available Rescue Agents
  getAgentAvailability: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue/agents/availability", { params });
    return response.data;
  },

  // GET /rescue/vehicles/availability - Available Fleet Vehicles
  getVehicleAvailability: async (params?: Record<string, unknown>) => {
    const response = await api.get("/rescue/vehicles/availability", { params });
    return response.data;
  },


  // POST /rescue/{request_id}/escalate - RescueEscalateCreate (PRR 3.3)
  escalateRescue: async (requestId: string, escalationType: string, notes?: string) => {
    const payload: Record<string, unknown> = { escalation_type: escalationType };
    if (notes) payload.escalation_notes = notes;
    const response = await api.post(`/rescue/${requestId}/escalate`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Rescue Case Escalated",
      message: `Rescue case ${requestId} escalated (${escalationType}).`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // POST /rescue/{request_id}/located
  markRescueLocated: async (requestId: string) => {
    const response = await api.post(`/rescue/${requestId}/located`);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Dog Located",
      message: `Rescue case ${requestId} marked as located by field team.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // POST /rescue/{request_id}/secured
  markRescueSecured: async (requestId: string) => {
    const response = await api.post(`/rescue/${requestId}/secured`);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Dog Secured",
      message: `Rescue case ${requestId} marked as secured by field team.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },

  // POST /rescue/{request_id}/admitted - RescueReportCreate
  markRescueAdmitted: async (requestId: string, notes?: string) => {
    const payload: Record<string, unknown> = {};
    if (notes) payload.notes = notes;
    const response = await api.post(`/rescue/${requestId}/admitted`, payload);
    await publishActionEvent({
      module: "rescue",
      action: "update",
      title: "Dog Admitted",
      message: `Rescue case ${requestId} admitted to the rescue centre.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "rescue_coordinator", "rescue_agent"],
    });
    return response.data;
  },
};

export default rescueService;
