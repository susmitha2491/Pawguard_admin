import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  buildMonthlyTrend,
  buildShelterOccupancy,
  buildStatusDistribution,
  buildUserRoleDistribution,
  getString,
  type DistributionPoint,
} from "../../utils/chartUtils";
import type { AnyRecord } from "../../types/dashboard";

interface AnalyticsChartsProps {
  adoptions: AnyRecord[];
  rescues: AnyRecord[];
  finance: AnyRecord[];
  donations?: AnyRecord[];
  inventory: AnyRecord[];
  medical: AnyRecord[];
  shelters?: AnyRecord[];
  users: AnyRecord[];
  loading?: boolean;
  error?: string | null;
}

const isIncome = (record: AnyRecord): boolean =>
  /donation|income|grant|fundraising|sponsor|revenue|inflow/i.test(
    getString(record, "type", "category", "transaction_type", "description")
  );

interface ChartCardProps {
  title: string;
  subtitle: string;
  hasData: boolean;
  loading?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: "#0F172A",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "12px",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
  padding: "6px 10px",
};

const tooltipItemStyle: React.CSSProperties = {
  color: "#F8FAFC",
  fontSize: "12px",
  fontWeight: 500,
};

const tooltipLabelStyle: React.CSSProperties = {
  color: "#94A3B8",
  fontWeight: 600,
  fontSize: "11px",
  marginBottom: "3px",
};

const ChartCard = ({
  title,
  subtitle,
  hasData,
  loading = false,
  emptyMessage = "No records available for the selected period.",
  children,
}: ChartCardProps) => (
  <div className="analytics-chart-card">
    <div style={{ flexShrink: 0, marginBottom: "10px" }}>
      <h4
        title={title}
        style={{
          margin: 0,
          fontSize: "13.5px",
          fontWeight: 700,
          color: "#0F172A",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </h4>
      <p
        title={subtitle}
        style={{
          margin: "2px 0 0",
          fontSize: "11px",
          color: "#64748B",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {subtitle}
      </p>
    </div>

    <div
      style={{
        flex: "1 1 0",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "8px",
            color: "#94A3B8",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              border: "3px solid #E2E8F0",
              borderTopColor: "#2563EB",
              borderRadius: "50%",
              animation: "dashSpin 1s linear infinite",
            }}
          />
          <span>Loading analytics...</span>
        </div>
      ) : hasData ? (
        children
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#64748B",
            fontSize: "12px",
            background: "#F8FAFC",
            borderRadius: "8px",
            padding: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, color: "#475569", marginBottom: "3px" }}>No Data Recorded</div>
          <div style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.4 }}>{emptyMessage}</div>
        </div>
      )}
    </div>
  </div>
);

const renderDonutLegend = (data: DistributionPoint[], maxHeight = "70px") => (
  <div
    style={{
      flex: "1 1 0",
      minHeight: 0,
      maxHeight,
      overflowY: "auto",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px 8px",
      paddingTop: "6px",
      width: "100%",
    }}
  >
    {data.map((d) => (
      <div
        key={d.name}
        title={`${d.name}: ${d.value}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: "11px",
          color: "#334155",
          background: "#F8FAFC",
          padding: "2px 7px",
          borderRadius: "6px",
          border: "1px solid #E2E8F0",
          maxWidth: "100%",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
        <span
          style={{
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "90px",
          }}
        >
          {d.name}
        </span>
        <span style={{ fontWeight: 700, color: "#0F172A", marginLeft: 2 }}>{d.value}</span>
      </div>
    ))}
  </div>
);

const formatINRCompact = (amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
  return `₹${amount}`;
};

const AnalyticsCharts = ({
  adoptions = [],
  rescues = [],
  finance = [],
  donations = [],
  inventory = [],
  medical = [],
  shelters = [],
  users = [],
  loading = false,
}: AnalyticsChartsProps) => {
  const adoptionTrend = buildMonthlyTrend(adoptions, { count: 6 });
  const rescueTrend = buildMonthlyTrend(rescues, { count: 6 });

  // Use real donations list from GET /api/v1/donations (or finance income fallback)
  const validDonations =
    Array.isArray(donations) && donations.length > 0
      ? donations.filter((d) => !/failed|refunded|cancelled|declined/i.test(getString(d, "status")))
      : finance.filter(isIncome);

  const donationTrend = buildMonthlyTrend(validDonations, { valueKey: "amount", count: 6 });
  const inventoryStatus = buildStatusDistribution(inventory, "status");
  const adoptionPipeline = buildStatusDistribution(adoptions, "status");
  const medicalStatus = buildStatusDistribution(medical, "status");
  const shelterOccupancy = buildShelterOccupancy(shelters, 5);
  const userRoles = buildUserRoleDistribution(users);

  const hasAdoptionData = adoptions.length > 0 || adoptionTrend.some((p) => p.value > 0);
  const hasRescueData = rescues.length > 0 || rescueTrend.some((p) => p.value > 0);
  const hasDonationData = validDonations.length > 0 || donationTrend.some((p) => p.value > 0);
  const hasInventoryData = inventory.length > 0 && inventoryStatus.length > 0;
  const hasAdoptionPipelineData = adoptions.length > 0 && adoptionPipeline.length > 0;
  const hasMedicalData = medical.length > 0 && medicalStatus.length > 0;
  const hasShelterData = shelters.length > 0 && shelterOccupancy.length > 0;
  const hasUserData = users.length > 0 && userRoles.length > 0;

  return (
    <div className="analytics-dashboard-grid">
      {/* 1. Monthly Adoption Trend */}
      <ChartCard
        title="Monthly Adoption Trend"
        subtitle="Adoptions per month (last 6 months)"
        hasData={hasAdoptionData}
        loading={loading}
        emptyMessage="No adoption records logged in the last 6 months."
      >
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={adoptionTrend} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={false} tickLine={false} dy={4} />
              <YAxis allowDecimals={false} width={28} tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Adoptions"
                stroke="#EC4899"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#EC4899", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 2. Monthly Rescue Trend */}
      <ChartCard
        title="Monthly Rescue Trend"
        subtitle="Rescue cases per month (last 6 months)"
        hasData={hasRescueData}
        loading={loading}
        emptyMessage="No rescue cases logged in the last 6 months."
      >
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rescueTrend} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="rescueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={false} tickLine={false} dy={4} />
              <YAxis allowDecimals={false} width={28} tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Rescues"
                stroke="#EF4444"
                strokeWidth={2.5}
                fill="url(#rescueGrad)"
                dot={{ r: 3.5, fill: "#EF4444", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 3. Donations Trend */}
      <ChartCard
        title="Donations Trend"
        subtitle="Incoming donation value (last 6 months)"
        hasData={hasDonationData}
        loading={loading}
        emptyMessage="No donation contributions recorded in the selected period."
      >
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={donationTrend} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={false} tickLine={false} dy={4} />
              <YAxis
                width={44}
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatINRCompact}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Donations"]}
              />
              <Bar dataKey="value" name="Donations" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 4. Inventory Status */}
      <ChartCard
        title="Inventory Status"
        subtitle="Items grouped by stock status"
        hasData={hasInventoryData}
        loading={loading}
        emptyMessage="No inventory stock catalog entries found."
      >
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>
          <div style={{ height: "135px", width: "100%", minWidth: 0, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {inventoryStatus.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {renderDonutLegend(inventoryStatus, "75px")}
        </div>
      </ChartCard>

      {/* 5. Adoption Pipeline */}
      <ChartCard
        title="Adoption Pipeline"
        subtitle="Adoption applications by status"
        hasData={hasAdoptionPipelineData}
        loading={loading}
        emptyMessage="No adoption applications currently logged."
      >
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adoptionPipeline} layout="vertical" margin={{ top: 6, right: 20, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name)}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(val, _n, item) => [val, (item as any)?.payload?.name || "Applications"]}
              />
              <Bar dataKey="value" name="Applications" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {adoptionPipeline.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 6. Medical Cases */}
      <ChartCard
        title="Medical Cases"
        subtitle="Exams grouped by health status"
        hasData={hasMedicalData}
        loading={loading}
        emptyMessage="No clinical examination or treatment cases logged."
      >
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>
          <div style={{ height: "135px", width: "100%", minWidth: 0, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={medicalStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {medicalStatus.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {renderDonutLegend(medicalStatus, "75px")}
        </div>
      </ChartCard>

      {/* 7. Shelter Occupancy Overview */}
      <ChartCard
        title="Shelter Occupancy Overview"
        subtitle="Occupied vs capacity per facility"
        hasData={hasShelterData}
        loading={loading}
        emptyMessage="No shelter facility capacity records logged."
      >
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shelterOccupancy} layout="vertical" margin={{ top: 6, right: 10, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={82}
                tick={{ fill: "#334155", fontSize: 9.5, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name)}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(val, name, item) => [`${val} (${name})`, (item as any)?.payload?.name || "Shelter"]}
              />
              <Legend wrapperStyle={{ fontSize: 10.5, paddingTop: 2 }} />
              <Bar dataKey="occupied" name="Occupied" fill="#1E3A8A" radius={[0, 3, 3, 0]} maxBarSize={12} />
              <Bar dataKey="capacity" name="Capacity" fill="#CBD5E1" radius={[0, 3, 3, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 8. User Role Distribution */}
      <ChartCard
        title="User Role Distribution"
        subtitle="Active users grouped by role"
        hasData={hasUserData}
        loading={loading}
        emptyMessage="No active user accounts found."
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            height: "100%",
            minHeight: 0,
            width: "100%",
            minWidth: 0,
          }}
        >
          {/* Donut Chart Left */}
          <div style={{ flex: "0 0 100px", height: "100%", minWidth: 0, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userRoles}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={38}
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                >
                  {userRoles.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Right */}
          <div
            style={{
              flex: "1 1 0",
              minWidth: 0,
              height: "100%",
              maxHeight: "180px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingRight: "2px",
            }}
          >
            {userRoles.map((d) => (
              <div
                key={d.name}
                title={`${d.name}: ${d.value}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  fontSize: "11px",
                  color: "#475569",
                  minWidth: 0,
                  padding: "1px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: "1 1 0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontSize: "10.5px",
                    }}
                  >
                    {d.name}
                  </span>
                </div>
                <span style={{ fontWeight: 700, color: "#0F172A", fontSize: "11px", flexShrink: 0, marginLeft: 4 }}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
};

export default AnalyticsCharts;
