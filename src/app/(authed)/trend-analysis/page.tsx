"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { useCompany } from "@/context/CompanyContext";
import "./trend-analysis.css";

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

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TrendAnalysisPage() {
  const { selectedCompany } = useCompany();
  const [startMonth, setStartMonth] = useState("2024-01");
  const [endMonth, setEndMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  const prevCompanyRef = useRef(selectedCompany);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/trend?startMonth=${startMonth}&endMonth=${endMonth}&company=${selectedCompany}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setClientName(json.clientName);
    } catch (err: any) {
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, selectedCompany]);

  useEffect(() => {
    if (prevCompanyRef.current !== selectedCompany) {
      prevCompanyRef.current = selectedCompany;
      fetchTrend();
    }
  }, [selectedCompany, fetchTrend]);

  return (
    <>
      <div className="trend-controls">
        <label>
          From:
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="month-picker"
          />
        </label>
        <label>
          To:
          <input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="month-picker"
          />
        </label>
        <button
          onClick={fetchTrend}
          disabled={loading}
          className="refresh-btn"
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {loading && <div className="app-loading">Loading trend data...</div>}
      {error && <div className="app-error">{error}</div>}

      {data.length > 0 && (
        <div className="trend-chart-container">
          <h2 className="trend-title">
            {clientName && <span className="trend-client">{clientName}</span>}
            Operating Expenses Trend
          </h2>
          <div className="trend-chart-card">
            <ResponsiveContainer width="100%" height={450}>
              <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatMonthLabel}
                />
                <YAxis
                  tickFormatter={(val: number) => formatAbbrev(val)}
                  tick={{ fontSize: 12 }}
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
                  stroke="#1a237e"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
