"use client";

import { useState } from "react";

export interface WidgetTypeView {
  id: string;
  name: string;
  originalName: string;
  category: string;
  component: string;
  hasOverride: boolean;
}

export function EditWidgetTypeModal({
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
