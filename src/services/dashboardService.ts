import api from "../api/axios";

export const dashboardService = {
  // GET /admin/dashboard/summary (Exact OpenAPI endpoint for Super Admin Dashboard)
  getSuperAdminDashboard: async () => {
    const response = await api.get("/admin/dashboard/summary");
    return response.data?.data ?? response.data;
  },

  // Backwards compatibility alias for Super Admin Dashboard
  getDashboardStats: async () => {
    const response = await api.get("/admin/dashboard/summary");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/kpis (Exact OpenAPI endpoint)
  getDashboardKpis: async () => {
    const response = await api.get("/admin/dashboard/kpis");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/charts (Exact OpenAPI endpoint)
  getDashboardCharts: async () => {
    const response = await api.get("/admin/dashboard/charts");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/metrics (Exact OpenAPI endpoint)
  getDashboardMetrics: async () => {
    const response = await api.get("/admin/dashboard/metrics");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/recent-activity (Exact OpenAPI endpoint)
  getRecentActivities: async (limit: number = 20) => {
    const response = await api.get("/admin/dashboard/recent-activity", { params: { limit } });
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/inventory-alerts (Exact OpenAPI endpoint)
  getInventoryAlerts: async () => {
    const response = await api.get("/admin/dashboard/inventory-alerts");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/donation-summary (Exact OpenAPI endpoint)
  getDonationSummary: async () => {
    const response = await api.get("/admin/dashboard/donation-summary");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/rescue-stats (Exact OpenAPI endpoint)
  getRescueStats: async () => {
    const response = await api.get("/admin/dashboard/rescue-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/medical-stats (Exact OpenAPI endpoint)
  getMedicalStats: async () => {
    const response = await api.get("/admin/dashboard/medical-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/adoption-stats (Exact OpenAPI endpoint)
  getAdoptionStats: async () => {
    const response = await api.get("/admin/dashboard/adoption-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/volunteer-stats (Exact OpenAPI endpoint)
  getVolunteerStats: async () => {
    const response = await api.get("/admin/dashboard/volunteer-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/notification-summary (Exact OpenAPI endpoint)
  getNotificationSummary: async () => {
    const response = await api.get("/admin/dashboard/notification-summary");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/shelter-stats (Exact OpenAPI endpoint)
  getShelterStats: async () => {
    const response = await api.get("/admin/dashboard/shelter-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/foster-stats (Exact OpenAPI endpoint)
  getFosterStats: async () => {
    const response = await api.get("/admin/dashboard/foster-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/lost-found-stats (Exact OpenAPI endpoint)
  getLostFoundStats: async () => {
    const response = await api.get("/admin/dashboard/lost-found-stats");
    return response.data?.data ?? response.data;
  },

  // GET /admin/dashboard/grievance-stats (Exact OpenAPI endpoint)
  getGrievanceStats: async () => {
    const response = await api.get("/admin/dashboard/grievance-stats");
    return response.data?.data ?? response.data;
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

  // GET /dashboards/donor (Exact OpenAPI endpoint)
  getDonorDashboard: async () => {
    const response = await api.get("/dashboards/donor");
    return response.data?.data ?? response.data;
  },

  // GET /dashboards/operations (Exact OpenAPI endpoint)
  getOperationsDashboard: async () => {
    const response = await api.get("/dashboards/operations");
    return response.data;
  },
};

export default dashboardService;