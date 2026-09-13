import api from "../api/axios";
import donationsService, { type DonationCreatePayload, type DonationFilters } from "./donationsService";

import { fetchGlobalWithFallback } from "./serviceTokenHelper";

export interface FinancialTransactionCreatePayload {
  transaction_type: "income" | "expense" | "transfer" | "reconciliation" | "refund";
  transaction_date: string;
  amount: number;
  currency?: string;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  donation_id?: string | null;
  debit_account_id: string;
  credit_account_id: string;
}

export interface FinanceExpenseCreatePayload {
  title: string;
  description?: string | null;
  amount: number;
  currency?: string;
  category: "medical_supplies" | "food_feeding" | "facility_rent" | "utilities" | "staff_payroll" | "rescue_operations" | "vehicle_fuel" | "other" | string;
  vendor_name: string;
  vendor_contact?: string | null;
  vendor_gstin?: string | null;
  expense_date: string;
  payment_method: "bank_transfer" | "cash" | "cheque" | "card" | "online" | string;
  payment_reference?: string | null;
  invoice_number?: string | null;
  account_id?: string | null;
  notes?: string | null;
}

export interface TaxReceipt80GRequestPayload {
  donation_id: string;
}

export interface RefundRequestPayload {
  donation_id: string;
  reason: string;
  refund_amount?: number | null;
}

export const financeService = {
  // GET /dashboards/finance
  getFinanceDashboard: async () => {
    const response = await api.get("/dashboards/finance");
    return response.data;
  },

  // GET /admin/dashboard/finance-stats
  getFinanceStats: async () => {
    try {
      const response = await api.get("/admin/dashboard/finance-stats");
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const fallback = await fetchGlobalWithFallback("/admin/dashboard/finance-stats");
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  // GET /finance/summary (Requires required query params period_start & period_end)
  getFinanceSummary: async (params?: { period_start?: string; period_end?: string }) => {
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-01-01`;
    const defaultEnd = now.toISOString().split("T")[0];
    const queryParams = {
      period_start: params?.period_start || defaultStart,
      period_end: params?.period_end || defaultEnd,
    };
    try {
      const response = await api.get("/finance/summary", { params: queryParams });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const fallback = await fetchGlobalWithFallback("/finance/summary", queryParams);
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  // GET /finance/pnl
  getPnlStatement: async (params: { period_start: string; period_end: string }) => {
    try {
      const response = await api.get("/finance/pnl", { params });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const fallback = await fetchGlobalWithFallback("/finance/pnl", params);
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  // GET /finance/transactions - List ledger transactions
  getTransactions: async (params?: Record<string, unknown>) => {
    try {
      const response = await api.get("/finance/transactions", { params });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const fallback = await fetchGlobalWithFallback("/finance/transactions", params);
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  // POST /finance/transactions - Create General Ledger Transaction
  createTransaction: async (data: FinancialTransactionCreatePayload) => {
    const response = await api.post("/finance/transactions", data);
    return response.data;
  },

  // GET /finance/expenses - List Expenses
  getExpenses: async (params?: Record<string, unknown>) => {
    const response = await api.get("/finance/expenses", { params });
    return response.data;
  },

  // POST /finance/expenses - Create Expense
  createExpense: async (data: FinanceExpenseCreatePayload) => {
    const response = await api.post("/finance/expenses", data);
    return response.data;
  },

  // POST /finance/expenses/{id}/approve
  approveExpense: async (expenseId: string) => {
    const response = await api.post(`/finance/expenses/${expenseId}/approve`);
    return response.data;
  },

  // POST /finance/expenses/{id}/reject
  rejectExpense: async (expenseId: string, reason: string) => {
    const response = await api.post(`/finance/expenses/${expenseId}/reject`, null, {
      params: { reason },
    });
    return response.data;
  },

  // POST /finance/expenses/{id}/pay
  payExpense: async (expenseId: string) => {
    const response = await api.post(`/finance/expenses/${expenseId}/pay`);
    return response.data;
  },

  // POST /finance/refunds - Process refund
  processRefund: async (data: RefundRequestPayload) => {
    const response = await api.post("/finance/refunds", data);
    return response.data;
  },

  // POST /finance/80g-certificate - Issue 80G Certificate
  generate80GCertificate: async (donationId: string) => {
    const cleanId = String(donationId || "").trim();
    try {
      const response = await api.post("/finance/80g-certificate", { donation_id: cleanId });
      return response.data;
    } catch {
      const response = await api.get(`/donations/${cleanId}/receipt`);
      return response.data;
    }
  },

  // POST /finance/reconcile/donations
  reconcileDonations: async (donationIds?: string[]) => {
    const response = await api.post("/finance/reconcile/donations", donationIds ? { donation_ids: donationIds } : {});
    return response.data;
  },

  // GET /finance/reports/pdf
  getFinanceReportPdfUrl: async (params: { period_start: string; period_end: string }) => {
    const response = await api.get("/finance/reports/pdf", { params });
    return response.data;
  },

  // Backwards-compatible aliases
  getFinanceRecords: async (params?: DonationFilters) => {
    return donationsService.getDonations(params);
  },

  recordDonation: async (data: DonationCreatePayload) => {
    return donationsService.createDonation(data);
  },

  reconcileTransaction: async (txId: string) => {
    return donationsService.reconcileDonation(txId);
  },
};

export default financeService;
