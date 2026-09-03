import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { AdoptionChartPoint } from "../../utils/adoptionStats";

interface AdoptionChartProps {
  data?: AdoptionChartPoint[];
}

const AdoptionChart = ({ data = [] }: AdoptionChartProps) => {
  const total = data.reduce((sum, p) => sum + p.adoptions, 0);
  const thisMonth = data.length ? data[data.length - 1].adoptions : 0;
  const lastMonth = data.length > 1 ? data[data.length - 2].adoptions : 0;
  const growthPct =
    lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "20px",
        padding: "24px",
        marginTop: "30px",
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
          <h2 style={{ margin: 0, fontSize: "24px", color: "#0F172A" }}>
            Monthly Adoption Analytics
          </h2>

          <p style={{ marginTop: "6px", color: "#64748B", fontSize: "15px" }}>
            Live adoption trends over the last {data.length || 6} months
          </p>
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "14px" }}>
            This Month
          </p>
          <h3 style={{ margin: "6px 0 0", color: "#16A34A", fontSize: "30px" }}>
            {thisMonth}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "14px" }}>
            Last Month
          </p>
          <h3 style={{ margin: "6px 0 0", color: "#1E3A8A", fontSize: "30px" }}>
            {lastMonth}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "14px" }}>
            Growth
          </p>
          <h3 style={{ margin: "6px 0 0", color: "#F59E0B", fontSize: "30px" }}>
            {thisMonth === 0 && lastMonth === 0 ? "0%" : `${growthPct >= 0 ? "+" : ""}${growthPct}%`}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "14px" }}>
            Total (Period)
          </p>
          <h3 style={{ margin: "6px 0 0", color: "#0F172A", fontSize: "30px" }}>
            {total}
          </h3>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 330 }}>
        {data.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#94A3B8",
              fontSize: "15px",
            }}
          >
            No adoption records yet. New adoptions will appear here.
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="5 5" />

              <XAxis
                dataKey="month"
                tick={{ fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="adoptions"
                stroke="#1E3A8A"
                strokeWidth={4}
                dot={{ r: 6, fill: "#1E3A8A" }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default AdoptionChart;