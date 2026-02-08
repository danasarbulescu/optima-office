"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { TrendDataPoint } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import "./trend-analysis.css";

const TrendChart = dynamic(() => import("./TrendChart"), {
  loading: () => <div className="app-loading">Loading chart...</div>,
  ssr: false,
});

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TrendAnalysisPage() {
  const { selectedEntities } = useEntity();
  const [startMonth, setStartMonth] = useState("2024-01");
  const [endMonth, setEndMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entityName, setEntityName] = useState("");
  const fetchTrend = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/trend?startMonth=${startMonth}&endMonth=${endMonth}&entities=${selectedEntities.join(',')}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setEntityName(json.entityName);
    } catch (err: any) {
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, selectedEntities]);

  useEffect(() => {
    if (selectedEntities.length > 0) {
      fetchTrend();
    }
  }, [selectedEntities, fetchTrend]);

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
          onClick={() => fetchTrend(true)}
          disabled={loading}
          className="refresh-btn"
        >
          {loading ? "Refreshing..." : "API Refresh"}
        </button>
      </div>

      {loading && <div className="app-loading">Loading trend data...</div>}
      {error && <div className="app-error">{error}</div>}

      {data.length > 0 && (
        <TrendChart data={data} entityName={entityName} />
      )}
    </>
  );
}
