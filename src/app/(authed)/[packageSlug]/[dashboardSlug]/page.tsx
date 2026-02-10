"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useClient } from "@/context/ClientContext";
import { useEntity } from "@/context/EntityContext";
import { usePackages } from "@/context/PackageContext";
import { getWidgetType } from "@/widgets/registry";
import { KPI_CONFIGS } from "@/widgets/kpi-config";
import KpiCard from "@/widgets/components/KpiCard";
import PnlTable from "@/widgets/components/PnlTable";
import type { KPIs, PnLByMonth, TrendDataPoint } from "@/lib/types";
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
  const { packages, dashboardsByPackage, widgetsByDashboard, packagesLoading } = usePackages();

  // Resolve dashboard + widgets from context (no API calls)
  const dashboard = useMemo(() => {
    if (!packageSlug || !dashboardSlug) return null;
    const pkg = packages.find(p => p.slug === packageSlug);
    if (!pkg) return null;
    const dashboards = dashboardsByPackage[pkg.id] || [];
    return dashboards.find(d => d.slug === dashboardSlug) || null;
  }, [packageSlug, dashboardSlug, packages, dashboardsByPackage]);

  const widgets = useMemo(() => {
    if (!dashboard) return [];
    return widgetsByDashboard[dashboard.id] || [];
  }, [dashboard, widgetsByDashboard]);

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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [noCache, setNoCache] = useState(false);
  const hasAutoLoaded = useRef<string | null>(null);
  const busy = loading || syncing;

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

  // Fetch financial snapshot data
  const fetchFinancialSnapshot = useCallback(async (selectedMonth: string, refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    setNoCache(false);
    try {
      const url = `/api/widget-data/financial-snapshot?month=${selectedMonth}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
        signal,
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
      if (err.name === "AbortError") return;
      if (!refresh && !kpis) {
        setNoCache(true);
      } else {
        setError(err.message || "Failed to load dashboard");
      }
    } finally {
      setActive(false);
    }
  }, [selectedEntities, currentClientId, kpis]);

  // Fetch expense trend data
  const fetchExpenseTrend = useCallback(async (refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    try {
      const url = `/api/widget-data/expense-trend?startMonth=${startMonth}&endMonth=${endMonth}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json = await res.json();
      setTrendData(json.data);
      setTrendEntityName(json.entityName);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load trend data");
    } finally {
      setActive(false);
    }
  }, [startMonth, endMonth, selectedEntities, currentClientId]);

  // Auto-load when dashboard resolves and entities are ready
  useEffect(() => {
    if (packagesLoading || !dashboard || selectedEntities.length === 0) return;
    // Avoid re-fetching for the same dashboard
    if (hasAutoLoaded.current === dashboard.id) return;
    hasAutoLoaded.current = dashboard.id;

    setKpis(null);
    setPnlByMonth(null);
    setTrendData([]);

    const controller = new AbortController();
    if (hasFinancialWidgets) {
      fetchFinancialSnapshot(month, false, controller.signal);
    }
    if (hasTrendWidgets) {
      fetchExpenseTrend(false, controller.signal);
    }
    return () => controller.abort();
  }, [packagesLoading, dashboard, selectedEntities, hasFinancialWidgets, hasTrendWidgets, fetchFinancialSnapshot, fetchExpenseTrend, month]);

  if (packagesLoading) {
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
            disabled={busy || selectedEntities.length === 0}
            className="refresh-btn"
          >
            {loading ? "Loading..." : "Load"}
          </button>
          <button
            onClick={() => fetchFinancialSnapshot(month, true)}
            disabled={busy || selectedEntities.length === 0}
            className="refresh-btn"
          >
            {syncing ? "Syncing..." : "Sync"}
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
            disabled={busy}
            className="refresh-btn"
          >
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      )}

      {busy && <div className="app-loading">{syncing ? "Syncing..." : "Loading dashboard..."}</div>}
      {error && <div className="app-error">{error}</div>}
      {noCache && !busy && (
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
