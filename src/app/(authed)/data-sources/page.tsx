"use client";

import { useState, useEffect, useCallback } from "react";
import { DataSource } from "@/lib/types";
import { DATA_SOURCE_TYPES } from "@/lib/data-source-types";
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
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((ds) => (
                <tr key={ds.id}>
                  <td>{ds.displayName}</td>
                  <td>
                    <span className="type-badge">
                      {DATA_SOURCE_TYPES[ds.type]?.displayName || ds.type}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${ds.status === "active" ? "status-active" : "status-archived"}`}>
                      {ds.status.charAt(0).toUpperCase() + ds.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => setEditing(ds)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDelete(ds)}>Delete</button>
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

  const typeConfig = DATA_SOURCE_TYPES[type];
  const fields = typeConfig?.fields || [];

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
          <label>Type</label>
          {typeKeys.length === 1 ? (
            <input type="text" value={typeConfig?.displayName || type} disabled className="input-disabled" />
          ) : (
            <select value={type} onChange={e => { setType(e.target.value); setConfig({}); }}>
              {typeKeys.map(k => (
                <option key={k} value={k}>{DATA_SOURCE_TYPES[k].displayName}</option>
              ))}
            </select>
          )}
        </div>
        <div className="modal-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Main CData Account"
            autoFocus
          />
        </div>
        {fields.length > 0 && (
          <>
            <div className="modal-separator" />
            {fields.map(f => (
              <div className="modal-field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type={f.sensitive ? "password" : "text"}
                  value={config[f.key] || ""}
                  onChange={e => updateConfig(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
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

  const typeConfig = DATA_SOURCE_TYPES[dataSource.type];
  const fields = typeConfig?.fields || [];

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
          <label>Type</label>
          <input type="text" value={typeConfig?.displayName || dataSource.type} disabled className="input-disabled" />
        </div>
        <div className="modal-field">
          <label>Display Name</label>
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
                <input
                  type={f.sensitive ? "password" : "text"}
                  value={config[f.key] || ""}
                  onChange={e => updateConfig(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
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
