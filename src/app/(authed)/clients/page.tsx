"use client";

import { useState, useEffect, useCallback } from "react";
import { ClientConfig } from "@/lib/types";
import { useCompany } from "@/context/CompanyContext";
import "./clients.css";

export default function ClientsPage() {
  const { refreshClients } = useCompany();
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();
      setClients(data.clients);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete client "${id}"?`)) return;
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client");
      await fetchClients();
      refreshClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdded = () => {
    setShowModal(false);
    fetchClients();
    refreshClients();
  };

  if (loading) return <div className="app-loading">Loading clients...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="clients-page">
      <div className="clients-header">
        <h1>Clients</h1>
        <button className="add-client-btn" onClick={() => setShowModal(true)}>
          New Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="clients-empty">No clients configured. Add one to get started.</div>
      ) : (
        <table className="clients-table">
          <thead>
            <tr>
              <th>Display Name</th>
              <th>CData Catalog ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.displayName}</td>
                <td>{c.id}</td>
                <td>
                  <button className="delete-btn" onClick={() => handleDelete(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <AddClientModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}

function AddClientModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: catalogId, displayName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add client");
      }
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>New Client</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Brooklyn Restaurants"
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label>CData Catalog ID</label>
          <input
            type="text"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            placeholder="e.g. BrooklynRestaurants"
          />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !displayName.trim() || !catalogId.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
