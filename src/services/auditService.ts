import api from "../api/axios";

export interface AuditLogQueryParams {
  skip?: number;
  limit?: number;
  event_type?: string;
  user_id?: string;
  [key: string]: unknown;
}

export const auditService = {
  // GET /admin/audit-logs (Exact OpenAPI endpoint)
  getAuditLogs: async (params?: AuditLogQueryParams) => {
    const response = await api.get("/admin/audit-logs", { params });
    return response.data;
  },

  // GET /admin/audit-logs/{entry_id} - Get detailed single audit log entry
  getAuditLogById: async (entryId: string) => {
    const response = await api.get(`/admin/audit-logs/${entryId}`);
    return response.data;
  },

  // GET /admin/audit-logs/export - Export audit logs as CSV or JSON
  exportAuditLogs: async (format: "csv" | "json" = "csv", params?: AuditLogQueryParams) => {
    const response = await api.get("/admin/audit-logs/export", {
      params: { ...params, format },
      responseType: format === "csv" ? "blob" : "json",
    });
    return response.data;
  },

  // POST /admin/audit-logs/export - Export audit logs as CSV or JSON via POST
  exportAuditLogsPost: async (format: "csv" | "json" = "csv", params?: AuditLogQueryParams) => {
    const response = await api.post("/admin/audit-logs/export", null, {
      params: { ...params, format },
      responseType: format === "csv" ? "blob" : "json",
    });
    return response.data;
  },
};

export default auditService;
