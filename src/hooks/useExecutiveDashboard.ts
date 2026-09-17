import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToDataChange } from "../utils/dataSync";
import { getActivityStream } from "../utils/eventSystem";
import { dashboardService } from "../services/dashboardService";
import { userService } from "../services/userService";
import { dogService } from "../services/dogService";
import { shelterService } from "../services/shelterService";
import { rescueService } from "../services/rescueService";
import { adoptionService } from "../services/adoptionService";
import { fosterService } from "../services/fosterService";
import { volunteerService } from "../services/volunteerService";
import { financeService } from "../services/financeService";
import donationsService from "../services/donationsService";
import inventoryService from "../services/inventoryService";
import medicalService from "../services/medicalService";
import { firstDefined, unwrapList } from "../utils/chartUtils";
import type { ActivityEntry, AnyRecord, DashboardSummary } from "../types/dashboard";
import { getRoleTitle } from "../utils/roleUtils";

export interface ExecutiveDashboardData {
  summary: DashboardSummary;
  users: AnyRecord[];
  dogs: AnyRecord[];
  shelters: AnyRecord[];
  rescues: AnyRecord[];
  adoptions: AnyRecord[];
  fosters: AnyRecord[];
  volunteers: AnyRecord[];
  inventory: AnyRecord[];
  medical: AnyRecord[];
  finance: AnyRecord[];
  donations: AnyRecord[];
  financeSummary: AnyRecord | null;
  activities: ActivityEntry[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const unwrapObject = (value: unknown): DashboardSummary => {
  if (!value || typeof value !== "object") return {};
  const obj = value as AnyRecord;
  if (obj.data && typeof obj.data === "object") return obj.data as DashboardSummary;
  if (obj.summary && typeof obj.summary === "object") return obj.summary as DashboardSummary;
  if (obj.dashboard && typeof obj.dashboard === "object") return obj.dashboard as DashboardSummary;
  return obj as unknown as DashboardSummary;
};

const isUuid = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

const normalizeActivity = (raw: AnyRecord, usersMap?: Map<string, string>): ActivityEntry | null => {
  const eventStr = String(
    firstDefined(raw.event_type, raw.action, raw.title, raw.activity, raw.event, raw.description, raw.message) ?? ""
  ).trim();
  if (!eventStr) return null;

  const timeRaw = firstDefined(raw.created_at, raw.time, raw.timestamp, raw.date);

  let actorName = String(
    firstDefined(
      raw.full_name,
      raw.user_name,
      raw.email,
      raw.username,
      raw.user,
      raw.actor,
      raw.performed_by
    ) ?? ""
  ).trim();

  if (actorName && isUuid(actorName) && usersMap && usersMap.has(actorName.toLowerCase())) {
    actorName = usersMap.get(actorName.toLowerCase())!;
  }

  const roleRaw = firstDefined(
    raw.role,
    Array.isArray(raw.roles) ? raw.roles[0] : null
  );

  const roleTitleStr = roleRaw ? getRoleTitle(String(roleRaw)) : "";
  const actorStr = actorName
    ? roleTitleStr && roleTitleStr !== "Unknown Role" && !actorName.includes("•")
      ? `${actorName} • ${roleTitleStr}`
      : String(actorName)
    : "System";

  const actionFormatted = eventStr
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    id: (firstDefined(raw.id, raw.activity_id, raw.log_id) as ActivityEntry["id"]) ??
      `ACT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user: actorStr,
    action: actionFormatted,
    module: String(firstDefined(raw.module, raw.event_type, raw.category, raw.type, raw.entity) ?? "system"),
    time: timeRaw ? String(timeRaw) : "Just now",
    status: String(firstDefined(raw.status, raw.result, raw.state) ?? "Success"),
    raw,
  };
};

const mergeActivities = (apiItems: ActivityEntry[], stream: ActivityEntry[]): ActivityEntry[] => {
  const seen = new Set<string>();
  const merged: ActivityEntry[] = [];
  [...apiItems, ...stream].forEach((entry) => {
    const key = String(entry.id);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  });
  return merged.sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return timeB - timeA;
  }).slice(0, 15);
};

export function useExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveDashboardData>({
    summary: {},
    users: [],
    dogs: [],
    shelters: [],
    rescues: [],
    adoptions: [],
    fosters: [],
    volunteers: [],
    inventory: [],
    medical: [],
    finance: [],
    donations: [],
    financeSummary: null,
    activities: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setData((prev) => ({ ...prev, loading: prev.lastUpdated === null, error: null }));

    // Fetch aggregate summary, live resource collections & recent activities/audit logs concurrently
    const results = await Promise.allSettled([
      dashboardService.getSuperAdminDashboard().catch(() => ({})),
      userService.getUsers().catch(() => []),
      dogService.getAllDogs().catch(() => []),
      shelterService.getShelters().catch(() => []),
      rescueService.getRescueCases().catch(() => []),
      adoptionService.getAdoptions().catch(() => []),
      fosterService.getFosterPlacements().catch(() => []),
      volunteerService.getVolunteers().catch(() => []),
      donationsService.getDonations().catch(() => []),
      financeService.getFinanceSummary().catch(() => null),
      donationsService.getDonationSummary().catch(() => null),
      dashboardService.getAuditLogs({ limit: 25 }).catch(() => dashboardService.getRecentActivities(25).catch(() => [])),
      inventoryService.getInventory({ page_size: 500 }).catch(() => []),
      medicalService.getMedicalRecords().catch(() => []),
      financeService.getTransactions().catch(() => financeService.getExpenses().catch(() => [])),
    ]);

    if (requestId !== requestIdRef.current) return;

    const [
      summaryRes,
      usersRes,
      dogsRes,
      sheltersRes,
      rescuesRes,
      adoptionsRes,
      fostersRes,
      volunteersRes,
      donationsRes,
      financeSummaryRes,
      donSummaryRes,
      activitiesRes,
      inventoryRes,
      medicalRes,
      financeTransactionsRes,
    ] = results;

    const summaryObj = unwrapObject(summaryRes.status === "fulfilled" ? summaryRes.value : {});
    const usersList = unwrapList(usersRes.status === "fulfilled" ? usersRes.value : []);
    const dogsList = unwrapList(dogsRes.status === "fulfilled" ? dogsRes.value : []);
    const sheltersList = unwrapList(sheltersRes.status === "fulfilled" ? sheltersRes.value : []);
    const rescuesList = unwrapList(rescuesRes.status === "fulfilled" ? rescuesRes.value : []);
    const adoptionsList = unwrapList(adoptionsRes.status === "fulfilled" ? (adoptionsRes.value as any)?.data ?? adoptionsRes.value : []);
    const fostersList = unwrapList(fostersRes.status === "fulfilled" ? fostersRes.value : []);
    const volunteersList = unwrapList(volunteersRes.status === "fulfilled" ? volunteersRes.value : []);
    const donationsList = unwrapList(donationsRes.status === "fulfilled" ? (donationsRes.value as any)?.data ?? donationsRes.value : []);
    const inventoryVal: any = inventoryRes.status === "fulfilled" ? inventoryRes.value : [];
    const inventoryList = unwrapList(inventoryVal?.data ?? inventoryVal);
    const medicalVal: any = medicalRes.status === "fulfilled" ? medicalRes.value : [];
    const medicalList = unwrapList(medicalVal?.data ?? medicalVal);
    const financeVal: any = financeTransactionsRes.status === "fulfilled" ? financeTransactionsRes.value : [];
    const financeList = unwrapList(financeVal?.data ?? financeVal);

    const finSummaryVal = financeSummaryRes.status === "fulfilled" ? financeSummaryRes.value : null;
    const donSummaryVal = donSummaryRes.status === "fulfilled" ? donSummaryRes.value : null;
    const rawFinObj = (finSummaryVal || donSummaryVal || null) as AnyRecord | null;
    const financeSummaryObj = (rawFinObj?.data ?? rawFinObj ?? null) as AnyRecord | null;

    // Create a map for resolving user UUIDs to full names
    const usersMap = new Map<string, string>();
    usersList.forEach((u) => {
      if (u && typeof u === "object") {
        const id = String(u.id ?? u.user_id ?? "").trim().toLowerCase();
        const name = String(u.full_name ?? u.name ?? u.email ?? "").trim();
        if (id && name) usersMap.set(id, name);
      }
    });

    const activities = mergeActivities(
      unwrapList(activitiesRes.status === "fulfilled" ? activitiesRes.value : [])
        .map((act) => normalizeActivity(act, usersMap))
        .filter((a): a is ActivityEntry => a !== null),
      getActivityStream()
        .map((item) => normalizeActivity(item as unknown as AnyRecord, usersMap))
        .filter((a): a is ActivityEntry => a !== null)
    );

    const hasError =
      summaryRes.status === "rejected" &&
      usersList.length === 0 &&
      dogsList.length === 0 &&
      sheltersList.length === 0;

    setData({
      summary: summaryObj,
      users: usersList,
      dogs: dogsList,
      shelters: sheltersList,
      rescues: rescuesList,
      adoptions: adoptionsList,
      fosters: fostersList,
      volunteers: volunteersList,
      inventory: inventoryList,
      medical: medicalList,
      finance: financeList,
      donations: donationsList,
      financeSummary: financeSummaryObj || summaryObj,
      activities,
      loading: false,
      error: hasError ? "Dashboard summary data currently unavailable." : null,
      lastUpdated: new Date(),
    });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refresh();
    }, 0);
    const unsubscribe = subscribeToDataChange(() => {
      refresh();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  return { ...data, refresh, refreshing };
}

export default useExecutiveDashboard;
