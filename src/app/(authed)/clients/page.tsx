"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ClientConfig } from "@/lib/types";
import { useCompany } from "@/context/CompanyContext";
import "./clients.css";

type SortColumn = "displayName" | "catalogId" | "email" | "firstName" | "lastName";
type SortDirection = "asc" | "desc";

export default function ClientsPage() {
  const { refreshClients } = useCompany();
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientConfig | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedClients = useMemo(() => {
    if (!sortColumn) return clients;
    const sorted = [...clients].sort((a, b) => {
      const aVal = (a[sortColumn] ?? "").toString().toLowerCase();
      const bVal = (b[sortColumn] ?? "").toString().toLowerCase();
      return aVal.localeCompare(bVal);
    });
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [clients, sortColumn, sortDirection]);

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const handleDelete = async (client: ClientConfig) => {
    if (!confirm(`Delete client "${client.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client");
      await fetchClients();
      refreshClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdded = () => {
    setShowAddModal(false);
    fetchClients();
    refreshClients();
  };

  const handleEdited = () => {
    setEditingClient(null);
    fetchClients();
    refreshClients();
  };

  if (loading) return <div className="app-loading">Loading clients...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="clients-page">
      <div className="clients-header">
        <h1>Clients</h1>
        <button className="add-client-btn" onClick={() => setShowAddModal(true)}>
          New Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="clients-empty">No clients configured. Add one to get started.</div>
      ) : (
        <div className="clients-table-wrapper">
          <table className="clients-table">
            <thead>
              <tr>
                <th className="sortable-th" onClick={() => handleSort("displayName")}>
                  Display Name {sortIndicator("displayName")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("catalogId")}>
                  CData Catalog ID {sortIndicator("catalogId")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("firstName")}>
                  First Name {sortIndicator("firstName")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("lastName")}>
                  Last Name {sortIndicator("lastName")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("email")}>
                  Email {sortIndicator("email")}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((c) => (
                <tr key={c.id}>
                  <td>{c.displayName}</td>
                  <td>{c.catalogId}</td>
                  <td>{c.firstName || ""}</td>
                  <td>{c.lastName || ""}</td>
                  <td>{c.email || ""}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => setEditingClient(c)}>
                        Edit
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(c)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddClientModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onEdited={handleEdited}
        />
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
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = { catalogId, displayName };
      if (email.trim()) body.email = email.trim();
      if (firstName.trim()) body.firstName = firstName.trim();
      if (lastName.trim()) body.lastName = lastName.trim();

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add client");
      }
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
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
        <div className="modal-separator" />
        <div className="modal-field">
          <label>First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="modal-field">
          <label>Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Optional"
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

function EditClientModal({
  client,
  onClose,
  onEdited,
}: {
  client: ClientConfig;
  onClose: () => void;
  onEdited: () => void;
}) {
  const [displayName, setDisplayName] = useState(client.displayName);
  const [catalogId, setCatalogId] = useState(client.catalogId);
  const [email, setEmail] = useState(client.email || "");
  const [firstName, setFirstName] = useState(client.firstName || "");
  const [lastName, setLastName] = useState(client.lastName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId,
          displayName,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update client");
      }
      onEdited();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Client</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label>CData Catalog ID</label>
          <input
            type="text"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          />
        </div>
        <div className="modal-separator" />
        <div className="modal-field">
          <label>First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label>Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
