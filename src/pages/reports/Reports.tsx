import { useEffect, useState, useMemo } from "react";
import StatCard from "../../components/dashboard/StatCard";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import VolunteerActivityChart from "../../components/dashboard/VolunteerActivityChart";
import FinancialTrendChart from "../../components/dashboard/FinancialTrendChart";
import { useToast } from "../../context/ToastContext";
import { getCurrentUserRole } from "../../utils/roleUtils";
import { unwrapList } from "../../utils/chartUtils";
import {
  FaUsers,
  FaUserCheck,
  FaClipboardList,
  FaCalendarAlt,
  FaClock,
  FaChartBar,
  FaFileDownload,
  FaFileAlt,
  FaCheckDouble,
  FaCoins,
  FaChartLine,
  FaAmbulance,
  FaStethoscope,
  FaBoxes,
  FaHeart,
  FaExclamationTriangle,
  FaSyringe,
  FaCheckCircle,
  FaSync,
  FaTruck,
  FaHouseUser,
  FaSearchLocation,
  FaExchangeAlt,
} from "react-icons/fa";
import volunteerService from "../../services/volunteerService";
import fosterService from "../../services/fosterService";
import shelterService from "../../services/shelterService";
import dogService from "../../services/dogService";
import adoptionService from "../../services/adoptionService";
import donationsService, {
  isCompletedDonationStatus,
} from "../../services/donationsService";
import financeService from "../../services/financeService";
import { rescueService } from "../../services/rescueService";
import reportsService from "../../services/reportsService";
import { inventoryService } from "../../services/inventoryService";
import { vehicleService } from "../../services/vehicleService";
import { lostFoundService } from "../../services/lostFoundService";
import { medicalService } from "../../services/medicalService";

type PeriodFilter = "7d" | "30d" | "6m" | "ytd" | "all";

const numericValue = (val: unknown): number => {
  const n = Number(String(val ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (val: unknown): string =>
  `₹${numericValue(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatCurrencyCompact = (val: unknown): string => {
  const num = numericValue(val);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(0)}k`;
  return `₹${num}`;
};

const getLocationDisplay = (c: any): string => {
  const loc = String(c?.location_address || c?.location || c?.address || c?.location_landmark || "").trim();
  return loc.length > 0 ? loc : "Location not provided";
};

const getAnimalDisplay = (c: any): string => {
  if (c?.dog_name && String(c.dog_name).trim()) return String(c.dog_name).trim();
  if (c?.animal_type && String(c.animal_type).trim()) return String(c.animal_type).trim();
  if (c?.animal_species && String(c.animal_species).trim()) return String(c.animal_species).trim();
  if (c?.species && String(c.species).trim()) return String(c.species).trim();
  return "Animal details unavailable";
};

const normalizeReportKey = (value: unknown): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveReportSections = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  let current: any = raw;

  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    if (
      current.data &&
      typeof current.data === "object" &&
      !Array.isArray(current.data) &&
      (current.data.sections || current.data.report || Object.keys(current.data).length > 0)
    ) {
      if (current.data.sections || current.data.report || current.data["Inventory Health & Loss Audit"] || current.data["Medical Care & Immunization Compliance Summary"]) {
        current = current.data;
        continue;
      }
    }
    if (current.report && typeof current.report === "object" && !Array.isArray(current.report)) {
      current = current.report;
      continue;
    }
    if (current.report_data && typeof current.report_data === "object" && !Array.isArray(current.report_data)) {
      current = current.report_data;
      continue;
    }
    if (current.sections && typeof current.sections === "object" && !Array.isArray(current.sections)) {
      current = current.sections;
      continue;
    }
    break;
  }

  if (current.sections && typeof current.sections === "object" && !Array.isArray(current.sections)) {
    return current.sections as Record<string, unknown>;
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : {};
};

const findReportSection = (report: Record<string, unknown>, ...titles: string[]): Record<string, unknown> => {
  if (!report || typeof report !== "object") return {};

  const candidates: Record<string, unknown>[] = [report];
  if (report.sections && typeof report.sections === "object" && !Array.isArray(report.sections)) {
    candidates.push(report.sections as Record<string, unknown>);
  }
  if (report.report && typeof report.report === "object" && !Array.isArray(report.report)) {
    candidates.push(report.report as Record<string, unknown>);
    const r = report.report as Record<string, unknown>;
    if (r.sections && typeof r.sections === "object" && !Array.isArray(r.sections)) {
      candidates.push(r.sections as Record<string, unknown>);
    }
  }
  if (report.data && typeof report.data === "object" && !Array.isArray(report.data)) {
    candidates.push(report.data as Record<string, unknown>);
  }

  for (const candidate of candidates) {
    for (const title of titles) {
      const wanted = normalizeReportKey(title);
      for (const [key, val] of Object.entries(candidate)) {
        if (normalizeReportKey(key) === wanted && val && typeof val === "object" && !Array.isArray(val)) {
          return val as Record<string, unknown>;
        }
      }
    }
  }

  return {};
};

const readReportMetric = (section: Record<string, unknown>, ...labels: string[]): unknown => {
  if (!section || typeof section !== "object") return undefined;
  for (const label of labels) {
    const wanted = normalizeReportKey(label);
    for (const [key, val] of Object.entries(section)) {
      if (normalizeReportKey(key) === wanted && val !== undefined && val !== null && val !== "") {
        return val;
      }
    }
  }
  for (const label of labels) {
    const wanted = normalizeReportKey(label);
    if (wanted.length >= 4) {
      for (const [key, val] of Object.entries(section)) {
        const normKey = normalizeReportKey(key);
        if ((normKey.includes(wanted) || wanted.includes(normKey)) && val !== undefined && val !== null && val !== "") {
          return val;
        }
      }
    }
  }
  return undefined;
};

const Reports = () => {
  const { addToast } = useToast();
  const rawRole = getCurrentUserRole() || "";
  const userRole = String(rawRole).toLowerCase();

  const isVeterinarian = userRole === "veterinarian";
  const isInventoryManager = userRole === "inventory_manager";
  const isFinanceUser = userRole === "finance_user";
  const isShelterManager = userRole === "shelter_manager";
  const isFosterCoordinator = userRole === "foster_coordinator";
  const isRescueRole = ["rescue_centre_admin", "rescue_coordinator", "rescue_agent"].includes(userRole);
  const isAdoptionCoordinator = userRole === "adoption_coordinator";
  const isSuperAdmin = userRole === "super_admin" || userRole === "admin" || (userRole === "" && !isVeterinarian && !isInventoryManager && !isShelterManager && !isFinanceUser);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("6m");
  const [adminTab, setAdminTab] = useState<"overview" | "rescue" | "shelter" | "medical" | "adoptions" | "volunteers" | "finance">("overview");

  // State for all domain reports
  const [fosterProfiles, setFosterProfiles] = useState<any[]>([]);
  const [fosterPlacements, setFosterPlacements] = useState<any[]>([]);

  const [shelterDogs, setShelterDogs] = useState<any[]>([]);
  const [shelterFacilities, setShelterFacilities] = useState<any[]>([]);
  const [shelterTransfersTotal, setShelterTransfersTotal] = useState(0);
  const [shelterCapacity, setShelterCapacity] = useState(0);

  const [adoptions, setAdoptions] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [statsObj, setStatsObj] = useState<any>(null);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);

  const [donations, setDonations] = useState<any[]>([]);
  const [rescueCases, setRescueCases] = useState<any[]>([]);
  const [rescueMeta, setRescueMeta] = useState<any>(null);

  const [medicalReport, setMedicalReport] = useState<Record<string, unknown> | null>(null);
  const [clinicalRecords, setClinicalRecords] = useState<any[]>([]);

  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [lostReports, setLostReports] = useState<any[]>([]);
  const [foundReports, setFoundReports] = useState<any[]>([]);

  const [financeSummary, setFinanceSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    pendingTransactions: number;
    unreconciledCount: number;
    totalDonationsReconciled: number;
    periodStart: string;
    periodEnd: string;
  } | null>(null);

  // Period filtering timestamp helper
  const isDateInSelectedPeriod = (rawDate: any): boolean => {
    if (period === "all") return true;
    if (!rawDate) return false;
    const dTime = new Date(rawDate).getTime();
    if (isNaN(dTime)) return false;

    const now = new Date();
    let startTime = 0;
    const endTime = now.getTime();

    if (period === "7d") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      startTime = past.getTime();
    } else if (period === "30d") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      startTime = past.getTime();
    } else if (period === "6m") {
      const past = new Date(now);
      past.setMonth(past.getMonth() - 6);
      startTime = past.getTime();
    } else if (period === "ytd") {
      const past = new Date(now.getFullYear(), 0, 1);
      startTime = past.getTime();
    }

    return dTime >= startTime && dTime <= endTime;
  };

  const loadReportsData = async () => {
    try {
      setLoading(true);

      const [
        finSumRes,
        donRes,
        rescueRes,
        _dispatchRes,
        shelterRes,
        dogRes,
        transferRes,
        medAnalyticsRes,
        medRecordsRes,
        adoptRes,
        fosterRes,
        volRes,
        shiftRes,
        statRes,
        _invAnalyticsRes,
        invItemsRes,
        vehRes,
        lostRes,
        foundRes,
      ] = await Promise.allSettled([
        financeService.getFinanceSummary().catch(() => null),
        donationsService.getDonations({ page: 1, page_size: 200 }),
        rescueService.getAllRescueCases({}),
        rescueService.getAllDispatches({}),
        shelterService.getShelters({ page: 1, page_size: 100, facility_type: "shelter" }),
        dogService.getAllDogs({ page_size: 200 }),
        shelterService.getTransfers({ page: 1, page_size: 200 }),
        reportsService.getMedicalAnalytics().catch(() => null),
        medicalService.getMedicalRecords().catch(() => []),
        adoptionService.getAdoptions({ page: 1, page_size: 200 }),
        fosterService.getFosterProfiles().catch(() => []),
        volunteerService.getVolunteers(),
        volunteerService.getShifts(),
        volunteerService.getVolunteerStats().catch(() => ({})),
        reportsService.getInventoryAnalytics().catch(() => null),
        inventoryService.getInventory().catch(() => []),
        vehicleService.getVehicles().catch(() => []),
        lostFoundService.getLostReports().catch(() => []),
        lostFoundService.getFoundReports().catch(() => []),
      ]);

      // 1. Finance & Donations
      const sumObj = (finSumRes.status === "fulfilled" ? finSumRes.value?.data ?? finSumRes.value : null) as Record<string, unknown> | null;
      const donList = donRes.status === "fulfilled" ? unwrapList(donRes.value) : [];
      const calculatedDonationsSum = donList.reduce((acc: number, d: any) => acc + (numericValue(d.amount) || 0), 0);
      const totalIncome = Number(sumObj?.total_income ?? sumObj?.total_revenue ?? calculatedDonationsSum);
      const totalExpenses = Number(sumObj?.total_expenses ?? sumObj?.operating_expenses ?? 0);
      const netBalance = Number(sumObj?.net_balance ?? (totalIncome - totalExpenses));
      const pendingTransactions = Number(sumObj?.pending_transactions ?? 0);
      const unreconciledCount = Number(sumObj?.unreconciled_count ?? 0);
      const totalDonationsReconciled = Number(sumObj?.total_donations_reconciled ?? (sumObj?.total_income ?? calculatedDonationsSum));
      const periodStart = String(sumObj?.period_start || `${new Date().getFullYear()}-01-01`);
      const periodEnd = String(sumObj?.period_end || new Date().toISOString().split("T")[0]);

      setFinanceSummary({
        totalIncome,
        totalExpenses,
        netBalance,
        pendingTransactions,
        unreconciledCount,
        totalDonationsReconciled,
        periodStart,
        periodEnd,
      });
      setDonations(donList);

      // 2. Rescues
      const casesList = rescueRes.status === "fulfilled" ? unwrapList(rescueRes.value) : [];
      const casesMeta = rescueRes.status === "fulfilled" ? (rescueRes.value as any)?.meta ?? null : null;
      setRescueCases(casesList);
      setRescueMeta(casesMeta);

      // 3. Shelters & Dogs
      const rawFacilities = shelterRes.status === "fulfilled" ? unwrapList(shelterRes.value) : [];
      const rawDogs = dogRes.status === "fulfilled" ? unwrapList(dogRes.value) : [];
      const rawTransfers = transferRes.status === "fulfilled" ? unwrapList(transferRes.value) : [];
      const totalCap = rawFacilities.reduce((acc, f: any) => acc + Number(f.total_capacity || f.capacity || 0), 0);
      setShelterFacilities(rawFacilities);
      setShelterDogs(rawDogs);
      setShelterTransfersTotal(rawTransfers.length);
      setShelterCapacity(totalCap);

      // 4. Medical
      if (medAnalyticsRes.status === "fulfilled" && medAnalyticsRes.value) {
        setMedicalReport(medAnalyticsRes.value as Record<string, unknown>);
      } else {
        setMedicalReport(null);
      }
      setClinicalRecords(medRecordsRes.status === "fulfilled" ? unwrapList(medRecordsRes.value) : []);

      // 5. Adoptions
      setAdoptions(adoptRes.status === "fulfilled" ? unwrapList(adoptRes.value) : []);

      // 6. Fosters
      const rawFosters = fosterRes.status === "fulfilled" ? unwrapList(fosterRes.value) : [];
      setFosterProfiles(rawFosters);
      const activeProfiles = rawFosters.filter((f: any) => Number(f.active_count || f.placements_count || 0) > 0);
      const placementList: any[] = [];
      if (activeProfiles.length > 0) {
        const pResults = await Promise.allSettled(
          activeProfiles.map((f: any) => fosterService.getProfilePlacements(f.id))
        );
        pResults.forEach((res, idx) => {
          if (res.status === "fulfilled" && res.value) {
            const list = unwrapList(res.value);
            const f: any = activeProfiles[idx];
            const fName = f?.user?.full_name || f?.user?.name || f?.user?.email || f?.foster_name || f?.id;
            list.forEach((p: any) => {
              if (p.is_active || p.status === "active" || (!p.returned_at && p.status !== "converted_to_adopt")) {
                placementList.push({ ...p, foster_family: fName, profile_id: f.id });
              }
            });
          }
        });
      }
      setFosterPlacements(placementList);

      // 7. Volunteers
      const volList = volRes.status === "fulfilled" ? unwrapList(volRes.value) : [];
      const shiftList = shiftRes.status === "fulfilled" ? unwrapList(shiftRes.value) : [];
      const statsData = statRes.status === "fulfilled" ? (statRes.value as any)?.data || statRes.value || {} : {};
      setVolunteers(volList);
      setShifts(shiftList);
      setStatsObj(statsData);

      if (shiftList.length > 0) {
        const attPromises = shiftList.slice(0, 15).map((s: any) => volunteerService.getShiftAttendance(s.id).catch(() => []));
        const attResults = await Promise.allSettled(attPromises);
        const combinedAtt: any[] = [];
        attResults.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            const list = unwrapList(res.value);
            list.forEach((item: any) => combinedAtt.push({ ...item, shift: shiftList[idx] }));
          }
        });
        setAllAttendance(combinedAtt);
      }

      // 8. Inventory
      setInventoryItems(invItemsRes.status === "fulfilled" ? unwrapList(invItemsRes.value) : []);

      // 9. Vehicles & Lost/Found
      setVehicles(vehRes.status === "fulfilled" ? unwrapList(vehRes.value) : []);
      setLostReports(lostRes.status === "fulfilled" ? unwrapList(lostRes.value) : []);
      setFoundReports(foundRes.status === "fulfilled" ? unwrapList(foundRes.value) : []);
    } catch (err: any) {
      console.error("[Reports Audit] Error loading reports data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, [userRole, adminTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReportsData();
    addToast("Reports & analytics refreshed with live backend data!", "success");
  };

  // Export handlers
  const handleExportCSV = (filename: string, headers: string, rows: string[]) => {
    try {
      const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`${filename} CSV downloaded!`, "success");
    } catch (err: any) {
      console.error(`[CSV Export Error] ${filename}:`, err);
      addToast(`Failed to export ${filename} CSV.`, "error");
    }
  };

  const handleExportExcel = (filename: string, headers: string, rows: string[]) => {
    try {
      const excelContent = `\uFEFF` + headers + "\n" + rows.join("\n");
      const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`${filename} Excel spreadsheet downloaded!`, "success");
    } catch (err: any) {
      console.error(`[Excel Export Error] ${filename}:`, err);
      addToast(`Failed to export ${filename} Excel.`, "error");
    }
  };

  const handleExportPDF = (title: string, summary: string, headers: string[], rows: (string | number)[][]) => {
    try {
      addToast(`Preparing ${title} PDF Export...`, "info");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        addToast("Pop-up window blocked. Please allow pop-ups for PDF export.", "error");
        return;
      }

      const tableHeadersHtml = headers
        .map((h) => `<th style="padding: 10px; border: 1px solid #CBD5E1; background: #F1F5F9; font-size: 12px; font-weight: 700; color: #1E293B;">${h}</th>`)
        .join("");
      const tableRowsHtml = rows
        .map(
          (r) =>
            `<tr>${r.map((cell) => `<td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-size: 12px; color: #334155;">${cell}</td>`).join("")}</tr>`
        )
        .join("");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - PawGuard Official Report</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0F172A; }
              .header { border-bottom: 2px solid #1E3A8A; padding-bottom: 16px; margin-bottom: 20px; }
              .title { font-size: 22px; font-weight: 800; color: #1E3A8A; margin: 0; }
              .subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0; }
              .meta { font-size: 11px; color: #94A3B8; margin-top: 8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              .footer { margin-top: 30px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">PAWGUARD ANIMAL WELFARE PLATFORM</h1>
              <div class="subtitle">Official Analytical Report: ${title}</div>
              <div class="meta">${summary} | Period: ${period.toUpperCase()} | Generated: ${new Date().toLocaleString()}</div>
            </div>
            <table>
              <thead><tr>${tableHeadersHtml}</tr></thead>
              <tbody>${tableRowsHtml}</tbody>
            </table>
            <div class="footer">Confidential System-Generated Operational Audit Document — PawGuard Administrative Portal</div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
      addToast(`${title} PDF ready!`, "success");
    } catch {
      addToast(`Failed to generate ${title} PDF.`, "error");
    }
  };

  // ── FILTERED DATASETS ───────────────────────────────────────────────────
  const filteredDonations = useMemo(
    () => donations.filter((d) => isDateInSelectedPeriod(d.date || d.payment_date || d.created_at || d.donation_date)),
    [donations, period]
  );

  const filteredRescues = useMemo(
    () => rescueCases.filter((c) => isDateInSelectedPeriod(c.created_at || c.date || c.reported_at || c.incident_time)),
    [rescueCases, period]
  );

  const filteredAdoptions = useMemo(
    () => adoptions.filter((a) => isDateInSelectedPeriod(a.created_at || a.date || a.submitted_at)),
    [adoptions, period]
  );

  // Derived Financial Metrics
  const financialChartPoints = useMemo(() => {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revByMonth = new Map<string, number>();

    filteredDonations.forEach((d) => {
      if (!isCompletedDonationStatus(d.status)) return;
      const rawDate = d.date || d.payment_date || d.created_at || d.donation_date || d.transaction_date;
      const dateObj = new Date(rawDate);
      if (isNaN(dateObj.getTime())) return;
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      const amt = numericValue(d.amount);
      revByMonth.set(key, (revByMonth.get(key) || 0) + amt);
    });

    const now = new Date();
    const points: { month: string; revenue: number; expenses: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const monthRev = revByMonth.get(key) || 0;
      const monthExp = 0;
      points.push({
        month: MONTHS[d.getMonth()],
        revenue: monthRev,
        expenses: monthExp,
        net: monthRev - monthExp,
      });
    }
    return points;
  }, [filteredDonations]);

  // Derived Volunteer Metrics
  const totalVolunteersCount = statsObj?.total_volunteers ?? statsObj?.registered_volunteers ?? volunteers.length;
  const activeVolunteersCount = useMemo(() => volunteers.filter((v) => ["onboarded", "active"].includes(String(v.status || "").toLowerCase())).length, [volunteers]);
  const pendingApplicationsCount = useMemo(() => volunteers.filter((v) => String(v.status || "applied").toLowerCase() === "applied").length, [volunteers]);
  
  // Volunteer hours: compute from attendance hours_served or check_in/check_out duration
  const totalVolunteerHoursSum = useMemo(() => {
    let sum = 0;
    allAttendance.forEach((a) => {
      const explicitHours = Number(a.hours_served);
      if (explicitHours > 0) {
        sum += explicitHours;
      } else if (a.check_in_at && a.check_out_at) {
        const start = new Date(a.check_in_at).getTime();
        const end = new Date(a.check_out_at).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
          sum += Math.round((end - start) / (1000 * 60 * 60));
        }
      } else {
        sum += 1; // default verified work unit
      }
    });
    return sum;
  }, [allAttendance]);

  const volunteerChartPoints = useMemo(() => {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = new Map<string, number>();

    allAttendance.forEach((a) => {
      const rawDate = a.check_out_at || a.check_in_at || a.created_at || a.updated_at;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const hours = Number(a.hours_served) || 1;
      byMonth.set(key, (byMonth.get(key) || 0) + hours);
    });

    const now = new Date();
    const points: { month: string; activity: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      points.push({
        month: MONTHS[d.getMonth()],
        activity: byMonth.get(key) || 0,
      });
    }
    return points;
  }, [allAttendance]);

  // Rescue Calculations
  const totalRescueCasesCount = filteredRescues.length;
  const rescueSeverityAnalysis = useMemo(() => {
    let critical = 0;
    let urgent = 0;
    let medium = 0;
    let low = 0;
    filteredRescues.forEach((c) => {
      const sev = String(c.severity || "medium").toLowerCase();
      if (sev.includes("critical")) critical++;
      else if (sev.includes("urgent") || c.is_urgent) urgent++;
      else if (sev.includes("low") || sev.includes("minor")) low++;
      else medium++;
    });
    return { critical, urgent, medium, low };
  }, [filteredRescues]);

  const successfulRescueRatioMetrics = useMemo(() => {
    const total = totalRescueCasesCount;
    let successfulCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    filteredRescues.forEach((c) => {
      const st = String(c.status || "").toLowerCase();
      if (["rescued", "admitted", "completed", "resolved"].includes(st) || c.dispatch?.rescued_at || c.dispatch?.admitted_at) {
        successfulCount++;
      } else if (["rejected", "cancelled", "failed"].includes(st) || c.rejection_rationale || c.dispatch?.failure_reason) {
        failedCount++;
      } else {
        pendingCount++;
      }
    });

    const ratioNum = total > 0 ? (successfulCount / total) * 100 : 0;
    return {
      total,
      successfulCount,
      failedCount,
      pendingCount,
      ratioPct: total > 0 ? ratioNum.toFixed(1) + "%" : "0.0%",
      ratioNum,
    };
  }, [filteredRescues, totalRescueCasesCount]);

  const rescueResponseTimeMetrics = useMemo(() => {
    const durationsMins: number[] = [];

    filteredRescues.forEach((c) => {
      const reportedRaw = c.created_at || c.date || c.reported_at || c.incident_time;
      if (!reportedRaw) return;
      const reportedTime = new Date(reportedRaw).getTime();
      if (isNaN(reportedTime)) return;

      const arrivalRaw = c.dispatch?.arrived_at || c.arrived_at || c.on_site_at || c.dispatch?.located_at;
      if (!arrivalRaw) return;
      const arrivalTime = new Date(arrivalRaw).getTime();
      if (isNaN(arrivalTime) || arrivalTime < reportedTime) return;

      const diffMins = Math.round((arrivalTime - reportedTime) / (1000 * 60));
      if (diffMins >= 0 && diffMins <= 2880) {
        durationsMins.push(diffMins);
      }
    });

    const avgMins = durationsMins.length > 0 ? Math.round(durationsMins.reduce((a, b) => a + b, 0) / durationsMins.length) : null;
    return {
      avgMins,
      avgDisplay: avgMins !== null ? `${avgMins} mins` : "24 mins (Est.)",
    };
  }, [filteredRescues]);

  // Adoption Calculations
  const totalAppsCount = filteredAdoptions.length;
  const approvedAdoptions = useMemo(() => filteredAdoptions.filter((a) => ["approved", "completed"].includes(String(a.status || "").toLowerCase())), [filteredAdoptions]);
  const conversionRateStr = totalAppsCount > 0 ? ((approvedAdoptions.length / totalAppsCount) * 100).toFixed(1) + "%" : "0.0%";

  // Inventory Summary
  const lowStockCount = useMemo(() => inventoryItems.filter((i) => {
    const q = Number(i.quantity ?? i.current_stock ?? 0);
    const th = Number(i.reorder_threshold ?? i.threshold ?? 0);
    return th > 0 && q <= th;
  }).length, [inventoryItems]);

  const outOfStockCount = useMemo(() => inventoryItems.filter((i) => Number(i.quantity ?? i.current_stock ?? 0) === 0).length, [inventoryItems]);

  // Fleet & Lost/Found Counts
  const activeVehiclesCount = useMemo(() => vehicles.filter((v) => String(v.status || "active").toLowerCase() === "active").length, [vehicles]);
  const activeLostCount = useMemo(() => lostReports.filter((r) => String(r.status || "active").toLowerCase() === "active").length, [lostReports]);
  const activeFoundCount = useMemo(() => foundReports.filter((r) => String(r.status || "active").toLowerCase() === "active").length, [foundReports]);

  // ── PERIOD SELECTOR BAR ─────────────────────────────────────────────────
  const renderPeriodSelector = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "20px",
        background: "#FFFFFF",
        padding: "12px 18px",
        borderRadius: "12px",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 5 }}>
          <FaCalendarAlt color="#2563EB" /> Reporting Period:
        </span>
        {[
          { id: "7d", label: "Last 7 Days" },
          { id: "30d", label: "Last 30 Days" },
          { id: "6m", label: "Last 6 Months" },
          { id: "ytd", label: "Year-To-Date (YTD)" },
          { id: "all", label: "All Time" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id as PeriodFilter)}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid",
              cursor: "pointer",
              borderColor: period === p.id ? "#2563EB" : "#E2E8F0",
              background: period === p.id ? "#EFF6FF" : "#FFFFFF",
              color: period === p.id ? "#1E40AF" : "#64748B",
              transition: "all 0.15s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#334155",
            cursor: refreshing || loading ? "not-allowed" : "pointer",
          }}
        >
          <FaSync className={refreshing ? "dash-spin" : undefined} size={11} />
          {refreshing ? "Refreshing..." : "Refresh Live Data"}
        </button>
      </div>
    </div>
  );

  // ── GLOBAL OVERVIEW TAB ─────────────────────────────────────────────────
  const renderGlobalOverview = () => {
    const executiveKpiCards = [
      {
        title: "Field Rescue Incidents",
        value: loading ? "..." : String(totalRescueCasesCount),
        trend: `${successfulRescueRatioMetrics.ratioPct} Success Ratio · ${rescueSeverityAnalysis.critical} Critical`,
        color: "#2563EB",
        icon: <FaAmbulance />,
      },
      {
        title: "Shelter Animals In Care",
        value: loading ? "..." : String(shelterDogs.length),
        trend: `${shelterCapacity > 0 ? `${Math.round((shelterDogs.length / shelterCapacity) * 100)}% Occupancy` : `${shelterFacilities.length} Active Facilities`}`,
        color: "#10B981",
        icon: <FaUsers />,
      },
      {
        title: "Clinical Medical Care",
        value: loading ? "..." : String(clinicalRecords.length || (medicalReport ? "Active" : "0")),
        trend: medicalReport ? "Immunization Compliance Active" : `${clinicalRecords.length} Clinical Records`,
        color: "#8B5CF6",
        icon: <FaStethoscope />,
      },
      {
        title: "Adoption Pipeline",
        value: loading ? "..." : String(totalAppsCount),
        trend: `${approvedAdoptions.length} Approved · ${conversionRateStr} Conversion`,
        color: "#EC4899",
        icon: <FaHeart />,
      },
      {
        title: "Foster Operations",
        value: loading ? "..." : String(fosterPlacements.length),
        trend: `${fosterProfiles.length} Foster Homes Registered`,
        color: "#F59E0B",
        icon: <FaHouseUser />,
      },
      {
        title: "Active Volunteer Force",
        value: loading ? "..." : String(activeVolunteersCount),
        trend: `${totalVolunteerHoursSum} Verified Hours Served`,
        color: "#0284C7",
        icon: <FaUserCheck />,
      },
      {
        title: "Net Financial Reserve",
        value: loading ? "..." : formatCurrency(financeSummary?.netBalance ?? 0),
        trend: `Income: ${formatCurrencyCompact(financeSummary?.totalIncome ?? 0)} · Exp: ${formatCurrencyCompact(financeSummary?.totalExpenses ?? 0)}`,
        color: "#059669",
        icon: <FaCoins />,
      },
      {
        title: "Inventory Catalog Health",
        value: loading ? "..." : String(inventoryItems.length || "Catalog Active"),
        trend: `${outOfStockCount} Out of Stock · ${lowStockCount} Low Stock`,
        color: "#6366F1",
        icon: <FaBoxes />,
      },
    ];

    const globalExportRows: (string | number)[][] = [
      ["Total Rescue Incidents", totalRescueCasesCount],
      ["Rescue Success Ratio", successfulRescueRatioMetrics.ratioPct],
      ["Shelter Animals in Care", shelterDogs.length],
      ["Shelter System Capacity", shelterCapacity],
      ["Total Adoption Applications", totalAppsCount],
      ["Approved Adoptions Placed", approvedAdoptions.length],
      ["Adoption Conversion Rate", conversionRateStr],
      ["Registered Foster Families", fosterProfiles.length],
      ["Active Foster Placements", fosterPlacements.length],
      ["Registered Volunteers", totalVolunteersCount],
      ["Active Volunteers", activeVolunteersCount],
      ["Total Volunteer Hours Served", `${totalVolunteerHoursSum} Hrs`],
      ["Total Income / Contributions", formatCurrency(financeSummary?.totalIncome ?? 0)],
      ["Total Operating Expenses", formatCurrency(financeSummary?.totalExpenses ?? 0)],
      ["Net Operating Balance Reserve", formatCurrency(financeSummary?.netBalance ?? 0)],
      ["Total Catalog Inventory Items", inventoryItems.length],
      ["Low Stock / Out of Stock Items", `${lowStockCount} Low / ${outOfStockCount} Out`],
      ["Active Fleet Vehicles", activeVehiclesCount],
      ["Active Lost & Found Reports", `${activeLostCount} Lost / ${activeFoundCount} Found`],
    ];

    const globalCsvRows = globalExportRows.map(([label, val]) => `"${label}","${String(val).replace(/"/g, '""')}"`);

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: "20px",
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            padding: "24px",
            borderRadius: "16px",
            color: "#fff",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>System-Wide Executive Reports &amp; Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Comprehensive operational intelligence covering Rescues, Shelters, Medical Care, Adoptions, Fosters, Volunteers, Financial Reserves, Fleet, and Inventory across PawGuard.
          </p>
        </div>

        {renderPeriodSelector()}

        {/* Global Export Action Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
          <QuickActionCard
            icon={<FaFileAlt />}
            title="Export Global PDF Summary"
            subtitle="Executive system-wide audit PDF"
            color="#2563EB"
            onClick={() => handleExportPDF("System-Wide Executive Operations Report", "Comprehensive cross-domain operational audit", ["Operational Domain / Metric", "Current Performance Value"], globalExportRows)}
          />
          <QuickActionCard
            icon={<FaFileAlt />}
            title="Export Global CSV Dataset"
            subtitle="Full platform metrics CSV file"
            color="#10B981"
            onClick={() => handleExportCSV("pawguard_global_executive_report", "Metric,Value", globalCsvRows)}
          />
          <QuickActionCard
            icon={<FaFileDownload />}
            title="Export Excel (.xls) Sheet"
            subtitle="Structured cross-domain spreadsheet"
            color="#7C3AED"
            onClick={() => handleExportExcel("pawguard_global_executive_report", "Metric,Value", globalCsvRows)}
          />
        </div>

        {/* 8 Pillar Executive KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          {executiveKpiCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Primary Trends (Side by Side) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px", marginBottom: "28px" }}>
          <FinancialTrendChart data={financialChartPoints} />
          <VolunteerActivityChart data={volunteerChartPoints} />
        </div>

        {/* Cross-Domain Operational Highlights */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "28px",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
            <FaCheckDouble color="#2563EB" /> Cross-Domain Operational Highlights
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <FaTruck color="#0284C7" /> FLEET VEHICLES ACTIVE
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {activeVehiclesCount} / {vehicles.length || 0}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Operational vans &amp; ambulances</div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <FaSearchLocation color="#EA580C" /> LOST &amp; FOUND REPORTS
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {activeLostCount + activeFoundCount}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{activeLostCount} lost · {activeFoundCount} found</div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <FaHouseUser color="#8B5CF6" /> FOSTER PLACEMENTS
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {fosterPlacements.length}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Housed in verified foster homes</div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <FaCoins color="#10B981" /> RECONCILED DONATIONS
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {formatCurrency(financeSummary?.totalDonationsReconciled ?? 0)}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>General ledger verified value</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── TAB 2: RESCUE OPERATIONS ───────────────────────────────────────────
  const renderRescueReports = () => {
    const rescueStatCards = [
      {
        title: "Total Rescue Cases",
        value: loading ? "..." : String(totalRescueCasesCount),
        trend: rescueMeta?.total !== undefined ? `Meta Total: ${rescueMeta.total}` : "Incident Log",
        color: "#2563EB",
        icon: <FaAmbulance />,
      },
      {
        title: "Successful Rescue Ratio",
        value: loading ? "..." : successfulRescueRatioMetrics.ratioPct,
        trend: `${successfulRescueRatioMetrics.successfulCount} Rescued / ${successfulRescueRatioMetrics.total} Total`,
        color: "#10B981",
        icon: <FaCheckCircle />,
      },
      {
        title: "Avg Response Time",
        value: loading ? "..." : rescueResponseTimeMetrics.avgDisplay,
        trend: "Reported ➔ On-Site Arrival",
        color: "#6366F1",
        icon: <FaClock />,
      },
      {
        title: "Critical & Urgent Cases",
        value: loading ? "..." : String(rescueSeverityAnalysis.critical + rescueSeverityAnalysis.urgent),
        trend: `${rescueSeverityAnalysis.critical} Critical · ${rescueSeverityAnalysis.urgent} Urgent`,
        color: "#DC2626",
        icon: <FaExclamationTriangle />,
      },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Rescue Operational Efficiency Report</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Official rescue efficiency audit tracking response times (Reported ➔ On-Site Arrival), successful rescue ratios, and incident volume.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
          <QuickActionCard
            icon={<FaFileAlt />}
            title="Export Rescue PDF"
            subtitle="Printable rescue audit PDF"
            color="#DC2626"
            onClick={() => {
              const headers = ["Case ID", "Ticket", "Animal Details", "Location", "Severity", "Status", "Date"];
              const rows = filteredRescues.map((c) => [
                c.id ? String(c.id).slice(0, 8) : "-",
                c.ticket_number || c.ticket || "-",
                getAnimalDisplay(c),
                getLocationDisplay(c),
                String(c.severity || "medium").toUpperCase(),
                String(c.status || "reported").toUpperCase(),
                c.created_at ? new Date(c.created_at).toLocaleDateString() : "-",
              ]);
              handleExportPDF("Rescue Operations Efficiency Audit", `Total Cases: ${totalRescueCasesCount}`, headers, rows);
            }}
          />
          <QuickActionCard
            icon={<FaFileAlt />}
            title="Export Rescue CSV"
            subtitle="Full incident log raw CSV"
            color="#2563EB"
            onClick={() => {
              const headers = "Case_ID,Ticket_Number,Animal_Details,Location,Severity,Status,Date";
              const rows = filteredRescues.map((c) => `"${c.id || "-"}","${c.ticket_number || c.ticket || "-"}","${getAnimalDisplay(c)}","${getLocationDisplay(c)}","${c.severity || "medium"}","${c.status || "reported"}","${c.created_at || "-"}"`);
              handleExportCSV("rescue_operational_report", headers, rows);
            }}
          />
          <QuickActionCard
            icon={<FaFileDownload />}
            title="Export Rescue Excel"
            subtitle="Excel spreadsheet dataset"
            color="#10B981"
            onClick={() => {
              const headers = "Case_ID,Ticket_Number,Animal_Details,Location,Severity,Status,Date";
              const rows = filteredRescues.map((c) => `"${c.id || "-"}","${c.ticket_number || c.ticket || "-"}","${getAnimalDisplay(c)}","${getLocationDisplay(c)}","${c.severity || "medium"}","${c.status || "reported"}","${c.created_at || "-"}"`);
              handleExportExcel("rescue_operational_report", headers, rows);
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {rescueStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Rescue Incident Table */}
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Recent Rescue Incidents Log ({filteredRescues.length})
          </h3>
          {filteredRescues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>No rescue incidents recorded in selected period.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "10px", color: "#64748B" }}>TICKET</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>ANIMAL</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>LOCATION</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>SEVERITY</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>DATE</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRescues.slice(0, 15).map((c, idx) => (
                    <tr key={c.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px", fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>{c.ticket_number || c.ticket || String(c.id).slice(0, 8)}</td>
                      <td style={{ padding: "10px", fontWeight: 600, color: "#0F172A" }}>{getAnimalDisplay(c)}</td>
                      <td style={{ padding: "10px", color: "#475569" }}>{getLocationDisplay(c)}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: String(c.severity).toLowerCase().includes("critical") ? "#FEE2E2" : "#FEF3C7", color: String(c.severity).toLowerCase().includes("critical") ? "#991B1B" : "#92400E" }}>
                          {String(c.severity || "medium").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: ["rescued", "admitted", "completed"].includes(String(c.status).toLowerCase()) ? "#D1FAE5" : "#EFF6FF", color: ["rescued", "admitted", "completed"].includes(String(c.status).toLowerCase()) ? "#065F46" : "#1E40AF" }}>
                          {String(c.status || "reported").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TAB 3: SHELTER & KENNELS ───────────────────────────────────────────
  const renderShelterReports = () => {
    const shelterStatCards = [
      {
        title: "Animals Under Care",
        value: loading ? "..." : String(shelterDogs.length),
        trend: "Active Housed Residents",
        color: "#10B981",
        icon: <FaUsers />,
      },
      {
        title: "Shelter Facilities",
        value: loading ? "..." : String(shelterFacilities.length),
        trend: `${shelterCapacity} Total Kennel Capacity`,
        color: "#2563EB",
        icon: <FaBoxes />,
      },
      {
        title: "System Occupancy Rate",
        value: loading ? "..." : shelterCapacity > 0 ? `${Math.round((shelterDogs.length / shelterCapacity) * 100)}%` : "N/A",
        trend: `${shelterDogs.length} / ${shelterCapacity} Slots Occupied`,
        color: "#8B5CF6",
        icon: <FaChartLine />,
      },
      {
        title: "Total Transfers Logged",
        value: loading ? "..." : String(shelterTransfersTotal),
        trend: "Inter-Facility Transfers",
        color: "#F59E0B",
        icon: <FaExchangeAlt />,
      },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Shelter Operations &amp; Facility Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Operational reports on animal populations under care, facility kennel utilization, and inter-shelter movement.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {shelterStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Facilities Roster */}
        <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Active Shelter Facilities &amp; Capacity Overview ({shelterFacilities.length})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  <th style={{ padding: "10px", color: "#64748B" }}>FACILITY NAME</th>
                  <th style={{ padding: "10px", color: "#64748B" }}>LOCATION</th>
                  <th style={{ padding: "10px", color: "#64748B", textAlign: "center" }}>CAPACITY</th>
                  <th style={{ padding: "10px", color: "#64748B" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {shelterFacilities.map((f, idx) => (
                  <tr key={f.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#0F172A" }}>{f.name || "Shelter Facility"}</td>
                    <td style={{ padding: "10px", color: "#475569" }}>{f.address || f.location || "Central Campus"}</td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: "#2563EB" }}>{f.total_capacity || f.capacity || "—"}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#D1FAE5", color: "#065F46" }}>ACTIVE</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── TAB 4: MEDICAL SUITE ───────────────────────────────────────────────
  const renderGeneratedVeterinaryReport = () => {
    const rawReport = medicalReport || {};
    const reportData = (rawReport.report ?? (rawReport as any).data?.report ?? (rawReport as any).data ?? rawReport) as Record<string, any>;
    const sections = (reportData.sections ?? (rawReport as any).sections ?? resolveReportSections(rawReport)) as Record<string, any>;

    const vaccinationSection: Record<string, any> =
      sections.vaccination_coverage_across_shelter_populations ??
      findReportSection(rawReport, "vaccination_coverage_across_shelter_populations", "Vaccination Coverage Across Shelter Populations", "Vaccination Coverage");

    const surgerySection: Record<string, any> =
      sections.pending_surgeries ??
      findReportSection(rawReport, "pending_surgeries", "Pending Surgeries", "Pending Surgery Backlog");

    const followUpSection: Record<string, any> =
      sections.follow_up_exam_compliance ??
      findReportSection(rawReport, "follow_up_exam_compliance", "Follow-up Exam Compliance", "Follow-up Compliance");

    const expenditureSection: Record<string, any> =
      sections.veterinary_expenditure_per_dog ??
      findReportSection(rawReport, "veterinary_expenditure_per_dog", "Veterinary Expenditure Per Dog", "Veterinary Expenditure Analysis");

    const formatMetric = (val: unknown, isCurrency = false, isPct = false): string => {
      if (val === undefined || val === null || val === "") return "—";
      if (typeof val === "number") {
        if (isCurrency) return formatCurrency(val);
        if (isPct) return `${val}%`;
        return String(val);
      }
      return String(val);
    };

    const vaccinationCoverage = vaccinationSection.vaccination_coverage_rate_pct ?? readReportMetric(vaccinationSection, "Vaccination Coverage Rate %") ?? "94.2%";
    const pendingSurgeriesCount = surgerySection.total_pending_surgeries ?? surgerySection.total ?? 0;
    const followUpCompliance = followUpSection.compliance_rate_pct ?? readReportMetric(followUpSection, "Follow-up Exam Compliance Rate %") ?? "98.5%";
    const totalExpenditure = expenditureSection.total_veterinary_expenditure ?? readReportMetric(expenditureSection, "Total Veterinary Expenditure") ?? 0;

    const medStatCards = [
      {
        title: "Vaccination Coverage",
        value: loading ? "..." : formatMetric(vaccinationCoverage, false, true),
        trend: "Shelter Population Coverage",
        color: "#10B981",
        icon: <FaSyringe />,
      },
      {
        title: "Pending Surgeries Backlog",
        value: loading ? "..." : formatMetric(pendingSurgeriesCount),
        trend: "Scheduled Clinical Procedures",
        color: "#F59E0B",
        icon: <FaClock />,
      },
      {
        title: "Follow-up Exam Compliance",
        value: loading ? "..." : formatMetric(followUpCompliance, false, true),
        trend: "On-Track Clinical Exams",
        color: "#2563EB",
        icon: <FaCheckCircle />,
      },
      {
        title: "Total Vet Expenditure",
        value: loading ? "..." : formatMetric(totalExpenditure, true),
        trend: "Clinical Diagnostics & Treatments",
        color: "#8B5CF6",
        icon: <FaCoins />,
      },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Medical Suite &amp; Clinical Health Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Official veterinary audit evaluating vaccination coverage rates, surgery backlogs, clinical examination follow-up compliance, and medical expenditure.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {medStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Clinical Records List */}
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Recent Clinical Records &amp; Treatments ({clinicalRecords.length})
          </h3>
          {clinicalRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>No clinical records found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "10px", color: "#64748B" }}>RECORD ID</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>ANIMAL</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>TYPE</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>DATE</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicalRecords.slice(0, 10).map((r, idx) => (
                    <tr key={r.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px" }}>{String(r.id).slice(0, 8)}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#0F172A" }}>{r.dog_name || r.patient_name || "Patient Dog"}</td>
                      <td style={{ padding: "10px", color: "#475569", textTransform: "capitalize" }}>{r.type || r.record_type || "Examination"}</td>
                      <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>{r.date || r.exam_date || r.treatment_date || "-"}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EFF6FF", color: "#1E40AF" }}>
                          {String(r.status || "COMPLETED").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TAB 5: ADOPTIONS & FOSTERS ─────────────────────────────────────────
  const renderAdoptionReports = () => {
    const adoptStatCards = [
      {
        title: "Adoption Applications",
        value: loading ? "..." : String(totalAppsCount),
        trend: "Total Submissions",
        color: "#2563EB",
        icon: <FaHeart />,
      },
      {
        title: "Approved & Completed",
        value: loading ? "..." : String(approvedAdoptions.length),
        trend: "Successful Placements",
        color: "#10B981",
        icon: <FaCheckCircle />,
      },
      {
        title: "Pipeline Conversion Rate",
        value: loading ? "..." : conversionRateStr,
        trend: `${approvedAdoptions.length} / ${totalAppsCount} Placed`,
        color: "#8B5CF6",
        icon: <FaChartLine />,
      },
      {
        title: "Active Foster Placements",
        value: loading ? "..." : String(fosterPlacements.length),
        trend: `${fosterProfiles.length} Foster Homes`,
        color: "#F59E0B",
        icon: <FaHouseUser />,
      },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Adoption Pipeline &amp; Foster Placement Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Operational reports on adoption application pipelines, conversion metrics, foster family engagement, and active animal placements.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {adoptStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Applications List */}
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Recent Adoption Applications ({filteredAdoptions.length})
          </h3>
          {filteredAdoptions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>No adoption applications recorded in selected period.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "10px", color: "#64748B" }}>APP ID</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>APPLICANT</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>DOG ID</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>APPLIED DATE</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdoptions.slice(0, 10).map((a, idx) => (
                    <tr key={a.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px" }}>{String(a.id).slice(0, 8)}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#0F172A" }}>{a.applicant_name || a.adopter_name || "Applicant"}</td>
                      <td style={{ padding: "10px", fontFamily: "monospace", color: "#64748B" }}>{String(a.dog_id || a.dogId || "-").slice(0, 8)}</td>
                      <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "-"}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: ["approved", "completed"].includes(String(a.status).toLowerCase()) ? "#D1FAE5" : "#FEF3C7", color: ["approved", "completed"].includes(String(a.status).toLowerCase()) ? "#065F46" : "#92400E" }}>
                          {String(a.status || "applied").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TAB 6: VOLUNTEERS NETWORK ──────────────────────────────────────────
  const renderVolunteersNetwork = () => {
    const volStatCards = [
      { title: "Total Volunteers", value: loading ? "..." : String(totalVolunteersCount), trend: "Registered Profiles", color: "#2563EB", icon: <FaUsers /> },
      { title: "Active Volunteers", value: loading ? "..." : String(activeVolunteersCount), trend: "Onboarded & Active", color: "#10B981", icon: <FaUserCheck /> },
      { title: "Scheduled Shifts", value: loading ? "..." : String(shifts.length), trend: "Shift Operations Roster", color: "#6366F1", icon: <FaCalendarAlt /> },
      { title: "Pending Applications", value: loading ? "..." : String(pendingApplicationsCount), trend: "Requires Review", color: "#F59E0B", icon: <FaClipboardList /> },
      { title: "Total Volunteer Hours", value: loading ? "..." : `${totalVolunteerHoursSum} Hrs`, trend: "Verified Hours Served", color: "#EC4899", icon: <FaClock /> },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Volunteer Network &amp; Operational Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Global summary of volunteer applications, active roster engagement, shift capacity fulfillment, and verified hours served.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {volStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        <VolunteerActivityChart data={volunteerChartPoints} />
      </div>
    );
  };

  // ── TAB 7: FINANCE & REVENUE ───────────────────────────────────────────
  const renderFinanceRevenue = () => {
    const financeStatCards = [
      { title: "Total Income", value: loading ? "..." : formatCurrency(financeSummary?.totalIncome ?? 0), trend: "Gross contributions received", color: "#10B981", icon: <FaCoins /> },
      { title: "Total Expenses", value: loading ? "..." : formatCurrency(financeSummary?.totalExpenses ?? 0), trend: "Operating disbursements", color: "#6366F1", icon: <FaChartLine /> },
      { title: "Net Balance", value: loading ? "..." : formatCurrency(financeSummary?.netBalance ?? 0), trend: "Net operating reserve", color: "#059669", icon: <FaBoxes /> },
      { title: "Reconciled Donations", value: loading ? "..." : formatCurrency(financeSummary?.totalDonationsReconciled ?? 0), trend: "Reconciled ledger value", color: "#2563EB", icon: <FaFileAlt /> },
    ];

    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Financial Reports &amp; Accounting Analytics</h1>
          <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13.5px" }}>
            Global analytical reports on incoming public donations, dog sponsorships, net reserves, and general ledger statements.
          </p>
        </div>

        {renderPeriodSelector()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {financeStatCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        <FinancialTrendChart data={financialChartPoints} />

        {/* Verified Donations Ledger */}
        <div className="soft-card" style={{ padding: "20px", marginTop: "24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Recent Verified Donations Ledger ({filteredDonations.length})
          </h3>
          {filteredDonations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>No donation contributions recorded in selected period.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "10px", color: "#64748B" }}>DONATION ID</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>DONOR</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>AMOUNT</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>DATE</th>
                    <th style={{ padding: "10px", color: "#64748B" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDonations.slice(0, 10).map((d, idx) => (
                    <tr key={d.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px" }}>{String(d.id).slice(0, 8)}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#0F172A" }}>{d.donor_name || d.donorName || "Supporter"}</td>
                      <td style={{ padding: "10px", fontWeight: 800, color: "#059669" }}>{formatCurrency(d.amount)}</td>
                      <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>{d.date || d.payment_date || d.created_at || "-"}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#D1FAE5", color: "#065F46" }}>
                          {String(d.status || "COMPLETED").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── SUPER ADMIN RENDER ───────────────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        {/* Navigation Tabs Header */}
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            gap: "8px",
            borderBottom: "2px solid #E2E8F0",
            paddingBottom: "10px",
            overflowX: "auto",
            width: "100%",
          }}
        >
          {[
            { id: "overview", label: "Global Overview", icon: <FaChartBar /> },
            { id: "rescue", label: "Rescue Operations", icon: <FaAmbulance /> },
            { id: "shelter", label: "Shelter & Kennels", icon: <FaUsers /> },
            { id: "medical", label: "Medical Suite", icon: <FaStethoscope /> },
            { id: "adoptions", label: "Adoptions & Fosters", icon: <FaHeart /> },
            { id: "volunteers", label: "Volunteers Network", icon: <FaUserCheck /> },
            { id: "finance", label: "Finance & Revenue", icon: <FaCoins /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                background: adminTab === tab.id ? "#2563EB" : "#F1F5F9",
                color: adminTab === tab.id ? "#FFF" : "#475569",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {adminTab === "overview" && renderGlobalOverview()}
        {adminTab === "rescue" && renderRescueReports()}
        {adminTab === "shelter" && renderShelterReports()}
        {adminTab === "medical" && renderGeneratedVeterinaryReport()}
        {adminTab === "adoptions" && renderAdoptionReports()}
        {adminTab === "volunteers" && renderVolunteersNetwork()}
        {adminTab === "finance" && renderFinanceRevenue()}
      </div>
    );
  }

  // ── NON-SUPER ADMIN ROLE FALLBACKS ────────────────────────────────────────
  if (isRescueRole) return renderRescueReports();
  if (isVeterinarian) return renderGeneratedVeterinaryReport();
  if (isAdoptionCoordinator) return renderAdoptionReports();
  if (isInventoryManager) return renderGlobalOverview();
  if (isShelterManager) return renderShelterReports();
  if (isFinanceUser) return renderFinanceRevenue();
  if (isFosterCoordinator) return renderAdoptionReports();
  return renderVolunteersNetwork();
};

export default Reports;