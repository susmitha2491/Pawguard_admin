import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export type DonationType = "one_time" | "recurring" | "sponsorship";
export type DonationStatus = "pending" | "success" | "failed" | "refunded";

export interface DonationCreatePayload {
  amount: number;
  currency?: string;
  donation_type?: DonationType;
  notes?: string | null;
  dog_id?: string | null;
  campaign_id?: string | null;
  donor_name?: string | null;
  donor_email?: string | null;
  donor_phone?: string | null;
  payment_method?: string | null;
  transaction_id?: string | null;
  purpose?: string | null;
}

export interface DonationStatusUpdatePayload {
  status: DonationStatus;
}

export interface SponsorshipCreatePayload {
  dog_id: string;
  amount: number;
  currency?: string;
  sponsor_name?: string | null;
  sponsor_email?: string | null;
  sponsor_phone?: string | null;
  payment_method?: string | null;
  duration_months?: number;
  notes?: string | null;
}

export interface DonationCampaignCreatePayload {
  name: string;
  description?: string | null;
  target_amount: number;
  currency?: string;
  campaign_type?: string;
  status?: "draft" | "active" | "completed" | "cancelled";
  start_date: string;
  end_date?: string | null;
}

export interface DonorProfileUpdate {
  tax_identifier?: string | null;
  pan_number?: string | null;
  full_name_for_80g?: string | null;
  address_for_80g?: string | null;
  is_80g_eligible?: boolean | null;
  notes?: string | null;
}

export interface DonationFilters {
  search?: string;
  donation_type?: DonationType;
  status?: DonationStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

/** Robust status helper for valid completed revenue contributions */
export const isCompletedDonationStatus = (statusRaw: unknown): boolean => {
  const s = String(statusRaw ?? "").toLowerCase().trim();
  if (!s) return true;
  if (["failed", "refunded", "cancelled", "declined"].includes(s)) return false;
  return true;
};

/** Robust status helper for refunded entries */
export const isRefundedDonationStatus = (statusRaw: unknown): boolean => {
  const s = String(statusRaw ?? "").toLowerCase().trim();
  return ["refunded", "refund", "returned"].includes(s);
};

/** Robust status helper for valid active/completed sponsorships */
export const isValidSponsorshipStatus = (statusRaw: unknown): boolean => {
  const s = String(statusRaw ?? "").toLowerCase().trim();
  if (!s) return true;
  if (["cancelled", "failed", "refunded", "declined"].includes(s)) return false;
  return true;
};

/** Robust array extractor across varied API response wrapper formats */
export const extractArray = (body: any): any[] => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.donations)) return body.donations;
  if (Array.isArray(body?.sponsorships)) return body.sponsorships;
  if (Array.isArray(body?.campaigns)) return body.campaigns;
  if (Array.isArray(body?.donors)) return body.donors;
  if (Array.isArray(body?.results)) return body.results;
  return [];
};

/** Normalize raw DonationResponse row to standard page format. */
export const normalizeDonationRow = (d: any): any => {
  const isAnon = Boolean(d.is_anonymous || d.anonymous);
  const rawStatus = String(d.status || d.payment_status || d.transaction_status || d.state || "").toLowerCase().trim();

  let status: DonationStatus;
  if (["success", "completed", "paid", "captured", "settled", "successful"].includes(rawStatus)) {
    status = "success";
  } else if (["failed", "rejected", "declined"].includes(rawStatus)) {
    status = "failed";
  } else if (["refunded", "refund"].includes(rawStatus)) {
    status = "refunded";
  } else {
    const secondaryPayStatus = String(d.payment_status || d.transaction_status || "").toLowerCase().trim();
    if (["success", "completed", "paid", "captured"].includes(secondaryPayStatus)) {
      status = "success";
    } else if (!rawStatus || rawStatus === "posted") {
      status = "success";
    } else {
      status = "pending";
    }
  }

  const explicitName = d.donor_name || d.donorName || d.user?.full_name || d.user?.name || d.donor?.full_name || d.donor?.name || d.name;
  const initialName = isAnon
    ? "Anonymous Donor"
    : explicitName
    ? explicitName
    : (d.donor_id || d.user_id)
    ? "Unknown User"
    : "Anonymous Donor";

  return {
    id: d.id || d._id || d.donation_id,
    donorId: d.donor_id || d.user_id || "",
    donorName: initialName,
    donorEmail: d.donor_email || d.user?.email || d.email || "Not available",
    donorPhone: d.donor_phone || d.user?.phone || d.phone || d.user?.phone_number || "Not provided",
    dogId: d.dog_id,
    campaignId: d.campaign_id,
    amount: Number(d.amount || d.total_amount || d.price || d.donation_amount || 0),
    currency: d.currency || "INR",
    type: d.donation_type || d.type || "one_time",
    status,
    rawStatus: d.status || rawStatus,
    paymentStatus: d.payment_status || d.transaction_status || "completed",
    transactionId: d.transaction_id || d.payment_id || d.tx_id || d.id,
    notes: d.notes || d.purpose || d.description,
    paymentProvider: d.payment_provider || "Online Gateway",
    paymentMethod: d.payment_method || d.method || "Not available",
    receiptFileKey: d.receipt_file_key,
    date: d.created_at || d.transaction_date || d.date || d.updated_at,
    dog: d.dog,
    raw: d,
  };
};

export const donationsService = {
  // GET /admin/dashboard/donation-summary
  getDonationSummary: async () => {
    const response = await api.get("/admin/dashboard/donation-summary");
    return response.data?.data ?? response.data;
  },

  // GET /donations - List donations (paginated)
  getDonations: async (params?: DonationFilters) => {
    const response = await api.get("/donations", { params });
    const body = response.data;
    const raw = extractArray(body);
    const rows = raw.map(normalizeDonationRow);
    return { ...body, data: rows, total: body?.meta?.total ?? body?.total ?? rows.length };
  },

  // GET /donations/history - My donation history
  getDonationHistory: async () => {
    const response = await api.get("/donations/history");
    const body = response.data;
    const raw = extractArray(body);
    return raw.map(normalizeDonationRow);
  },

  // GET /donations/{id}
  getDonationById: async (id: string) => {
    const response = await api.get(`/donations/${id}`);
    const raw = response.data?.data ?? response.data;
    return normalizeDonationRow(raw);
  },

  // POST /donations (DonationCreate) or /donations/checkout (Donor self-service)
  createDonation: async (payload: DonationCreatePayload) => {
    const donationType =
      payload.donation_type === "recurring"
        ? "recurring"
        : payload.donation_type === "sponsorship"
        ? "sponsorship"
        : "one_time";

    try {
      const response = await api.post("/donations", {
        amount: Number(payload.amount),
        currency: payload.currency || "INR",
        donation_type: donationType,
        notes: payload.notes || payload.purpose || null,
        dog_id: payload.dog_id || null,
        campaign_id: payload.campaign_id || null,
      });
      await publishActionEvent({
        module: "finance",
        action: "create",
        title: "Donation Recorded",
        message: `Donation of ₹${Number(payload.amount).toFixed(2)} logged.`,
        targetRoles: ["super_admin", "finance_user"],
      });
      return response.data?.data ?? response.data;
    } catch (err: any) {
      // If 403 Forbidden (donor role without staff donation:manage permission), route to self-service checkout
      if (err?.response?.status === 403) {
        const checkoutRes = await api.post("/donations/checkout", {
          amount: Number(payload.amount),
          currency: payload.currency || "INR",
          donation_type: donationType,
          notes: payload.notes || payload.purpose || null,
          dog_id: payload.dog_id || null,
          campaign_id: payload.campaign_id || null,
        });

        await publishActionEvent({
          module: "finance",
          action: "create",
          title: "Donation Recorded",
          message: `Donation of ₹${Number(payload.amount).toFixed(2)} submitted.`,
          targetRoles: ["super_admin", "finance_user"],
        });

        return checkoutRes.data?.data ?? checkoutRes.data;
      }
      throw err;
    }
  },

  // POST /donations/checkout - Self-service donor contribution checkout
  checkoutDonation: async (payload: DonationCreatePayload) => {
    const donationType =
      payload.donation_type === "recurring"
        ? "recurring"
        : payload.donation_type === "sponsorship"
        ? "sponsorship"
        : "one_time";

    const response = await api.post("/donations/checkout", {
      amount: Number(payload.amount),
      currency: payload.currency || "INR",
      donation_type: donationType,
      notes: payload.notes || payload.purpose || null,
      dog_id: payload.dog_id || null,
      campaign_id: payload.campaign_id || null,
    });
    return response.data?.data ?? response.data;
  },

  // POST /donations/verify - Verify gateway payment
  verifyDonation: async (payload: {
    donation_id: string;
    gateway_order_id: string;
    gateway_payment_id: string;
    gateway_signature: string;
  }) => {
    const response = await api.post("/donations/verify", payload);
    return response.data?.data ?? response.data;
  },

  // PATCH /donations/{donation_id}/status (DonationStatusUpdate)
  updateDonationStatus: async (donationId: string, status: DonationStatus) => {
    const response = await api.patch(`/donations/${donationId}/status`, { status });
    await publishActionEvent({
      module: "finance",
      action: "update",
      title: "Donation Status Updated",
      message: `Donation ${donationId} marked as ${status}.`,
      targetRoles: ["super_admin", "finance_user"],
    });
    return response.data?.data ?? response.data;
  },

  // POST /donations/{donation_id}/reconcile
  reconcileDonation: async (donationId: string) => {
    const cleanId = String(donationId || "").trim();
    try {
      const response = await api.post(`/donations/${cleanId}/reconcile`);
      await publishActionEvent({
        module: "finance",
        action: "update",
        title: "Donation Reconciled",
        message: `Donation ${cleanId} reconciled to general ledger.`,
        targetRoles: ["super_admin", "finance_user"],
      });
      return response.data?.data ?? response.data;
    } catch {
      const response = await api.post("/finance/reconcile/donations", { donation_ids: [cleanId] });
      await publishActionEvent({
        module: "finance",
        action: "update",
        title: "Donation Reconciled",
        message: `Donation ${cleanId} reconciled to general ledger.`,
        targetRoles: ["super_admin", "finance_user"],
      });
      return response.data?.data ?? response.data;
    }
  },

  // GET /donations/{donation_id}/receipt
  getDonationReceipt: async (donationId: string) => {
    const response = await api.get(`/donations/${donationId}/receipt`);
    return response.data ?? response;
  },

  // POST /donations/{donation_id}/resend-receipt
  resendReceipt: async (donationId: string) => {
    const response = await api.post(`/donations/${donationId}/resend-receipt`);
    return response.data;
  },

  // GET /donations/donors
  getDonors: async (params?: { search?: string; page?: number; page_size?: number }) => {
    const response = await api.get("/donations/donors", { params });
    const body = response.data;
    const raw = extractArray(body);
    return { ...body, data: raw, total: body?.meta?.total ?? body?.total ?? raw.length };
  },

  // GET /donations/donors/{id}
  getDonorById: async (donorId: string) => {
    const response = await api.get(`/donations/donors/${donorId}`);
    return response.data?.data ?? response.data;
  },

  // PUT /donations/donors/{id} - Update Donor Profile (80G details, notes, PAN)
  updateDonor: async (donorId: string, payload: DonorProfileUpdate) => {
    const response = await api.put(`/donations/donors/${donorId}`, payload);
    await publishActionEvent({
      module: "finance",
      action: "update",
      title: "Donor Profile Updated",
      message: `Donor profile ${donorId} updated.`,
      targetRoles: ["super_admin", "finance_user"],
    });
    return response.data?.data ?? response.data;
  },

  // DELETE /donations/donors/{id} - Soft Delete Donor
  deleteDonor: async (donorId: string) => {
    const response = await api.delete(`/donations/donors/${donorId}`);
    await publishActionEvent({
      module: "finance",
      action: "delete",
      title: "Donor Profile Soft-Deleted",
      message: `Donor ${donorId} soft-deleted.`,
      targetRoles: ["super_admin", "finance_user"],
    });
    return response.data?.data ?? response.data;
  },

  // POST /donations/donors/bulk/delete - Bulk Soft Delete Donors
  bulkDeleteDonors: async (donorIds: string[]) => {
    const response = await api.post("/donations/donors/bulk/delete", { ids: donorIds });
    await publishActionEvent({
      module: "finance",
      action: "delete",
      title: "Donors Bulk Soft-Deleted",
      message: `${donorIds.length} donors soft-deleted.`,
      targetRoles: ["super_admin", "finance_user"],
    });
    return response.data?.data ?? response.data;
  },

  // GET /donations/sponsorships
  getSponsorships: async (params?: { page?: number; page_size?: number }) => {
    const response = await api.get("/donations/sponsorships", { params });
    const body = response.data;
    const raw = extractArray(body);
    return { ...body, data: raw, total: body?.meta?.total ?? body?.total ?? raw.length };
  },

  // POST /donations/sponsorships
  createSponsorship: async (payload: SponsorshipCreatePayload) => {
    const response = await api.post("/donations/sponsorships", {
      dog_id: payload.dog_id,
      amount: Number(payload.amount),
      currency: payload.currency || "INR",
      sponsor_name: payload.sponsor_name || null,
      sponsor_email: payload.sponsor_email || null,
      sponsor_phone: payload.sponsor_phone || null,
      payment_method: payload.payment_method || null,
      duration_months: payload.duration_months || 12,
      notes: payload.notes || null,
    });
    await publishActionEvent({
      module: "finance",
      action: "create",
      title: "Dog Sponsorship Registered",
      message: `Dog sponsorship of ₹${payload.amount} registered.`,
      targetRoles: ["super_admin", "finance_user"],
    });
    return response.data?.data ?? response.data;
  },

  // PATCH /donations/sponsorships/{sponsorship_id}/status
  updateSponsorshipStatus: async (sponsorshipId: string, status: string) => {
    const response = await api.patch(`/donations/sponsorships/${sponsorshipId}/status`, { status });
    return response.data?.data ?? response.data;
  },

  // GET /donations/campaigns - List campaigns
  getCampaigns: async (params?: { status?: string; search?: string; page?: number; page_size?: number }) => {
    const response = await api.get("/donations/campaigns", { params });
    const body = response.data;
    const raw = extractArray(body);
    return { ...body, data: raw, total: body?.meta?.total ?? body?.total ?? raw.length };
  },

  // POST /donations/campaigns - Create campaign
  createCampaign: async (payload: DonationCampaignCreatePayload) => {
    const response = await api.post("/donations/campaigns", payload);
    return response.data?.data ?? response.data;
  },

  // POST /donations/campaigns/{id}/publish
  publishCampaign: async (campaignId: string) => {
    const response = await api.post(`/donations/campaigns/${campaignId}/publish`);
    return response.data?.data ?? response.data;
  },

  // POST /donations/campaigns/{id}/cancel
  cancelCampaign: async (campaignId: string) => {
    const response = await api.post(`/donations/campaigns/${campaignId}/cancel`);
    return response.data?.data ?? response.data;
  },

  // GET /donations/sponsorships/my - Authenticated donor's own sponsorships
  getMySponsorships: async () => {
    const response = await api.get("/donations/sponsorships/my");
    const body = response.data;
    const raw = extractArray(body);
    return raw;
  },

  // GET /donations/donors/me - Authenticated donor's own profile (80G details, PAN, tax status)
  getMyDonorProfile: async () => {
    const response = await api.get("/donations/donors/me");
    return response.data?.data ?? response.data;
  },

  // GET /donations/recurring - Authenticated donor's recurring subscriptions
  getMyRecurringSubscriptions: async () => {
    const response = await api.get("/donations/recurring");
    const body = response.data;
    return extractArray(body);
  },

  // Download Donation Receipt
  downloadReceiptFile: async (donationId: string) => {
    try {
      const response = await api.get(`/donations/${donationId}/receipt/download`, {
        responseType: "blob",
      });
      return response.data;
    } catch {
      const fallback = await api.get(`/donations/${donationId}/receipt`);
      return fallback.data?.data ?? fallback.data;
    }
  },

  // POST /donations/bulk/status-update
  bulkUpdateDonationStatus: async (donationIds: string[], status: DonationStatus) => {
    const response = await api.post("/donations/bulk/status-update", { donation_ids: donationIds, status });
    return response.data?.data ?? response.data;
  },

  // POST /donations/bulk/delete
  bulkDeleteDonations: async (donationIds: string[]) => {
    const response = await api.post("/donations/bulk/delete", { donation_ids: donationIds });
    return response.data?.data ?? response.data;
  },
};

export default donationsService;
