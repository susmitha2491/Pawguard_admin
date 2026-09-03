import type { AnyRecord } from "../types/dashboard";

export const unwrapList = (value: unknown): AnyRecord[] => {
  if (Array.isArray(value)) return value as AnyRecord[];
  if (value && typeof value === "object") {
    const obj = value as AnyRecord;
    for (const key of ["data", "results", "items", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as AnyRecord[];
    }
  }
  return [];
};

export const firstDefined = (...values: unknown[]): unknown =>
  values.find((v) => v !== undefined && v !== null && v !== "") ?? null;

export const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getString = (record: AnyRecord, ...keys: string[]): string => {
  const v = firstDefined(...keys.map((k) => record[k]));
  return v === null ? "" : String(v).trim();
};

export const getRecordDate = (record: AnyRecord): Date | null => {
  const raw = firstDefined(
    record.created_at,
    record.created_date,
    record.registered_at,
    record.timestamp,
    record.date,
    record.payment_date,
    record.submitted_at,
    record.requested_at,
    record.recorded_at,
    record.adoption_date,
    record.transaction_date,
    record.donation_date,
    record.start_date,
    record.updated_at
  );
  if (!raw) return null;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
};

export const monthLabel = (d: Date): string =>
  d.toLocaleDateString("en-US", { month: "short" });

export interface MonthlyTrendPoint {
  month: string;
  value: number;
}

export function buildMonthlyTrend(
  records: AnyRecord[],
  options: { valueKey?: string; count?: number } = {}
): MonthlyTrendPoint[] {
  const { valueKey, count = 6 } = options;
  const byMonth = new Map<string, number>();

  records.forEach((record) => {
    const d = getRecordDate(record);
    if (!d) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let amount = 1;
    if (valueKey) {
      const v = firstDefined(record[valueKey], record.amount, record.total_amount, record.value, record.price);
      const strVal = String(v ?? "").replace(/[^0-9.]/g, "");
      amount = toNumber(strVal);
    }
    byMonth.set(key, (byMonth.get(key) || 0) + amount);
  });

  const now = new Date();
  const points: MonthlyTrendPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    points.push({ month: monthLabel(d), value: byMonth.get(key) || 0 });
  }
  return points;
}

export interface DistributionPoint {
  name: string;
  value: number;
  color: string;
}

const PALETTE = [
  "#1E3A8A",
  "#16A34A",
  "#F59E0B",
  "#DC2626",
  "#0F172A",
  "#475569",
  "#94A3B8",
  "#64748B",
];

const toDistribution = (
  counts: Map<string, number>,
  limit = 6
): DistributionPoint[] =>
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value], idx) => ({ name, value, color: PALETTE[idx % PALETTE.length] }));

export function buildStatusDistribution(
  records: AnyRecord[],
  statusKey = "status"
): DistributionPoint[] {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    const raw = firstDefined(record[statusKey], record.condition, record.health_status);
    if (raw === null) return;
    const label = String(raw).trim();
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return toDistribution(counts);
}

export function buildUserRoleDistribution(users: AnyRecord[]): DistributionPoint[] {
  const counts = new Map<string, number>();
  users.forEach((u) => {
    let role = "";
    const roles = u.roles;
    if (Array.isArray(roles) && roles.length > 0) {
      const first = roles[0];
      role =
        typeof first === "string"
          ? first
          : getString(first as AnyRecord, "name", "role", "slug", "title");
    } else {
      const r = firstDefined(u.role, u.role_name, u.user_type, u.type);
      if (r !== null && typeof r === "object") {
        role = getString(r as AnyRecord, "name", "role", "slug", "title");
      } else if (r !== null) {
        role = String(r);
      }
    }
    if (!role) return;
    const label = role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return toDistribution(counts);
}

export interface ShelterOccupancyPoint {
  name: string;
  capacity: number;
  occupied: number;
}

export function buildShelterOccupancy(
  shelters: AnyRecord[],
  limit = 8
): ShelterOccupancyPoint[] {
  return shelters.slice(0, limit).map((s) => {
    const capacity = toNumber(firstDefined(s.capacity, s.total_capacity, s.max_capacity));
    const occupied = toNumber(
      firstDefined(s.occupied, s.current_occupancy, s.occupancy, s.occupants, s.total_dogs)
    );
    return {
      name: getString(s, "name", "facility_name", "location") || `Shelter ${getString(s, "id", "code")}`,
      capacity,
      occupied,
    };
  });
}

export const matchesStatus = (record: AnyRecord, pattern: RegExp): boolean =>
  pattern.test(getString(record, "status", "condition", "state"));

export const isPending = (record: AnyRecord): boolean =>
  /pending|in progress|assigned|submitted|open|new|available|not yet started/i.test(
    getString(record, "status", "state", "stage")
  );

export const isSuccessful = (record: AnyRecord): boolean =>
  /completed|resolved|success|approved|discharged|adopted|finalized|placed/i.test(
    getString(record, "status", "state")
  );

export const isCritical = (record: AnyRecord): boolean =>
  /critical|emergency|urgent|severe|crashed/i.test(
    getString(record, "status", "condition", "severity", "triage")
  );

export const isFailed = (record: AnyRecord): boolean =>
  /failed|rejected|cancelled|declined|refunded/i.test(
    getString(record, "status", "payment_status", "state")
  );

export const isLowStockItem = (item: AnyRecord): boolean => {
  const status = getString(item, "status", "stock_status");
  if (/low|out of stock|critical|reorder/i.test(status)) return true;
  const stock = toNumber(firstDefined(item.stock, item.quantity, item.current_stock));
  const threshold = toNumber(firstDefined(item.threshold, item.min_stock, item.reorder_level));
  return threshold > 0 && stock <= threshold;
};

export const isCriticalStock = (item: AnyRecord): boolean => {
  const status = getString(item, "status", "stock_status");
  if (/out of stock|critical/i.test(status)) return true;
  const stock = toNumber(firstDefined(item.stock, item.quantity, item.current_stock));
  const threshold = toNumber(firstDefined(item.threshold, item.min_stock, item.reorder_level));
  return threshold > 0 && stock === 0;
};

export const isOverCapacity = (shelter: AnyRecord): boolean => {
  const capacity = toNumber(firstDefined(shelter.capacity, shelter.total_capacity, shelter.max_capacity));
  const occupied = toNumber(
    firstDefined(shelter.occupied, shelter.current_occupancy, shelter.occupancy, shelter.occupants, shelter.total_dogs)
  );
  return capacity > 0 && occupied >= capacity;
};

export const vaccinationDue = (record: AnyRecord): boolean => {
  const nextRaw = firstDefined(record.next_due_date, record.due_date, record.next_vaccination);
  if (nextRaw === null) return false;
  const d = new Date(String(nextRaw));
  if (isNaN(d.getTime())) return false;
  const diffDays = (d.getTime() - Date.now()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
};
