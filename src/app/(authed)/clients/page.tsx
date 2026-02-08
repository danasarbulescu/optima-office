"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Client, EntityConfig } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import { getAllModuleManifests } from "@/modules/registry";
import "./clients.css";

type ClientSortColumn = "displayName" | "slug";
type SortDirection = "asc" | "desc";

const ALL_MODULES = getAllModuleManifests();
const DEFAULT_MODULES = ["dashboard", "trend-analysis"];

export default function ClientsPage() {
  const { refreshEntities } = useEntity();
  const [clients, setClients] = useState<Client[]>([]);
  const [allEntities, setAllEntities] = useState<EntityConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [addEntityForClientId, setAddEntityForClientId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<EntityConfig | null>(null);
  const [sortColumn, setSortColumn] = useState<ClientSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, entitiesRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/entities"),
      ]);
      if (!clientsRes.ok) throw new Error("Failed to load clients");
      if (!entitiesRes.ok) throw new Error("Failed to load entities");
      const clientsData = await clientsRes.json();
      const entitiesData = await entitiesRes.json();
      setClients(clientsData.clients);
      setAllEntities(entitiesData.entities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const entitiesByClient = useMemo(() => {
    const map: Record<string, EntityConfig[]> = {};
    for (const e of allEntities) {
      if (!map[e.clientId]) map[e.clientId] = [];
      map[e.clientId].push(e);
    }
    return map;
  }, [allEntities]);

  const handleSort = (column: ClientSortColumn) => {
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

  const sortIndicator = (column: ClientSortColumn) => {
    if (sortColumn !== column)
      return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const toggleExpand = (clientId: string) => {
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));
  };

  const handleDeleteClient = async (client: Client) => {
    const entityCount = (entitiesByClient[client.id] || []).length;
    const msg = entityCount > 0
      ? `Delete client "${client.displayName}" and its ${entityCount} entit${entityCount === 1 ? "y" : "ies"}?`
      : `Delete client "${client.displayName}"?`;
    if (!confirm(msg)) return;
    try {
      // Delete all entities for this client first
      const clientEntities = entitiesByClient[client.id] || [];
      for (const e of clientEntities) {
        await fetch(`/api/entities/${encodeURIComponent(e.id)}`, { method: "DELETE" });
      }
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client");
      if (expandedClientId === client.id) setExpandedClientId(null);
      await fetchData();
      refreshEntities();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteEntity = async (entity: EntityConfig) => {
    if (!confirm(`Delete entity "${entity.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entity");
      await fetchData();
      refreshEntities();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const afterMutation = () => {
    fetchData();
    refreshEntities();
  };

  if (loading) return <div className="app-loading">Loading clients...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="clients-page">
      <div className="clients-header">
        <h1>Clients</h1>
        <button className="add-client-btn" onClick={() => setShowAddClientModal(true)}>
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
                <th style={{ width: 32 }}></th>
                <th className="sortable-th" onClick={() => handleSort("displayName")}>
                  Display Name {sortIndicator("displayName")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("slug")}>
                  Slug {sortIndicator("slug")}
                </th>
                <th>Contact</th>
                <th>Entities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((c) => {
                const isExpanded = expandedClientId === c.id;
                const clientEntities = entitiesByClient[c.id] || [];
                const contactName = [c.firstName, c.lastName].filter(Boolean).join(" ");
                return (
                  <ClientRow
                    key={c.id}
                    client={c}
                    isExpanded={isExpanded}
                    entityCount={clientEntities.length}
                    contactName={contactName}
                    onToggle={() => toggleExpand(c.id)}
                    onEdit={(e) => { e.stopPropagation(); setEditingClient(c); }}
                    onDelete={(e) => { e.stopPropagation(); handleDeleteClient(c); }}
                    entities={clientEntities}
                    onAddEntity={() => setAddEntityForClientId(c.id)}
                    onEditEntity={(ent) => setEditingEntity(ent)}
                    onDeleteEntity={handleDeleteEntity}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddClientModal && (
        <AddClientModal
          onClose={() => setShowAddClientModal(false)}
          onSaved={() => { setShowAddClientModal(false); afterMutation(); }}
        />
      )}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={() => { setEditingClient(null); afterMutation(); }}
        />
      )}
      {addEntityForClientId && (
        <AddEntityModal
          clientId={addEntityForClientId}
          onClose={() => setAddEntityForClientId(null)}
          onSaved={() => { setAddEntityForClientId(null); afterMutation(); }}
        />
      )}
      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSaved={() => { setEditingEntity(null); afterMutation(); }}
        />
      )}
    </div>
  );
}

/* ─── Client Row + Expanded Detail ─── */

function ClientRow({
  client,
  isExpanded,
  entityCount,
  contactName,
  onToggle,
  onEdit,
  onDelete,
  entities,
  onAddEntity,
  onEditEntity,
  onDeleteEntity,
}: {
  client: Client;
  isExpanded: boolean;
  entityCount: number;
  contactName: string;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  entities: EntityConfig[];
  onAddEntity: () => void;
  onEditEntity: (e: EntityConfig) => void;
  onDeleteEntity: (e: EntityConfig) => void;
}) {
  return (
    <>
      <tr className={`client-row ${isExpanded ? "client-row-expanded" : ""}`} onClick={onToggle}>
        <td>
          <span className={`expand-arrow ${isExpanded ? "expand-arrow-open" : ""}`}>{"\u25B6"}</span>
        </td>
        <td>{client.displayName}</td>
        <td><code className="slug-badge">{client.slug}</code></td>
        <td>{contactName || <span className="text-muted">—</span>}</td>
        <td><span className="entity-count">{entityCount}</span></td>
        <td>
          <div className="action-buttons">
            <button className="edit-btn" onClick={onEdit}>Edit</button>
            <button className="delete-btn" onClick={onDelete}>Delete</button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="detail-row">
          <td colSpan={6}>
            <div className="detail-content">
              {/* Client Info Panel */}
              <div className="client-info-panel">
                <h3>Client Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Business Name</span>
                    <span className="info-value">{client.displayName}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Slug</span>
                    <span className="info-value"><code>{client.slug}</code></span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">First Name</span>
                    <span className="info-value">{client.firstName || <span className="text-muted">—</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Name</span>
                    <span className="info-value">{client.lastName || <span className="text-muted">—</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{client.email || <span className="text-muted">—</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Modules</span>
                    <span className="info-value">
                      {(client.enabledModules || DEFAULT_MODULES).map((m) => {
                        const mod = ALL_MODULES.find((am) => am.id === m);
                        return <span key={m} className="module-tag">{mod?.navLabel || m}</span>;
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entities Sub-table */}
              <div className="entities-section">
                <div className="entities-section-header">
                  <h3>Entities</h3>
                  <button className="add-entity-btn" onClick={onAddEntity}>New Entity</button>
                </div>
                {entities.length === 0 ? (
                  <div className="entities-empty-sub">No entities yet.</div>
                ) : (
                  <table className="entities-sub-table">
                    <thead>
                      <tr>
                        <th>Entity Name</th>
                        <th>CData Catalog ID</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entities.map((e) => (
                        <tr key={e.id}>
                          <td>{e.displayName}</td>
                          <td><code>{e.catalogId}</code></td>
                          <td>
                            <div className="action-buttons">
                              <button className="edit-btn" onClick={() => onEditEntity(e)}>Edit</button>
                              <button className="delete-btn" onClick={() => onDeleteEntity(e)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Add Client Modal ─── */

function AddClientModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [enabledModules, setEnabledModules] = useState<string[]>([...DEFAULT_MODULES]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const toggleModule = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { slug, displayName, enabledModules };
      if (firstName.trim()) body.firstName = firstName.trim();
      if (lastName.trim()) body.lastName = lastName.trim();
      if (email.trim()) body.email = email.trim();

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add client");
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
        <h2>New Client</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. ACME Corp"
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="e.g. acme-corp"
          />
          {slug && !slugValid && (
            <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>
          )}
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
        <div className="modal-separator" />
        <div className="modal-field">
          <label>Enabled Modules</label>
          <div className="module-checkbox-group">
            {ALL_MODULES.map((m) => (
              <label key={m.id} className="module-checkbox">
                <input
                  type="checkbox"
                  checked={enabledModules.includes(m.id)}
                  onChange={() => toggleModule(m.id)}
                />
                {m.navLabel}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Client Modal ─── */

function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(client.displayName);
  const [slug, setSlug] = useState(client.slug);
  const [firstName, setFirstName] = useState(client.firstName || "");
  const [lastName, setLastName] = useState(client.lastName || "");
  const [email, setEmail] = useState(client.email || "");
  const [enabledModules, setEnabledModules] = useState<string[]>(
    client.enabledModules || [...DEFAULT_MODULES]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const toggleModule = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          displayName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          enabledModules,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update client");
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
          <label>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          {slug && !slugValid && (
            <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>
          )}
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
        <div className="modal-separator" />
        <div className="modal-field">
          <label>Enabled Modules</label>
          <div className="module-checkbox-group">
            {ALL_MODULES.map((m) => (
              <label key={m.id} className="module-checkbox">
                <input
                  type="checkbox"
                  checked={enabledModules.includes(m.id)}
                  onChange={() => toggleModule(m.id)}
                />
                {m.navLabel}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Entity Modal ─── */

function AddEntityModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
        },
        body: JSON.stringify({ catalogId, displayName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add entity");
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
        <h2>New Entity</h2>
        <div className="modal-field">
          <label>Entity Name</label>
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
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
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

/* ─── Edit Entity Modal ─── */

function EditEntityModal({
  entity,
  onClose,
  onSaved,
}: {
  entity: EntityConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(entity.displayName);
  const [catalogId, setCatalogId] = useState(entity.catalogId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId, displayName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update entity");
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
        <h2>Edit Entity</h2>
        <div className="modal-field">
          <label>Entity Name</label>
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
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
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
