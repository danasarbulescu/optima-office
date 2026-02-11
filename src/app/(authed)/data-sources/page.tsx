"use client";

import { useState, useEffect, useCallback } from "react";
import { DataSource } from "@/lib/types";
import { DATA_SOURCE_TYPES } from "@/lib/data-source-types";
import { TrashIcon } from "@/components/TrashIcon";
import { PencilIcon } from "@/components/PencilIcon";
import "./data-sources.css";
import "../clients/clients.css";

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DataSource | null>(null);

  const fetchDataSources = useCallback(async () => {
    try {
      const res = await fetch("/api/data-sources");
      if (!res.ok) throw new Error("Failed to load data sources");
      const data = await res.json();
      setDataSources(data.dataSources);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  const handleDelete = async (ds: DataSource) => {
    if (!confirm(`Delete data source "${ds.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/data-sources/${encodeURIComponent(ds.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete data source");
      }
      fetchDataSources();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="app-loading">Loading data sources...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="data-sources-page">
      <div className="data-sources-header">
        <h1>Data Sources</h1>
        <button className="add-client-btn" onClick={() => setAddOpen(true)}>
          New Data Source
        </button>
      </div>

      {dataSources.length === 0 ? (
        <div className="data-sources-empty">No data sources configured yet.</div>
      ) : (
        <div className="data-sources-table-wrapper">
          <table className="data-sources-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((ds) => (
                <tr key={ds.id}>
                  <td>{ds.displayName}</td>
                  <td>
{ds.status.charAt(0).toUpperCase() + ds.status.slice(1)}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn-muted icon-btn-view" title="Edit data source" onClick={() => setEditing(ds)}><PencilIcon /></button>
                      <button className="icon-btn-muted" title="Delete data source" onClick={() => handleDelete(ds)}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddDataSourceModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); fetchDataSources(); }}
        />
      )}
      {editing && (
        <EditDataSourceModal
          dataSource={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchDataSources(); }}
        />
      )}
    </div>
  );
}

/* ─── Add Data Source Modal ─── */

function AddDataSourceModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const typeKeys = Object.keys(DATA_SOURCE_TYPES);
  const [type, setType] = useState(typeKeys[0] || "cdata");
  const [displayName, setDisplayName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const typeConfig = DATA_SOURCE_TYPES[type];
  const fields = typeConfig?.fields || [];

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setConfig({});
    setVisibleFields(new Set());
  };

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, displayName: displayName.trim(), config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create data source");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>New Data Source</h2>
        <div className="modal-field">
          <label>Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Main CData Account"
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label>Type</label>
          <select value={type} onChange={e => handleTypeChange(e.target.value)}>
            {typeKeys.map(k => (
              <option key={k} value={k}>{DATA_SOURCE_TYPES[k].displayName}</option>
            ))}
          </select>
        </div>
        {fields.length > 0 && (
          <>
            <div className="modal-separator" />
            {fields.map(f => (
              <div className="modal-field" key={f.key}>
                <label>{f.label}</label>
                {f.sensitive ? (
                  <div className="password-field-wrapper">
                    <input
                      type={visibleFields.has(f.key) ? "text" : "password"}
                      value={config[f.key] || ""}
                      onChange={e => updateConfig(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => toggleFieldVisibility(f.key)}
                      tabIndex={-1}
                      aria-label={visibleFields.has(f.key) ? "Hide value" : "Show value"}
                    >
                      {visibleFields.has(f.key) ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={config[f.key] || ""}
                    onChange={e => updateConfig(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Data Source Modal ─── */

function EditDataSourceModal({
  dataSource,
  onClose,
  onSaved,
}: {
  dataSource: DataSource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(dataSource.displayName);
  const [status, setStatus] = useState(dataSource.status);
  const [config, setConfig] = useState<Record<string, string>>(dataSource.config || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const typeConfig = DATA_SOURCE_TYPES[dataSource.type];
  const fields = typeConfig?.fields || [];

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/data-sources/${encodeURIComponent(dataSource.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), status, config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update data source");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Data Source</h2>
        <div className="modal-field">
          <label>Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select className="status-select" value={status} onChange={e => setStatus(e.target.value as 'active' | 'archived')}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {fields.length > 0 && (
          <>
            <div className="modal-separator" />
            {fields.map(f => (
              <div className="modal-field" key={f.key}>
                <label>{f.label}</label>
                {f.sensitive ? (
                  <div className="password-field-wrapper">
                    <input
                      type={visibleFields.has(f.key) ? "text" : "password"}
                      value={config[f.key] || ""}
                      onChange={e => updateConfig(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => toggleFieldVisibility(f.key)}
                      tabIndex={-1}
                      aria-label={visibleFields.has(f.key) ? "Hide value" : "Show value"}
                    >
                      {visibleFields.has(f.key) ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={config[f.key] || ""}
                    onChange={e => updateConfig(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
