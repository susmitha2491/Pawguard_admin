import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface VolunteerChartPoint {
  month: string;
  activity: number;
}

interface VolunteerActivityChartProps {
  data?: VolunteerChartPoint[];
}

const VolunteerActivityChart = ({ data = [] }: VolunteerActivityChartProps) => {
  const total = data.reduce((sum, p) => sum + p.activity, 0);
  const thisMonth = data.length ? data[data.length - 1].activity : 0;
  const lastMonth = data.length > 1 ? data[data.length - 2].activity : 0;
  const growthPct =
    lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "20px",
        padding: "24px",
        marginTop: "24px",
        border: "1px solid #E2E8F0",
        boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "25px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", color: "#0F172A", fontWeight: 800 }}>
            Volunteer Activity &amp; Hours Trend
          </h2>
          <p style={{ marginTop: "6px", color: "#64748B", fontSize: "14px" }}>
            Monthly verified volunteer contribution trends over the last {data.length || 6} months
          </p>
        </div>
      </div>

      {/* Summary Row */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>This Month</p>
          <h3 style={{ margin: "4px 0 0", color: "#16A34A", fontSize: "28px", fontWeight: 800 }}>
            {thisMonth} Hrs
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Last Month</p>
          <h3 style={{ margin: "4px 0 0", color: "#1E3A8A", fontSize: "28px", fontWeight: 800 }}>
            {lastMonth} Hrs
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Growth</p>
          <h3 style={{ margin: "4px 0 0", color: "#F59E0B", fontSize: "28px", fontWeight: 800 }}>
            {thisMonth === 0 && lastMonth === 0 ? "0%" : `${growthPct >= 0 ? "+" : ""}${growthPct}%`}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Total (6-Month Period)</p>
          <h3 style={{ margin: "4px 0 0", color: "#0F172A", fontSize: "28px", fontWeight: 800 }}>
            {total} Hrs
          </h3>
        </div>
      </div>

      {/* Chart Visualization */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0F172A",
                border: "none",
                borderRadius: "8px",
                color: "#FFF",
                fontSize: "12px",
              }}
              formatter={(val: any) => [`${val} Hours Served`, "Volunteer Activity"]}
            />
            <Line
              type="monotone"
              dataKey="activity"
              stroke="#1E3A8A"
              strokeWidth={3}
              dot={{ r: 5, fill: "#1E3A8A" }}
              activeDot={{ r: 8, fill: "#1E3A8A" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VolunteerActivityChart;
