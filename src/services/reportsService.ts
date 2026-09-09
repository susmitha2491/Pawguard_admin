import api from "../api/axios";

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const toErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    (err instanceof Error ? err.message : fallback)
  );
};

export interface ReportOptions {
  report_type: string;
  format?: "pdf" | "csv" | "xlsx";
  period_start?: string;
  period_end?: string;
  filters?: Record<string, unknown>;
}

export interface ReportFileResponse {
  report_type: string;
  format: string;
  filename: string;
  content_type: string;
  size_bytes?: number;
  download_url: string;
}

export const reportsService = {
  // GET /reports/medical/analytics - backend-authoritative medical analytics JSON payload
  getMedicalAnalytics: async (): Promise<Record<string, unknown>> => {
    const response = await api.get("/reports/medical/analytics");
    return (response.data?.data ?? response.data) as Record<string, unknown>;
  },

  // Alias for backward compatibility if needed
  generateMedicalReport: async (): Promise<Record<string, unknown>> => {
    return reportsService.getMedicalAnalytics();
  },

  // GET /reports/inventory/analytics - backend-authoritative inventory analytics JSON payload
  getInventoryAnalytics: async (): Promise<Record<string, unknown>> => {
    const response = await api.get("/reports/inventory/analytics");
    return (response.data?.data ?? response.data) as Record<string, unknown>;
  },

  // Alias for backward compatibility if needed
  generateInventoryReport: async (): Promise<Record<string, unknown>> => {
    return reportsService.getInventoryAnalytics();
  },

  // Dedicated PDF/Export generator functions (never overwrite analytics report state)
  generateInventoryPdf: async (filters?: Record<string, unknown>): Promise<ReportFileResponse> => {
    const response = await api.post("/reports/generate", {
      report_type: "inventory",
      format: "pdf",
      filters,
    });
    return (response.data?.data ?? response.data) as ReportFileResponse;
  },

  generateMedicalPdf: async (filters?: Record<string, unknown>): Promise<ReportFileResponse> => {
    const response = await api.post("/reports/generate", {
      report_type: "medical",
      format: "pdf",
      filters,
    });
    return (response.data?.data ?? response.data) as ReportFileResponse;
  },

  // GET /reports/types - list of available report type slugs
  getReportTypes: async (): Promise<string[]> => {
    const response = await api.get("/reports/types");
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data?.data)) return response.data.data;
    if (Array.isArray(response.data?.report_types)) return response.data.report_types;
    return [];
  },

  // GET /reports/formats - list of available export formats
  getReportFormats: async (): Promise<string[]> => {
    const response = await api.get("/reports/formats");
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data?.data)) return response.data.data;
    if (Array.isArray(response.data?.formats)) return response.data.formats;
    return [];
  },

  // POST /reports/generate - create a report and return its download metadata
  generateReport: async (options: ReportOptions) => {
    const response = await api.post("/reports/generate", {
      report_type: options.report_type,
      format: options.format || "pdf",
      period_start: options.period_start,
      period_end: options.period_end,
      filters: options.filters,
    });
    return response.data?.data ?? response.data;
  },

  // GET /reports/download/{filename} - fetch the generated file as a blob
  downloadReport: async (filename: string): Promise<void> => {
    const response = await api.get(`/reports/download/${encodeURIComponent(filename)}`, {
      responseType: "blob",
    });
    if (!(response.data instanceof Blob)) {
      throw new Error("Report endpoint did not return a valid file.");
    }
    const safeName = filename.split("/").pop() || `PawGuard_Report_${Date.now()}`;
    triggerDownload(response.data, safeName);
  },

  // Generate a report then automatically download the resulting file.
  generateAndDownloadReport: async (options: ReportOptions): Promise<void> => {
    try {
      const report = await reportsService.generateReport(options);
      const filename = report?.filename || report?.file_name || report?.file;
      if (!filename) {
        throw new Error("Report was generated but the backend did not return a downloadable file name.");
      }
      await reportsService.downloadReport(filename);
    } catch (err) {
      throw new Error(toErrorMessage(err, "Report export failed."), { cause: err });
    }
  },

  // Backwards-compatible shims used by older pages. Each maps to a real report
  // type on the backend (there is no "executive" report type).
  exportExecutivePdf: async (reportType: string = "finance"): Promise<void> => {
    await reportsService.generateAndDownloadReport({ report_type: reportType, format: "pdf" });
  },

  exportCsvDump: async (reportType: string = "rescue"): Promise<void> => {
    await reportsService.generateAndDownloadReport({ report_type: reportType, format: "csv" });
  },
};

export default reportsService;
