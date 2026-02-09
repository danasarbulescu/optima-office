"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useClient } from "@/context/ClientContext";
import { useEntity } from "@/context/EntityContext";
import { getWidgetType } from "@/widgets/registry";
import { KPI_CONFIGS } from "@/widgets/kpi-config";
import KpiCard from "@/widgets/components/KpiCard";
import PnlTable from "@/widgets/components/PnlTable";
import type { KPIs, PnLByMonth, TrendDataPoint, Dashboard, DashboardWidget } from "@/lib/types";
import "@/widgets/widgets.css";

const TrendChart = dynamic(() => import("@/widgets/components/TrendChart"), {
  loading: () => <div className="app-loading">Loading chart...</div>,
  ssr: false,
});

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { packageSlug, dashboardSlug } = useParams<{ packageSlug: string; dashboardSlug: string }>();
  const { currentClientId } = useClient();
  const { selectedEntities } = useEntity();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [resolving, setResolving] = useState(true);

  // Financial snapshot state
  const [month, setMonth] = useState(getCurrentMonth());
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [pnlByMonth, setPnlByMonth] = useState<PnLByMonth | null>(null);
  const [entityName, setEntityName] = useState("");

  // Expense trend state
  const [startMonth, setStartMonth] = useState("2024-01");
  const [endMonth, setEndMonth] = useState(getCurrentMonth());
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendEntityName, setTrendEntityName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noCache, setNoCache] = useState(false);
  const hasAutoLoaded = useRef(false);

  // Infer data needs from assigned widgets
  const hasFinancialWidgets = useMemo(() =>
    widgets.some(w => {
      const wt = getWidgetType(w.widgetTypeId);
      return wt?.component === "KpiCard" || wt?.component === "PnlTable";
    }),
    [widgets]
  );

  const hasTrendWidgets = useMemo(() =>
    widgets.some(w => {
      const wt = getWidgetType(w.widgetTypeId);
      return wt?.component === "TrendChart";
    }),
    [widgets]
  );

  // Resolve dashboard from slugs
  useEffect(() => {
    if (!packageSlug || !dashboardSlug || !currentClientId) return;
    setResolving(true);
    hasAutoLoaded.current = false;
    setKpis(null);
    setPnlByMonth(null);
    setTrendData([]);

    (async () => {
      try {
        const res = await fetch(
          `/api/dashboards/resolve?packageSlug=${packageSlug}&dashboardSlug=${dashboardSlug}&clientId=${currentClientId}`,
          { headers: { "x-client-id": currentClientId } }
        );
        if (!res.ok) {
          setDashboard(null);
          setWidgets([]);
          setResolving(false);
          return;
        }
        const { dashboard: d } = await res.json();
        setDashboard(d);

        // Fetch widgets for this dashboard
        const wRes = await fetch(`/api/dashboards/${d.id}/widgets`, {
          headers: { "x-client-id": currentClientId },
        });
        if (wRes.ok) {
          const { widgets: w } = await wRes.json();
          setWidgets(w);
        }
      } catch {
        setDashboard(null);
        setWidgets([]);
      } finally {
        setResolving(false);
      }
    })();
  }, [packageSlug, dashboardSlug, currentClientId]);

  // Fetch financial snapshot data
  const fetchFinancialSnapshot = useCallback(async (selectedMonth: string, refresh = false) => {
    setLoading(true);
    setError("");
    setNoCache(false);
    try {
      const url = `/api/widget-data/financial-snapshot?month=${selectedMonth}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const data = await res.json();
      setKpis(data.kpis);
      setPnlByMonth(data.pnlByMonth);
      setEntityName(data.entityName);
    } catch (err: any) {
      if (!refresh && !kpis) {
        setNoCache(true);
      } else {
        setError(err.message || "Failed to load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEntities, currentClientId, kpis]);

  // Fetch expense trend data
  const fetchExpenseTrend = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/widget-data/expense-trend?startMonth=${startMonth}&endMonth=${endMonth}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json = await res.json();
      setTrendData(json.data);
      setTrendEntityName(json.entityName);
    } catch (err: any) {
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, selectedEntities, currentClientId]);

  // Auto-load when dashboard resolves and entities are ready
  useEffect(() => {
    if (hasAutoLoaded.current || resolving || !dashboard || selectedEntities.length === 0) return;
    hasAutoLoaded.current = true;
    if (hasFinancialWidgets) {
      fetchFinancialSnapshot(month);
    }
    if (hasTrendWidgets) {
      fetchExpenseTrend();
    }
  }, [resolving, dashboard, selectedEntities, hasFinancialWidgets, hasTrendWidgets, fetchFinancialSnapshot, fetchExpenseTrend, month]);

  if (resolving) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!dashboard) {
    return <div className="app-empty">Dashboard not found.</div>;
  }

  if (widgets.length === 0) {
    return <div className="app-empty">No widgets configured for this dashboard.</div>;
  }

  // Split widgets by component type
  const kpiWidgets = widgets.filter(w => {
    const wt = getWidgetType(w.widgetTypeId);
    return wt?.component === "KpiCard";
  });
  const tableWidgets = widgets.filter(w => {
    const wt = getWidgetType(w.widgetTypeId);
    return wt?.component === "PnlTable";
  });

  return (
    <>
      {/* Financial snapshot controls */}
      {hasFinancialWidgets && (
        <div className="dashboard-controls">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="month-picker"
          />
          <button
            onClick={() => fetchFinancialSnapshot(month)}
            disabled={loading || selectedEntities.length === 0}
            className="refresh-btn"
          >
            {loading ? "Loading..." : "Load"}
          </button>
          <button
            onClick={() => fetchFinancialSnapshot(month, true)}
            disabled={loading || selectedEntities.length === 0}
            className="refresh-btn"
          >
            {loading ? "Fetching..." : "Fetch API Data"}
          </button>
        </div>
      )}

      {/* Expense trend controls */}
      {hasTrendWidgets && (
        <div className="dashboard-controls">
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
            onClick={() => fetchExpenseTrend(true)}
            disabled={loading}
            className="refresh-btn"
          >
            {loading ? "Refreshing..." : "API Refresh"}
          </button>
        </div>
      )}

      {loading && <div className="app-loading">Loading dashboard...</div>}
      {error && <div className="app-error">{error}</div>}
      {noCache && !loading && (
        <div className="app-empty">
          There is no cached data, you need to pull fresh data via API.
        </div>
      )}

      {/* Financial snapshot widgets */}
      {kpis && (
        <>
          {entityName && (
            <div style={{ textAlign: "center", color: "#9a9caa", fontSize: 16, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
              {entityName}
            </div>
          )}
          <h1 style={{ textAlign: "center", color: "#6b8cff", fontSize: 28, letterSpacing: 2, marginBottom: 32, textTransform: "uppercase" }}>
            Financial Snapshot
          </h1>
          <div className={`widget-grid${kpiWidgets.length > 4 ? " widget-grid-5" : ""}`}>
            {kpiWidgets.map(w => {
              const config = KPI_CONFIGS[w.widgetTypeId];
              if (!config) return null;
              return <KpiCard key={w.id} config={config} kpis={kpis} />;
            })}
          </div>
          {tableWidgets.map(w => (
            pnlByMonth ? <PnlTable key={w.id} pnl={pnlByMonth} /> : null
          ))}
        </>
      )}

      {/* Trend widgets */}
      {trendData.length > 0 && hasTrendWidgets && (
        <TrendChart data={trendData} entityName={trendEntityName} />
      )}
    </>
  );
}
