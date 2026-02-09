"use client";

import { useState, useEffect, useCallback } from "react";
import "./widgets.css";

interface WidgetTypeView {
  id: string;
  name: string;
  originalName: string;
  category: string;
  component: string;
  hasOverride: boolean;
}

export default function WidgetsPage() {
  const [widgetTypes, setWidgetTypes] = useState<WidgetTypeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingWidget, setEditingWidget] = useState<WidgetTypeView | null>(null);

  const fetchWidgetTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/widget-types");
      if (!res.ok) throw new Error("Failed to load widget types");
      const data = await res.json();
      setWidgetTypes(data.widgetTypes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgetTypes();
  }, [fetchWidgetTypes]);

  if (loading) return <div className="app-loading">Loading widget types...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="widgets-page">
      <div className="widgets-header">
        <h1>Widget Types</h1>
      </div>

      <div className="widgets-table-wrapper">
        <table className="widgets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Component</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {widgetTypes.map((wt) => (
              <tr key={wt.id}>
                <td>
                  {wt.name}
                  {wt.hasOverride && <span className="override-badge">customized</span>}
                  {wt.hasOverride && (
                    <div className="original-name-hint">
                      Original: {wt.originalName}
                    </div>
                  )}
                </td>
                <td>{wt.category}</td>
                <td><code className="slug-badge">{wt.component}</code></td>
                <td>
                  <button className="rename-btn" onClick={() => setEditingWidget(wt)}>
                    Rename
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingWidget && (
        <EditWidgetTypeModal
          widget={editingWidget}
          onClose={() => setEditingWidget(null)}
          onSaved={() => { setEditingWidget(null); fetchWidgetTypes(); }}
        />
      )}
    </div>
  );
}

/* ─── Edit Widget Type Modal ─── */

function EditWidgetTypeModal({
  widget,
  onClose,
  onSaved,
}: {
  widget: WidgetTypeView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(widget.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(widget.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update widget type");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/widget-types/${encodeURIComponent(widget.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "" }),
      });
      if (!res.ok) throw new Error("Failed to reset widget type name");
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
        <h2>Rename Widget Type</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
          {widget.hasOverride && (
            <div className="original-name-hint">
              Original: {widget.originalName}
              <button className="reset-link" onClick={handleReset} disabled={saving}>
                Reset to original
              </button>
            </div>
          )}
        </div>
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
