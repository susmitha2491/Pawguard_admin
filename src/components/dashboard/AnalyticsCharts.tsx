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
}

const isIncome = (record: AnyRecord): boolean =>
  /donation|income|grant|fundraising|sponsor|revenue|inflow/i.test(
    getString(record, "type", "category", "transaction_type", "description")
  );

interface ChartCardProps {
  title: string;
  subtitle: string;
  hasData: boolean;
  children: React.ReactNode;
  height?: number;
}

const ChartCard = ({ title, subtitle, hasData, children, height = 260 }: ChartCardProps) => (
  <div
    style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "14px",
      padding: "16px 16px 18px",
      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
    }}
  >
    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{title}</h4>
    <p style={{ margin: "3px 0 0", fontSize: "11.5px", color: "#94A3B8" }}>{subtitle}</p>
    <div style={{ width: "100%", minWidth: 0, height, marginTop: "12px" }}>
      {hasData ? (
        children
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#94A3B8",
            fontSize: "13px",
          }}
        >
          No data yet
        </div>
      )}
    </div>
  </div>
);

const renderPieLabels = (data: DistributionPoint[]) => (
  <ul
    style={{
      listStyle: "none",
      margin: "10px 0 0",
      padding: 0,
      display: "flex",
      flexWrap: "wrap",
      gap: "8px 14px",
    }}
  >
    {data.map((d) => (
      <li key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11.5px", color: "#475569" }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
        {d.name} · {d.value}
      </li>
    ))}
  </ul>
);

const AnalyticsCharts = ({
  adoptions,
  rescues,
  finance,
  donations = [],
  inventory,
  medical,
  shelters = [],
  users,
}: AnalyticsChartsProps) => {
  const adoptionTrend = buildMonthlyTrend(adoptions, { count: 6 });
  const rescueTrend = buildMonthlyTrend(rescues, { count: 6 });

  // Use real donations list from GET /api/v1/donations (or finance income fallback)
  const validDonations = Array.isArray(donations) && donations.length > 0
    ? donations.filter((d) => !/failed|refunded|cancelled|declined/i.test(getString(d, "status")))
    : finance.filter(isIncome);

  const donationTrend = buildMonthlyTrend(validDonations, { valueKey: "amount", count: 6 });
  const inventoryStatus = buildStatusDistribution(inventory);
  const adoptionPipeline = buildStatusDistribution(adoptions);
  const medicalStatus = buildStatusDistribution(medical);
  const shelterOccupancy = buildShelterOccupancy(shelters, 6);
  const userRoles = buildUserRoleDistribution(users);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
        gap: "14px",
      }}
    >
      <ChartCard title="Monthly Adoption Trend" subtitle="Adoptions per month (last 6 months)" hasData={Array.isArray(adoptions)}>
        <ResponsiveContainer>
          <LineChart data={adoptionTrend}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" />
            <XAxis dataKey="month" tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="Adoptions" stroke="#EC4899" strokeWidth={3} dot={{ r: 4, fill: "#EC4899" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly Rescue Trend" subtitle="Rescue cases per month (last 6 months)" hasData={Array.isArray(rescues)}>
        <ResponsiveContainer>
          <AreaChart data={rescueTrend}>
            <defs>
              <linearGradient id="rescueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" />
            <XAxis dataKey="month" tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="value" name="Rescues" stroke="#EF4444" strokeWidth={2.5} fill="url(#rescueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Donations Trend" subtitle="Incoming donation value per month (last 6 months)" hasData={Array.isArray(donations) || Array.isArray(finance)}>
        <ResponsiveContainer>
          <BarChart data={donationTrend}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" />
            <XAxis dataKey="month" tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
            <Bar dataKey="value" name="Donations" fill="#10B981" radius={[5, 5, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Inventory Status" subtitle="Items grouped by stock status" hasData={inventoryStatus.length > 0}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={inventoryStatus} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {inventoryStatus.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {renderPieLabels(inventoryStatus)}
      </ChartCard>

      <ChartCard title="Adoption Pipeline" subtitle="Adoption applications by status" hasData={adoptionPipeline.length > 0}>
        <ResponsiveContainer>
          <BarChart data={adoptionPipeline} layout="vertical">
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" name="Applications" radius={[0, 5, 5, 0]} maxBarSize={22}>
              {adoptionPipeline.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Medical Cases" subtitle="Exams grouped by health status" hasData={medicalStatus.length > 0}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={medicalStatus} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {medicalStatus.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {renderPieLabels(medicalStatus)}
      </ChartCard>

      <ChartCard title="Shelter Occupancy Overview" subtitle="Occupied vs capacity per facility" hasData={shelterOccupancy.length > 0}>
        <ResponsiveContainer>
          <BarChart data={shelterOccupancy} layout="vertical" margin={{ left: 5, right: 15, top: 5, bottom: 5 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={115} tick={{ fill: "#334155", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="occupied" name="Occupied" fill="#1E3A8A" radius={[0, 4, 4, 0]} maxBarSize={16} />
            <Bar dataKey="capacity" name="Capacity" fill="#CBD5E1" radius={[0, 4, 4, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="User Role Distribution" subtitle="Active users grouped by role" hasData={userRoles.length > 0}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            height: "100%",
            minHeight: 0,
            padding: "0 4px",
          }}
        >
          <div style={{ flex: "1 1 0", minWidth: 0, height: "100%", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userRoles}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {userRoles.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              width: 124,
              flexShrink: 0,
              maxHeight: "100%",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {userRoles.map((d) => (
              <li
                key={d.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "11.5px",
                  color: "#475569",
                  minWidth: 0,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ flex: "1 1 0", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.name}
                </span>
                <span style={{ fontWeight: 700, color: "#334155", flexShrink: 0 }}>{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>
    </div>
  );
};

export default AnalyticsCharts;
