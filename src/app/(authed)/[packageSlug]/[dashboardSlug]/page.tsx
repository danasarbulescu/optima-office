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
  const hasDataRef = useRef(false);
  const busy = loading || syncing;

  // Resolve parent package for display
  const pkg = useMemo(() => {
    if (!dashboard) return null;
    return packages.find(p => p.id === dashboard.packageId) || null;
  }, [dashboard, packages]);

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
      hasDataRef.current = true;
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (!refresh && !hasDataRef.current) {
        setNoCache(true);
      } else {
        setError(err.message || "Failed to load dashboard");
      }
    } finally {
      if (!signal?.aborted) setActive(false);
    }
  }, [selectedEntities, currentClientId]);

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
      if (!signal?.aborted) setActive(false);
    }
  }, [startMonth, endMonth, selectedEntities, currentClientId]);

  // Stable refs for fetch callbacks — prevents effect re-fires when callback identity changes
  const fetchFinancialRef = useRef(fetchFinancialSnapshot);
  fetchFinancialRef.current = fetchFinancialSnapshot;
  const fetchTrendRef = useRef(fetchExpenseTrend);
  fetchTrendRef.current = fetchExpenseTrend;

  // Auto-load when dashboard, entities, or month change
  useEffect(() => {
    if (packagesLoading || !dashboard || selectedEntities.length === 0) return;

    hasDataRef.current = false;
    setKpis(null);
    setPnlByMonth(null);
    setTrendData([]);

    const controller = new AbortController();
    if (hasFinancialWidgets) {
      fetchFinancialRef.current(month, false, controller.signal);
    }
    if (hasTrendWidgets) {
      fetchTrendRef.current(false, controller.signal);
    }

    return () => { controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packagesLoading, dashboard?.id, selectedEntities, hasFinancialWidgets, hasTrendWidgets, month]);

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
      <div className="dashboard-header">
        {pkg && <div className="dashboard-package-name">{pkg.displayName}</div>}
        <h1 className="dashboard-title">{dashboard.displayName}</h1>
      </div>

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
          No data has been downloaded yet for this client, please perform an API sync first.
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
