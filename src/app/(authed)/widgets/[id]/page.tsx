"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WidgetTypeView, EditWidgetTypeModal } from "../EditWidgetTypeModal";
import { KPI_CONFIGS } from "@/widgets/kpi-config";
import "../widgets.css";

interface UsageRecord {
  widgetId: string;
  sortOrder: number;
  dashboardId: string;
  dashboardName: string;
  packageId: string;
  packageName: string;
  clientId: string;
  clientName: string;
}

export default function WidgetTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [widgetType, setWidgetType] = useState<WidgetTypeView | null>(null);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const fetchWidgetType = useCallback(async () => {
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Widget type not found");
      const data = await res.json();
      setWidgetType(data.widgetType);
    } catch (err: any) {
      setError(err.message);
    }
  }, [id]);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage);
      }
    } catch { /* non-fatal */ }
  }, [id]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchWidgetType(), fetchUsage()]);
      setLoading(false);
    })();
  }, [fetchWidgetType, fetchUsage]);

  if (loading) return <div className="app-loading">Loading widget type...</div>;
  if (error || !widgetType) return <div className="app-error">{error || "Widget type not found"}</div>;

  const kpiConfig = KPI_CONFIGS[id];

  return (
    <div className="widget-detail-page">
      <Link href="/widgets" className="widget-detail-back">&larr; Widget Types</Link>

      <div className="widget-detail-header">
        <h1>
          {widgetType.name}
          {widgetType.hasOverride && <span className="override-badge">customized</span>}
        </h1>
        <button className="rename-btn" onClick={() => setEditing(true)}>Rename</button>
      </div>

      {widgetType.hasOverride && (
        <div className="original-name-hint" style={{ marginBottom: 16 }}>
          Original: {widgetType.originalName}
        </div>
      )}

      {/* Info Section */}
      <div className="widget-detail-info">
        <div className="widget-detail-field">
          <span className="widget-detail-label">Category</span>
          <span>{widgetType.category}</span>
        </div>
        <div className="widget-detail-field">
          <span className="widget-detail-label">Component</span>
          <code className="slug-badge">{widgetType.component}</code>
        </div>
        <div className="widget-detail-field">
          <span className="widget-detail-label">ID</span>
          <code className="slug-badge">{widgetType.id}</code>
        </div>

        {kpiConfig && (
          <>
            <div className="widget-detail-separator" />
            <div className="widget-detail-field">
              <span className="widget-detail-label">Header</span>
              <span>{kpiConfig.headerLine1} / {kpiConfig.headerLine2}</span>
            </div>
            <div className="widget-detail-field">
              <span className="widget-detail-label">Data Field</span>
              <code className="slug-badge">{kpiConfig.field}</code>
            </div>
            <div className="widget-detail-field">
              <span className="widget-detail-label">Format</span>
              <span>{kpiConfig.format}</span>
            </div>
            {kpiConfig.varianceField && (
              <div className="widget-detail-field">
                <span className="widget-detail-label">Variance</span>
                <span>
                  <code className="slug-badge">{kpiConfig.varianceField}</code>
                  {kpiConfig.variancePctField && (
                    <> / <code className="slug-badge">{kpiConfig.variancePctField}</code></>
                  )}
                  {kpiConfig.varianceLabel && ` (${kpiConfig.varianceLabel})`}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Usage Section */}
      <div className="widget-detail-usage">
        <h2>Usage ({usage.length})</h2>
        {usage.length === 0 ? (
          <div className="widget-detail-empty">This widget type is not used on any dashboards.</div>
        ) : (
          <div className="widgets-table-wrapper">
            <table className="widgets-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Package</th>
                  <th>Dashboard</th>
                  <th>Sort Order</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.widgetId}>
                    <td><Link href={`/clients/${u.clientId}`} className="widget-usage-link">{u.clientName}</Link></td>
                    <td>{u.packageName}</td>
                    <td>{u.dashboardName}</td>
                    <td>{u.sortOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditWidgetTypeModal
          widget={widgetType}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); fetchWidgetType(); }}
        />
      )}
    </div>
  );
}
