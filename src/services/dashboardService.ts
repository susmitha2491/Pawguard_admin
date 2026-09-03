import api from "../api/axios";

export const dashboardService = {
  // GET /admin/dashboard/summary (Exact OpenAPI endpoint for Super Admin Dashboard)
  getSuperAdminDashboard: async () => {
    const response = await api.get("/admin/dashboard/summary");
    return response.data;
  },

  // Backwards compatibility alias for Super Admin Dashboard
  getDashboardStats: async () => {
    const response = await api.get("/admin/dashboard/summary");
    return response.data;
  },

  // GET /admin/dashboard/recent-activity (Exact OpenAPI endpoint)
  getRecentActivities: async (limit: number = 20) => {
    const response = await api.get("/admin/dashboard/recent-activity", { params: { limit } });
    return response.data;
  },

  // GET /admin/audit-logs (Exact OpenAPI endpoint)
  getAuditLogs: async (params?: Record<string, unknown>) => {
    const response = await api.get("/admin/audit-logs", { params });
    return response.data;
  },

  // GET /dashboards/rescue (Exact OpenAPI endpoint)
  getRescueCentreDashboard: async (params?: Record<string, unknown>) => {
    const response = await api.get("/dashboards/rescue", { params });
    return response.data;
  },

  getRescueDashboard: async (params?: Record<string, unknown>) => {
    const response = await api.get("/dashboards/rescue", { params });
    return response.data;
  },

  // GET /dashboards/medical (Exact OpenAPI endpoint)
  getVeterinarianDashboard: async () => {
    const response = await api.get("/dashboards/medical");
    return response.data;
  },

  getMedicalDashboard: async () => {
    const response = await api.get("/dashboards/medical");
    return response.data;
  },

  // GET /dashboards/shelter (Exact OpenAPI endpoint)
  getShelterDashboard: async () => {
    const response = await api.get("/dashboards/shelter");
    return response.data;
  },

  // GET /dashboards/adoption (Exact OpenAPI endpoint)
  getAdoptionDashboard: async () => {
    const response = await api.get("/dashboards/adoption");
    return response.data;
  },

  // GET /dashboards/foster (Exact OpenAPI endpoint)
  getFosterDashboard: async () => {
    const response = await api.get("/dashboards/foster");
    return response.data;
  },

  // GET /dashboards/volunteer (Exact OpenAPI endpoint)
  getVolunteerDashboard: async () => {
    const response = await api.get("/dashboards/volunteer");
    return response.data;
  },

  // GET /dashboards/inventory (Exact OpenAPI endpoint)
  getInventoryDashboard: async () => {
    const response = await api.get("/dashboards/inventory");
    return response.data;
  },

  // GET /dashboards/finance (Exact OpenAPI endpoint)
  getFinanceDashboard: async () => {
    const response = await api.get("/dashboards/finance");
    return response.data;
  },

  // GET /dashboards/staff (Exact OpenAPI endpoint)
  getStaffDashboard: async () => {
    const response = await api.get("/dashboards/staff");
    return response.data;
  },

  // GET /dashboards/executive (Exact OpenAPI endpoint)
  getExecutiveDashboard: async () => {
    const response = await api.get("/dashboards/executive");
    return response.data;
  },

  // GET /dashboards/public (Exact OpenAPI endpoint)
  getPublicDashboard: async () => {
    const response = await api.get("/dashboards/public");
    return response.data;
  },

  // GET /dashboards/operations (Exact OpenAPI endpoint)
  getOperationsDashboard: async () => {
    const response = await api.get("/dashboards/operations");
    return response.data;
  },
};

export default dashboardService;