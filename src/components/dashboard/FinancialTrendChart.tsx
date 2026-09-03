import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface FinancialChartPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

interface FinancialTrendChartProps {
  data?: FinancialChartPoint[];
}

const FinancialTrendChart = ({ data = [] }: FinancialTrendChartProps) => {
  const totalRevenue = data.reduce((sum, p) => sum + p.revenue, 0);
  const totalExpenses = data.reduce((sum, p) => sum + p.expenses, 0);
  const netBalance = totalRevenue - totalExpenses;
  const thisMonthRevenue = data.length ? data[data.length - 1].revenue : 0;
  const lastMonthRevenue = data.length > 1 ? data[data.length - 2].revenue : 0;
  const revenueGrowthPct =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : thisMonthRevenue > 0
      ? 100
      : 0;

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
            Financial Revenue &amp; Expense Trend
          </h2>
          <p style={{ marginTop: "6px", color: "#64748B", fontSize: "14px" }}>
            Monthly income, operational expenses, and net reserve trends over the last {data.length || 6} months
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
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Period Revenue</p>
          <h3 style={{ margin: "4px 0 0", color: "#16A34A", fontSize: "28px", fontWeight: 800 }}>
            ₹{totalRevenue.toLocaleString("en-IN")}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Period Expenses</p>
          <h3 style={{ margin: "4px 0 0", color: "#DC2626", fontSize: "28px", fontWeight: 800 }}>
            ₹{totalExpenses.toLocaleString("en-IN")}
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Net Reserve Growth</p>
          <h3 style={{ margin: "4px 0 0", color: "#F59E0B", fontSize: "28px", fontWeight: 800 }}>
            {revenueGrowthPct >= 0 ? "+" : ""}{revenueGrowthPct}%
          </h3>
        </div>

        <div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px", fontWeight: 600 }}>Net Balance</p>
          <h3 style={{ margin: "4px 0 0", color: "#1E3A8A", fontSize: "28px", fontWeight: 800 }}>
            ₹{netBalance.toLocaleString("en-IN")}
          </h3>
        </div>
      </div>

      {/* Chart Visualization */}
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
              formatter={(val: any, name: any) => [
                `₹${Number(val).toLocaleString("en-IN")}`,
                name === "revenue" ? "Revenue/Donations" : name === "expenses" ? "Expenses" : "Net Balance",
              ]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#16A34A"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#DC2626"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpenses)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FinancialTrendChart;
