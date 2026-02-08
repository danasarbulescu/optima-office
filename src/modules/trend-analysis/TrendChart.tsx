"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendDataPoint } from "@/lib/types";
import { formatAbbrev } from "@/lib/format";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonthLabel(val: string): string {
  const [y, m] = val.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]}${y.slice(2)}`;
}

function formatMonthFull(val: string): string {
  const [y, m] = val.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}

export default function TrendChart({
  data,
  entityName,
}: {
  data: TrendDataPoint[];
  entityName: string;
}) {
  return (
    <div className="trend-chart-container">
      <h2 className="trend-title">
        {entityName && <span className="trend-client">{entityName}</span>}
        Operating Expenses Trend
      </h2>
      <div className="trend-chart-card">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2b35" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#9a9caa" }}
              tickFormatter={formatMonthLabel}
              stroke="#3a3b48"
            />
            <YAxis
              tickFormatter={(val: number) => formatAbbrev(val)}
              tick={{ fontSize: 12, fill: "#9a9caa" }}
              stroke="#3a3b48"
            />
            <Tooltip
              formatter={(value, name) => [
                `$${Number(value).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                name === "expenses"
                  ? "Total Amount"
                  : "13M Avg",
              ]}
              labelFormatter={(label) => formatMonthFull(String(label))}
              contentStyle={{ backgroundColor: "#1e1f2a", border: "1px solid #2a2b35", borderRadius: 6, color: "#e1e2e8" }}
              labelStyle={{ color: "#9a9caa" }}
            />
            <Legend
              formatter={(value: string) =>
                value === "expenses"
                  ? "Total Amount"
                  : "13-Month Avg"
              }
            />
            <Line
              type="monotone"
              dataKey="expenses"
              name="expenses"
              stroke="#42a5f5"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="avg13"
              name="avg13"
              stroke="#ff7043"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
