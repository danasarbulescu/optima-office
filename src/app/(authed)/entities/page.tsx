"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EntityConfig } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import "./entities.css";

type SortColumn = "displayName" | "catalogId" | "email" | "firstName" | "lastName";
type SortDirection = "asc" | "desc";

export default function EntitiesPage() {
  const { refreshEntities } = useEntity();
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityConfig | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/entities");
      if (!res.ok) throw new Error("Failed to load entities");
      const data = await res.json();
      setEntities(data.entities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedEntities = useMemo(() => {
    if (!sortColumn) return entities;
    const sorted = [...entities].sort((a, b) => {
      const aVal = (a[sortColumn] ?? "").toString().toLowerCase();
      const bVal = (b[sortColumn] ?? "").toString().toLowerCase();
      return aVal.localeCompare(bVal);
    });
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [entities, sortColumn, sortDirection]);

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const handleDelete = async (entity: EntityConfig) => {
    if (!confirm(`Delete entity "${entity.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entity");
      await fetchEntities();
      refreshEntities();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdded = () => {
    setShowAddModal(false);
    fetchEntities();
    refreshEntities();
  };

  const handleEdited = () => {
    setEditingEntity(null);
    fetchEntities();
    refreshEntities();
  };

  if (loading) return <div className="app-loading">Loading entities...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="entities-page">
      <div className="entities-header">
        <h1>Entities</h1>
        <button className="add-entity-btn" onClick={() => setShowAddModal(true)}>
          New Entity
        </button>
      </div>

      {entities.length === 0 ? (
        <div className="entities-empty">No entities configured. Add one to get started.</div>
      ) : (
        <div className="entities-table-wrapper">
          <table className="entities-table">
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
              {sortedEntities.map((e) => (
                <tr key={e.id}>
                  <td>{e.displayName}</td>
                  <td>{e.catalogId}</td>
                  <td>{e.firstName || ""}</td>
                  <td>{e.lastName || ""}</td>
                  <td>{e.email || ""}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => setEditingEntity(e)}>
                        Edit
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(e)}>
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
        <AddEntityModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      )}

      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onEdited={handleEdited}
        />
      )}
    </div>
  );
}

function AddEntityModal({
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

      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add entity");
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
        <h2>New Entity</h2>
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

function EditEntityModal({
  entity,
  onClose,
  onEdited,
}: {
  entity: EntityConfig;
  onClose: () => void;
  onEdited: () => void;
}) {
  const [displayName, setDisplayName] = useState(entity.displayName);
  const [catalogId, setCatalogId] = useState(entity.catalogId);
  const [email, setEmail] = useState(entity.email || "");
  const [firstName, setFirstName] = useState(entity.firstName || "");
  const [lastName, setLastName] = useState(entity.lastName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, {
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
        throw new Error(data.error || "Failed to update entity");
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
        <h2>Edit Entity</h2>
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
