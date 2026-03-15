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
import type { KPIs, PnLByMonth, TrendDataPoint, BudgetVsActualData, SummaryBvaData, ComparativeSnapshotData } from "@/lib/types";
import "@/widgets/widgets.css";

const TrendChart = dynamic(() => import("@/widgets/components/TrendChart"), {
  loading: () => <div className="app-loading">Loading chart...</div>,
  ssr: false,
});

const BudgetVsActualTable = dynamic(() => import("@/widgets/components/BudgetVsActualTable"), {
  loading: () => <div className="app-loading">Loading budget comparison...</div>,
  ssr: false,
});

const SummaryBvaTable = dynamic(() => import("@/widgets/components/SummaryBvaTable"), {
  loading: () => <div className="app-loading">Loading summary budget comparison...</div>,
  ssr: false,
});

const ComparativeSnapshot = dynamic(() => import("@/widgets/components/ComparativeSnapshot"), {
  loading: () => <div className="app-loading">Loading snapshot...</div>,
  ssr: false,
});

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { packageSlug, dashboardSlug } = useParams<{ packageSlug: string; dashboardSlug: string }>();
  const { currentClientId } = useClient();
  const { entities, selectedEntities, setSelectedEntities } = useEntity();
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const entityDropdownRef = useRef<HTMLDivElement>(null);
  const { packages, dashboardsByPackage, widgetsByDashboard, widgetTypeNames, packagesLoading } = usePackages();

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
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendEntityName, setTrendEntityName] = useState("");

  // Budget vs. actual state
  const [budgetVsActualData, setBudgetVsActualData] = useState<BudgetVsActualData | null>(null);

  // Summary budget vs. actual state
  const [summaryBvaData, setSummaryBvaData] = useState<SummaryBvaData | null>(null);

  // Comparative snapshot state
  const [comparativeSnapshotData, setComparativeSnapshotData] = useState<ComparativeSnapshotData | null>(null);

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

  const hasBudgetVsActual = useMemo(() =>
    widgets.some(w => {
      const wt = getWidgetType(w.widgetTypeId);
      return wt?.component === "BudgetVsActual";
    }),
    [widgets]
  );

  const hasSummaryBva = useMemo(() =>
    widgets.some(w => {
      const wt = getWidgetType(w.widgetTypeId);
      return wt?.component === "SummaryBva";
    }),
    [widgets]
  );

  const hasComparativeSnapshot = useMemo(() =>
    widgets.some(w => {
      const wt = getWidgetType(w.widgetTypeId);
      return wt?.component === "ComparativeSnapshot";
    }),
    [widgets]
  );

  // Close entity dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(e.target as Node)) {
        setEntityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Fetch expense trend data (13-month trailing from selected month)
  const fetchExpenseTrend = useCallback(async (selectedMonth: string, refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    try {
      // Derive 13-month trailing range from selected month
      const end = selectedMonth;
      const [y, m] = selectedMonth.split("-").map(Number);
      const startDate = new Date(y, m - 13, 1); // 12 months before = 13 total
      const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      const url = `/api/widget-data/expense-trend?startMonth=${start}&endMonth=${end}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
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
  }, [selectedEntities, currentClientId]);

  // Fetch budget vs. actual data
  const fetchBudgetVsActual = useCallback(async (selectedMonth: string, refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    try {
      const entityId = selectedEntities[0];
      if (!entityId) return;
      const url = `/api/widget-data/budget-vs-actual?entities=${entityId}&month=${selectedMonth}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const data = await res.json();
      setBudgetVsActualData(data);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load budget comparison");
    } finally {
      if (!signal?.aborted) { setLoading(false); setSyncing(false); }
    }
  }, [selectedEntities, currentClientId]);

  // Fetch comparative snapshot data
  const fetchComparativeSnapshot = useCallback(async (selectedMonth: string, refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    try {
      const url = `/api/widget-data/comparative-snapshot?month=${selectedMonth}&entities=${selectedEntities.join(",")}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const data = await res.json();
      setComparativeSnapshotData(data);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load comparative snapshot");
    } finally {
      if (!signal?.aborted) { setLoading(false); setSyncing(false); }
    }
  }, [selectedEntities, currentClientId]);

  // Fetch summary budget vs. actual data
  const fetchSummaryBva = useCallback(async (selectedMonth: string, refresh = false, signal?: AbortSignal) => {
    const setActive = refresh ? setSyncing : setLoading;
    setActive(true);
    setError("");
    try {
      const entityId = selectedEntities[0];
      if (!entityId) return;
      const url = `/api/widget-data/summary-bva?entities=${entityId}&month=${selectedMonth}${refresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: { "x-client-id": currentClientId || "" },
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const data = await res.json();
      setSummaryBvaData(data);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load summary budget comparison");
    } finally {
      if (!signal?.aborted) { setLoading(false); setSyncing(false); }
    }
  }, [selectedEntities, currentClientId]);

  // Stable refs for fetch callbacks — prevents effect re-fires when callback identity changes
  const fetchFinancialRef = useRef(fetchFinancialSnapshot);
  fetchFinancialRef.current = fetchFinancialSnapshot;
  const fetchTrendRef = useRef(fetchExpenseTrend);
  fetchTrendRef.current = fetchExpenseTrend;
  const fetchBvaRef = useRef(fetchBudgetVsActual);
  fetchBvaRef.current = fetchBudgetVsActual;
  const fetchSummaryBvaRef = useRef(fetchSummaryBva);
  fetchSummaryBvaRef.current = fetchSummaryBva;
  const fetchComparativeSnapshotRef = useRef(fetchComparativeSnapshot);
  fetchComparativeSnapshotRef.current = fetchComparativeSnapshot;

  // Auto-load when dashboard, entities, or month change
  useEffect(() => {
    if (packagesLoading || !dashboard || selectedEntities.length === 0) return;

    hasDataRef.current = false;
    setKpis(null);
    setPnlByMonth(null);
    setTrendData([]);
    setBudgetVsActualData(null);
    setSummaryBvaData(null);
    setComparativeSnapshotData(null);

    const controller = new AbortController();
    if (hasFinancialWidgets) {
      fetchFinancialRef.current(month, false, controller.signal);
    }
    if (hasTrendWidgets) {
      fetchTrendRef.current(month, false, controller.signal);
    }
    if (hasBudgetVsActual) {
      fetchBvaRef.current(month, false, controller.signal);
    }
    if (hasSummaryBva) {
      fetchSummaryBvaRef.current(month, false, controller.signal);
    }
    if (hasComparativeSnapshot) {
      fetchComparativeSnapshotRef.current(month, false, controller.signal);
    }

    return () => { controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packagesLoading, dashboard?.id, selectedEntities, hasFinancialWidgets, hasTrendWidgets, hasBudgetVsActual, hasSummaryBva, hasComparativeSnapshot, month]);

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

      {/* Dashboard controls — single month picker */}
      {(hasFinancialWidgets || hasTrendWidgets || hasBudgetVsActual || hasSummaryBva || hasComparativeSnapshot) && (
        <div className="dashboard-controls">
          {entities.length > 1 && (
            <div className="multi-select" ref={entityDropdownRef}>
              <button
                className="multi-select-trigger"
                onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
              >
                {selectedEntities.length === entities.length
                  ? "All Entities"
                  : selectedEntities.length === 0
                    ? "No Entities"
                    : `${selectedEntities.length} of ${entities.length}`}
              </button>
              {entityDropdownOpen && (
                <div className="multi-select-dropdown" style={{ left: 0, right: "auto" }}>
                  <div className="multi-select-actions">
                    <button
                      onClick={() => setSelectedEntities(entities.map(e => e.id))}
                      disabled={selectedEntities.length === entities.length}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedEntities([])}
                      disabled={selectedEntities.length === 0}
                    >
                      None
                    </button>
                  </div>
                  {entities.map(e => (
                    <label key={e.id} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={selectedEntities.includes(e.id)}
                        onChange={() => {
                          setSelectedEntities(
                            selectedEntities.includes(e.id)
                              ? selectedEntities.filter(id => id !== e.id)
                              : [...selectedEntities, e.id]
                          );
                        }}
                      />
                      {e.displayName}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="month-picker"
          />
          <button
            onClick={() => {
              if (hasFinancialWidgets) fetchFinancialSnapshot(month);
              if (hasTrendWidgets) fetchExpenseTrend(month);
              if (hasBudgetVsActual) fetchBudgetVsActual(month);
              if (hasSummaryBva) fetchSummaryBva(month);
              if (hasComparativeSnapshot) fetchComparativeSnapshot(month);
            }}
            disabled={busy || selectedEntities.length === 0}
            className="refresh-btn"
          >
            {loading ? "Loading..." : "Load"}
          </button>
          {(hasFinancialWidgets || hasTrendWidgets || hasBudgetVsActual || hasSummaryBva || hasComparativeSnapshot) && (
            <button
              onClick={() => {
                if (hasFinancialWidgets) fetchFinancialSnapshot(month, true);
                if (hasTrendWidgets) fetchExpenseTrend(month, true);
                if (hasBudgetVsActual) fetchBudgetVsActual(month, true);
                if (hasSummaryBva) fetchSummaryBva(month, true);
                if (hasComparativeSnapshot) fetchComparativeSnapshot(month, true);
              }}
              disabled={busy || selectedEntities.length === 0}
              className="refresh-btn"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
          )}
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
          {selectedEntities.length > 0 && (
            <div style={{ textAlign: "center", color: "#9a9caa", fontSize: 16, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
              {entities.filter(e => selectedEntities.includes(e.id)).map(e => e.displayName).join(" + ")}
            </div>
          )}
          <div className={`widget-grid${kpiWidgets.length > 4 ? " widget-grid-5" : ""}`}>
            {kpiWidgets.map(w => {
              const config = KPI_CONFIGS[w.widgetTypeId];
              if (!config) return null;
              return <KpiCard key={w.id} config={config} kpis={kpis} title={widgetTypeNames[w.widgetTypeId]} />;
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

      {/* Budget vs. Actual widget */}
      {budgetVsActualData && hasBudgetVsActual && (
        <BudgetVsActualTable data={budgetVsActualData} month={month} />
      )}

      {/* Summary Budget vs. Actual widget */}
      {summaryBvaData && hasSummaryBva && (
        <SummaryBvaTable data={summaryBvaData} month={month} />
      )}

      {/* Comparative Snapshot P&L widget */}
      {comparativeSnapshotData && hasComparativeSnapshot && (
        <ComparativeSnapshot data={comparativeSnapshotData} />
      )}
    </>
  );
}
