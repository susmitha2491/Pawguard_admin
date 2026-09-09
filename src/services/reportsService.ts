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

export const reportsService = {
  // POST /reports/generate - backend-authoritative medical analytics payload
  generateMedicalReport: async (): Promise<Record<string, unknown>> => {
    const response = await api.post("/reports/generate", { report_type: "medical" });
    return (response.data?.data ?? response.data) as Record<string, unknown>;
  },

  // POST /reports/generate - backend-authoritative inventory audit payload
  generateInventoryReport: async (): Promise<Record<string, unknown>> => {
    const response = await api.post("/reports/generate", { report_type: "inventory" });
    return (response.data?.data ?? response.data) as Record<string, unknown>;
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
