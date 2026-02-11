"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { KPI_CONFIGS } from "@/widgets/kpi-config";
import KpiCard from "@/widgets/components/KpiCard";
import PnlTable from "@/widgets/components/PnlTable";
import type { KPIs, PnLByMonth, TrendDataPoint, EntityConfig } from "@/lib/types";
import "@/widgets/widgets.css";
import "../widgets.css";

const TrendChart = dynamic(() => import("@/widgets/components/TrendChart"), {
  loading: () => <div className="app-loading">Loading chart...</div>,
  ssr: false,
});

interface WidgetTypeView {
  id: string;
  name: string;
  originalName: string;
  category: string;
  component: string;
  description: string;
  hasOverride: boolean;
}

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

interface PreviewData {
  available: boolean;
  component?: string;
  kpis?: KPIs;
  pnl?: PnLByMonth;
  data?: TrendDataPoint[];
  entityName?: string;
  selectedMonth?: string;
}

export default function WidgetTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [widgetType, setWidgetType] = useState<WidgetTypeView | null>(null);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline name editing
  const [editName, setEditName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  // Description editing
  const [editDescription, setEditDescription] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const [descError, setDescError] = useState("");

  // Preview state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Preview entity + month state
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [previewEntityId, setPreviewEntityId] = useState("");
  const [savedEntityId, setSavedEntityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewMonth, setPreviewMonth] = useState("");

  const fetchWidgetType = useCallback(async () => {
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Widget type not found");
      const data = await res.json();
      setWidgetType(data.widgetType);
      setEditName(data.widgetType.name);
      setEditDescription(data.widgetType.description || "");
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

  const fetchPreview = useCallback(async (month?: string) => {
    setPreviewLoading(true);
    try {
      const params = month ? `?month=${month}` : '';
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}/preview${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
        if (data.selectedMonth && !month) {
          setPreviewMonth(data.selectedMonth);
        }
      }
    } catch { /* non-fatal */ }
    finally { setPreviewLoading(false); }
  }, [id]);

  const fetchPreviewConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/widget-types/preview-config');
      if (res.ok) {
        const data = await res.json();
        if (data.entityId) {
          setPreviewEntityId(data.entityId);
          setSavedEntityId(data.entityId);
        }
      }
    } catch { /* non-fatal */ }
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/entities');
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities || []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchWidgetType(), fetchUsage(), fetchPreview(), fetchPreviewConfig(), fetchEntities()]);
      setLoading(false);
    })();
  }, [fetchWidgetType, fetchUsage, fetchPreview, fetchPreviewConfig, fetchEntities]);

  const handleSavePreviewEntity = async () => {
    if (!previewEntityId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/widget-types/preview-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: previewEntityId }),
      });
      if (res.ok) {
        setSavedEntityId(previewEntityId);
        setPreviewMonth('');
        fetchPreview();
      }
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName === widgetType?.name) return;
    setNameSaving(true);
    setNameError("");
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update name");
      }
      await fetchWidgetType();
    } catch (err: any) {
      setNameError(err.message);
    } finally {
      setNameSaving(false);
    }
  };

  const handleResetName = async () => {
    setNameSaving(true);
    setNameError("");
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "" }),
      });
      if (!res.ok) throw new Error("Failed to reset name");
      await fetchWidgetType();
    } catch (err: any) {
      setNameError(err.message);
    } finally {
      setNameSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    setDescSaving(true);
    setDescError("");
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update description");
      }
      await fetchWidgetType();
    } catch (err: any) {
      setDescError(err.message);
    } finally {
      setDescSaving(false);
    }
  };

  if (loading) return <div className="app-loading">Loading widget type...</div>;
  if (error || !widgetType) return <div className="app-error">{error || "Widget type not found"}</div>;

  const kpiConfig = KPI_CONFIGS[id];
  const hasUnsavedChange = previewEntityId !== savedEntityId;
  const nameChanged = editName.trim() !== widgetType.name;
  const descChanged = editDescription !== (widgetType.description || "");

  return (
    <div className="widget-detail-page">
      <Link href="/widgets" className="widget-detail-back">&larr; Widget Types</Link>

      <div className="widget-detail-header">
        <h1>{widgetType.name}</h1>
      </div>

      {/* Info Section */}
      <div className="widget-detail-info">
        <div className="widget-detail-field">
          <span className="widget-detail-label">Display Name</span>
          <div className="inline-name-edit">
            <div className="inline-name-row">
              <input
                type="text"
                className="inline-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                disabled={nameSaving}
              />
              {nameChanged && (
                <button
                  className="inline-name-save"
                  onClick={handleSaveName}
                  disabled={nameSaving || !editName.trim()}
                >
                  {nameSaving ? "Saving..." : "Save"}
                </button>
              )}
              {nameChanged && (
                <button
                  className="inline-name-cancel"
                  onClick={() => setEditName(widgetType.name)}
                  disabled={nameSaving}
                >
                  Cancel
                </button>
              )}
            </div>
            {widgetType.hasOverride && !nameChanged && (
              <div className="original-name-hint">
                Original: {widgetType.originalName}
                <button className="reset-link" onClick={handleResetName} disabled={nameSaving}>
                  Reset to original
                </button>
              </div>
            )}
            {nameError && <div className="inline-name-error">{nameError}</div>}
          </div>
        </div>
        <div className="widget-detail-field widget-detail-field-top">
          <span className="widget-detail-label">Description</span>
          <div className="inline-description-edit">
            <textarea
              className="inline-description-input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={descSaving}
              placeholder="Add a description..."
              rows={3}
            />
            {descChanged && (
              <div className="inline-description-actions">
                <button
                  className="inline-name-save"
                  onClick={handleSaveDescription}
                  disabled={descSaving}
                >
                  {descSaving ? "Saving..." : "Save"}
                </button>
                <button
                  className="inline-name-cancel"
                  onClick={() => setEditDescription(widgetType.description || "")}
                  disabled={descSaving}
                >
                  Cancel
                </button>
              </div>
            )}
            {descError && <div className="inline-name-error">{descError}</div>}
          </div>
        </div>
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

      {/* Preview Section */}
      <div className="widget-detail-preview">
        <h2>Preview</h2>

        <div className="preview-source">
          <label className="preview-source-label">Preview entity</label>
          {entities.length === 0 ? (
            <div className="preview-source-hint">
              No entities available. <Link href="/clients" className="widget-usage-link">Create a client entity</Link> first.
            </div>
          ) : (
            <div className="preview-source-controls">
              <select
                value={previewEntityId}
                onChange={(e) => setPreviewEntityId(e.target.value)}
                disabled={saving}
              >
                <option value="">Select an entity...</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.displayName}</option>
                ))}
              </select>
              {hasUnsavedChange && (
                <button
                  className="preview-save-btn"
                  disabled={!previewEntityId || saving}
                  onClick={handleSavePreviewEntity}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          )}
        </div>

        {previewData?.available && previewMonth && (
          <div className="preview-source">
            <label className="preview-source-label">Month</label>
            <input
              type="month"
              className="month-picker"
              value={previewMonth}
              onChange={(e) => {
                setPreviewMonth(e.target.value);
                fetchPreview(e.target.value);
              }}
            />
          </div>
        )}

        {previewLoading ? (
          <div className="widget-detail-empty">Loading preview...</div>
        ) : !previewData?.available ? (
          <div className="widget-detail-empty">
            {savedEntityId
              ? "No warehouse data available for this entity. Sync the entity first."
              : "Select an entity above to preview this widget."}
          </div>
        ) : (
          <div className="widget-preview-frame">
            {widgetType.component === 'KpiCard' && kpiConfig && previewData.kpis && (
              <div className="preview-kpi-wrapper">
                <KpiCard config={kpiConfig} kpis={previewData.kpis} />
              </div>
            )}
            {widgetType.component === 'PnlTable' && previewData.pnl && (
              <PnlTable pnl={previewData.pnl} />
            )}
            {widgetType.component === 'TrendChart' && previewData.data && (
              <TrendChart data={previewData.data} entityName={previewData.entityName || 'Preview'} />
            )}
          </div>
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
    </div>
  );
}
