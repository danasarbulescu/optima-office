"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Client, EntityConfig, Package, Dashboard, DashboardWidget } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import { getWidgetType } from "@/widgets/registry";
import "../clients.css";

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { refreshEntities } = useEntity();

  const [client, setClient] = useState<Client | null>(null);
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [allWidgets, setAllWidgets] = useState<Record<string, DashboardWidget[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [editingClient, setEditingClient] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityConfig | null>(null);
  const [addPackageOpen, setAddPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [addDashboardForPackage, setAddDashboardForPackage] = useState<string | null>(null);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [addWidgetForDashboard, setAddWidgetForDashboard] = useState<Dashboard | null>(null);

  // Accordion state
  const [expandedPkgId, setExpandedPkgId] = useState<string | null>(null);
  const [expandedDashId, setExpandedDashId] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Client not found");
      const data = await res.json();
      setClient(data.client);
    } catch (err: any) {
      setError(err.message);
    }
  }, [clientId]);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch(`/api/entities?clientId=${clientId}`, {
        headers: { "x-client-id": clientId },
      });
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities);
      }
    } catch { /* non-fatal */ }
  }, [clientId]);

  const fetchPackagesData = useCallback(async () => {
    try {
      const [pkgRes, dashRes] = await Promise.all([
        fetch(`/api/packages?clientId=${clientId}`, { headers: { "x-client-id": clientId } }),
        fetch(`/api/dashboards?clientId=${clientId}`, { headers: { "x-client-id": clientId } }),
      ]);
      if (pkgRes.ok) {
        const { packages: pkgs } = await pkgRes.json();
        setPackages(pkgs);
      }
      if (dashRes.ok) {
        const { dashboards: dashes } = await dashRes.json();
        setDashboards(dashes);

        // Fetch widgets for each dashboard
        const widgetMap: Record<string, DashboardWidget[]> = {};
        await Promise.all(
          dashes.map(async (d: Dashboard) => {
            const res = await fetch(`/api/dashboards/${d.id}/widgets`, {
              headers: { "x-client-id": clientId },
            });
            if (res.ok) {
              const { widgets } = await res.json();
              widgetMap[d.id] = widgets;
            }
          })
        );
        setAllWidgets(widgetMap);
      }
    } catch { /* non-fatal */ }
  }, [clientId]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchClient(), fetchEntities(), fetchPackagesData()]);
      setLoading(false);
    })();
  }, [fetchClient, fetchEntities, fetchPackagesData]);

  const dashboardsByPackage = useMemo(() => {
    const map: Record<string, Dashboard[]> = {};
    for (const d of dashboards) {
      if (!map[d.packageId]) map[d.packageId] = [];
      map[d.packageId].push(d);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [dashboards]);

  const afterClientMutation = () => {
    fetchClient();
  };

  const afterEntityMutation = () => {
    fetchEntities();
    refreshEntities();
  };

  const afterPackageMutation = () => {
    fetchPackagesData();
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    const msg = entities.length > 0
      ? `Delete client "${client.displayName}" and its ${entities.length} entit${entities.length === 1 ? "y" : "ies"}?`
      : `Delete client "${client.displayName}"?`;
    if (!confirm(msg)) return;
    try {
      for (const e of entities) {
        await fetch(`/api/entities/${encodeURIComponent(e.id)}`, { method: "DELETE" });
      }
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client");
      refreshEntities();
      router.push("/clients");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteEntity = async (entity: EntityConfig) => {
    if (!confirm(`Delete entity "${entity.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entity");
      afterEntityMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePackage = async (pkg: Package) => {
    if (!confirm(`Delete package "${pkg.displayName}" and all its dashboards/widgets?`)) return;
    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(pkg.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete package");
      afterPackageMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (!confirm(`Delete dashboard "${dashboard.displayName}" and all its widgets?`)) return;
    try {
      const res = await fetch(`/api/dashboards/${encodeURIComponent(dashboard.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete dashboard");
      afterPackageMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteWidget = async (dashboardId: string, widgetId: string) => {
    if (!confirm("Remove this widget?")) return;
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete widget");
      afterPackageMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="app-loading">Loading client...</div>;
  if (error) return <div className="app-error">{error}</div>;
  if (!client) return <div className="app-error">Client not found</div>;

  return (
    <div className="clients-page">
      <Link href="/clients" className="back-link">
        &larr; Back to Clients
      </Link>

      {/* Client Info Section */}
      <div className="clients-header">
        <h1>{client.displayName}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="edit-btn" onClick={() => setEditingClient(true)}>Edit</button>
          <button className="delete-btn" onClick={handleDeleteClient}>Delete</button>
        </div>
      </div>

      <div className="client-info-panel">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Slug</span>
            <span className="info-value"><code>{client.slug}</code></span>
          </div>
          <div className="info-item">
            <span className="info-label">Status</span>
            <span className="info-value">
              <span className={`status-badge ${(client.status || "active") === "active" ? "status-active" : "status-archived"}`}>
                {(client.status || "active").charAt(0).toUpperCase() + (client.status || "active").slice(1)}
              </span>
            </span>
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
        </div>
      </div>

      {/* Entities Section */}
      <div className="entities-section">
        <div className="entities-section-header">
          <h3>Entities</h3>
          <button className="add-entity-btn" onClick={() => setAddEntityOpen(true)}>New Entity</button>
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
                      <button className="edit-btn" onClick={() => setEditingEntity(e)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDeleteEntity(e)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Packages Section */}
      <div className="entities-section">
        <div className="entities-section-header">
          <h3>Packages</h3>
          <button className="add-entity-btn" onClick={() => setAddPackageOpen(true)}>New Package</button>
        </div>
        {packages.length === 0 ? (
          <div className="entities-empty-sub">No packages yet.</div>
        ) : (
          <table className="entities-sub-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Package Name</th>
                <th>Slug</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => {
                const pkgExpanded = expandedPkgId === pkg.id;
                const pkgDashboards = dashboardsByPackage[pkg.id] || [];
                return (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    isExpanded={pkgExpanded}
                    dashboards={pkgDashboards}
                    allWidgets={allWidgets}
                    expandedDashId={expandedDashId}
                    onToggle={() => setExpandedPkgId(pkgExpanded ? null : pkg.id)}
                    onEdit={() => setEditingPackage(pkg)}
                    onDelete={() => handleDeletePackage(pkg)}
                    onAddDashboard={() => setAddDashboardForPackage(pkg.id)}
                    onEditDashboard={(d) => setEditingDashboard(d)}
                    onDeleteDashboard={handleDeleteDashboard}
                    onToggleDash={(id) => setExpandedDashId(expandedDashId === id ? null : id)}
                    onAddWidget={(d) => setAddWidgetForDashboard(d)}
                    onDeleteWidget={handleDeleteWidget}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {editingClient && (
        <EditClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSaved={() => { setEditingClient(false); afterClientMutation(); }}
        />
      )}
      {addEntityOpen && (
        <AddEntityModal
          clientId={clientId}
          onClose={() => setAddEntityOpen(false)}
          onSaved={() => { setAddEntityOpen(false); afterEntityMutation(); }}
        />
      )}
      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSaved={() => { setEditingEntity(null); afterEntityMutation(); }}
        />
      )}
      {addPackageOpen && (
        <AddPackageModal
          clientId={clientId}
          onClose={() => setAddPackageOpen(false)}
          onSaved={() => { setAddPackageOpen(false); afterPackageMutation(); }}
        />
      )}
      {editingPackage && (
        <EditPackageModal
          pkg={editingPackage}
          onClose={() => setEditingPackage(null)}
          onSaved={() => { setEditingPackage(null); afterPackageMutation(); }}
        />
      )}
      {addDashboardForPackage && (
        <AddDashboardModal
          packageId={addDashboardForPackage}
          clientId={clientId}
          onClose={() => setAddDashboardForPackage(null)}
          onSaved={() => { setAddDashboardForPackage(null); afterPackageMutation(); }}
        />
      )}
      {editingDashboard && (
        <EditDashboardModal
          dashboard={editingDashboard}
          onClose={() => setEditingDashboard(null)}
          onSaved={() => { setEditingDashboard(null); afterPackageMutation(); }}
        />
      )}
      {addWidgetForDashboard && (
        <AddWidgetModal
          dashboard={addWidgetForDashboard}
          existingWidgetTypeIds={(allWidgets[addWidgetForDashboard.id] || []).map(w => w.widgetTypeId)}
          onClose={() => setAddWidgetForDashboard(null)}
          onSaved={() => { setAddWidgetForDashboard(null); afterPackageMutation(); }}
        />
      )}
    </div>
  );
}

/* ─── Package Row (nested accordion) ─── */

function PackageRow({
  pkg, isExpanded, dashboards, allWidgets, expandedDashId,
  onToggle, onEdit, onDelete, onAddDashboard, onEditDashboard, onDeleteDashboard,
  onToggleDash, onAddWidget, onDeleteWidget,
}: {
  pkg: Package;
  isExpanded: boolean;
  dashboards: Dashboard[];
  allWidgets: Record<string, DashboardWidget[]>;
  expandedDashId: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddDashboard: () => void;
  onEditDashboard: (d: Dashboard) => void;
  onDeleteDashboard: (d: Dashboard) => void;
  onToggleDash: (id: string) => void;
  onAddWidget: (d: Dashboard) => void;
  onDeleteWidget: (dashboardId: string, widgetId: string) => void;
}) {
  return (
    <>
      <tr className={`client-row ${isExpanded ? "client-row-expanded" : ""}`} onClick={onToggle}>
        <td>
          <span className={`expand-arrow ${isExpanded ? "expand-arrow-open" : ""}`}>{"\u25B6"}</span>
        </td>
        <td>{pkg.displayName}</td>
        <td><code className="slug-badge">{pkg.slug}</code></td>
        <td>{pkg.sortOrder}</td>
        <td>
          <div className="action-buttons">
            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="detail-row">
          <td colSpan={5}>
            <div className="detail-content" style={{ paddingLeft: 24 }}>
              <div className="entities-section">
                <div className="entities-section-header">
                  <h3>Dashboards</h3>
                  <button className="add-entity-btn" onClick={onAddDashboard}>New Dashboard</button>
                </div>
                {dashboards.length === 0 ? (
                  <div className="entities-empty-sub">No dashboards yet.</div>
                ) : (
                  <table className="entities-sub-table">
                    <thead>
                      <tr>
                        <th style={{ width: 24 }}></th>
                        <th>Dashboard Name</th>
                        <th>Slug</th>
                        <th>Data Source</th>
                        <th>Order</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboards.map((d) => {
                        const dashExpanded = expandedDashId === d.id;
                        const widgets = allWidgets[d.id] || [];
                        return (
                          <DashboardRow
                            key={d.id}
                            dashboard={d}
                            isExpanded={dashExpanded}
                            widgets={widgets}
                            onToggle={() => onToggleDash(d.id)}
                            onEdit={() => onEditDashboard(d)}
                            onDelete={() => onDeleteDashboard(d)}
                            onAddWidget={() => onAddWidget(d)}
                            onDeleteWidget={(wId) => onDeleteWidget(d.id, wId)}
                          />
                        );
                      })}
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

/* ─── Dashboard Row (nested accordion) ─── */

function DashboardRow({
  dashboard, isExpanded, widgets,
  onToggle, onEdit, onDelete, onAddWidget, onDeleteWidget,
}: {
  dashboard: Dashboard;
  isExpanded: boolean;
  widgets: DashboardWidget[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWidget: () => void;
  onDeleteWidget: (widgetId: string) => void;
}) {
  return (
    <>
      <tr className={`client-row ${isExpanded ? "client-row-expanded" : ""}`} onClick={onToggle}>
        <td>
          <span className={`expand-arrow ${isExpanded ? "expand-arrow-open" : ""}`}>{"\u25B6"}</span>
        </td>
        <td>{dashboard.displayName}</td>
        <td><code className="slug-badge">{dashboard.slug}</code></td>
        <td><code className="slug-badge">{dashboard.dataSourceType}</code></td>
        <td>{dashboard.sortOrder}</td>
        <td>
          <div className="action-buttons">
            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="detail-row">
          <td colSpan={6}>
            <div className="detail-content" style={{ paddingLeft: 24 }}>
              <div className="entities-section">
                <div className="entities-section-header">
                  <h3>Widgets</h3>
                  <button className="add-entity-btn" onClick={onAddWidget}>Add Widget</button>
                </div>
                {widgets.length === 0 ? (
                  <div className="entities-empty-sub">No widgets yet.</div>
                ) : (
                  <table className="entities-sub-table">
                    <thead>
                      <tr>
                        <th>Widget Type</th>
                        <th>Category</th>
                        <th>Order</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {widgets.map((w) => {
                        const wt = getWidgetType(w.widgetTypeId);
                        return (
                          <tr key={w.id}>
                            <td>{wt?.name || w.widgetTypeId}</td>
                            <td>{wt?.category || "—"}</td>
                            <td>{w.sortOrder}</td>
                            <td>
                              <div className="action-buttons">
                                <button className="delete-btn" onClick={() => onDeleteWidget(w.id)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
  const [slug, setSlug] = useState(client.slug || "");
  const [firstName, setFirstName] = useState(client.firstName || "");
  const [lastName, setLastName] = useState(client.lastName || "");
  const [email, setEmail] = useState(client.email || "");
  const [status, setStatus] = useState(client.status || "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

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
          status,
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
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          {slug && !slugValid && <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>}
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select className="status-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="modal-separator" />
        <div className="modal-field">
          <label>First Name</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Last Name</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}>
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
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
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
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Brooklyn Restaurants" autoFocus />
        </div>
        <div className="modal-field">
          <label>CData Catalog ID</label>
          <input type="text" value={catalogId} onChange={(e) => setCatalogId(e.target.value)} placeholder="e.g. BrooklynRestaurants" />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !catalogId.trim()}>
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
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>CData Catalog ID</label>
          <input type="text" value={catalogId} onChange={(e) => setCatalogId(e.target.value)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !catalogId.trim()}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Package Modal ─── */

function AddPackageModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setDisplayName(name);
    if (!slug || slug === autoSlug(displayName)) {
      setSlug(autoSlug(name));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
        body: JSON.stringify({ clientId, slug, displayName, sortOrder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add package");
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
        <h2>New Package</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input type="text" value={displayName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Financial Reports" autoFocus />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="e.g. financial-reports" />
          {slug && !slugValid && <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>}
        </div>
        <div className="modal-field">
          <label>Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Package Modal ─── */

function EditPackageModal({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: Package;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(pkg.displayName);
  const [slug, setSlug] = useState(pkg.slug);
  const [sortOrder, setSortOrder] = useState(pkg.sortOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(pkg.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, displayName, sortOrder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update package");
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
        <h2>Edit Package</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          {slug && !slugValid && <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>}
        </div>
        <div className="modal-field">
          <label>Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Dashboard Modal ─── */

function AddDashboardModal({
  packageId,
  clientId,
  onClose,
  onSaved,
}: {
  packageId: string;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [dataSourceType, setDataSourceType] = useState("financial-snapshot");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setDisplayName(name);
    if (!slug || slug === autoSlug(displayName)) {
      setSlug(autoSlug(name));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
        body: JSON.stringify({ packageId, clientId, slug, displayName, sortOrder, dataSourceType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add dashboard");
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
        <h2>New Dashboard</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input type="text" value={displayName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Monthly Dashboard" autoFocus />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="e.g. monthly-dashboard" />
          {slug && !slugValid && <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>}
        </div>
        <div className="modal-field">
          <label>Data Source Type</label>
          <select value={dataSourceType} onChange={(e) => setDataSourceType(e.target.value)}>
            <option value="financial-snapshot">Financial Snapshot</option>
            <option value="expense-trend">Expense Trend</option>
          </select>
        </div>
        <div className="modal-field">
          <label>Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Dashboard Modal ─── */

function EditDashboardModal({
  dashboard,
  onClose,
  onSaved,
}: {
  dashboard: Dashboard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(dashboard.displayName);
  const [slug, setSlug] = useState(dashboard.slug);
  const [sortOrder, setSortOrder] = useState(dashboard.sortOrder);
  const [dataSourceType, setDataSourceType] = useState(dashboard.dataSourceType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboards/${encodeURIComponent(dashboard.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, displayName, sortOrder, dataSourceType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update dashboard");
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
        <h2>Edit Dashboard</h2>
        <div className="modal-field">
          <label>Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          {slug && !slugValid && <div className="slug-hint">Only lowercase letters, numbers, and hyphens</div>}
        </div>
        <div className="modal-field">
          <label>Data Source Type</label>
          <select value={dataSourceType} onChange={(e) => setDataSourceType(e.target.value)}>
            <option value="financial-snapshot">Financial Snapshot</option>
            <option value="expense-trend">Expense Trend</option>
          </select>
        </div>
        <div className="modal-field">
          <label>Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !slug.trim() || !slugValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Widget Modal ─── */

function AddWidgetModal({
  dashboard,
  existingWidgetTypeIds,
  onClose,
  onSaved,
}: {
  dashboard: Dashboard;
  existingWidgetTypeIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [widgetTypes, setWidgetTypes] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/widget-types?dataSourceType=${dashboard.dataSourceType}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already-mapped widget types
          const available = data.widgetTypes.filter(
            (wt: any) => !existingWidgetTypeIds.includes(wt.id)
          );
          setWidgetTypes(available);
        }
      } catch { /* non-fatal */ }
      setLoading(false);
    })();
  }, [dashboard.dataSourceType, existingWidgetTypeIds]);

  const toggleWidget = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Add each selected widget
      for (let i = 0; i < selectedIds.length; i++) {
        const res = await fetch(`/api/dashboards/${dashboard.id}/widgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-client-id": dashboard.clientId },
          body: JSON.stringify({
            widgetTypeId: selectedIds[i],
            sortOrder: existingWidgetTypeIds.length + i,
          }),
        });
        if (!res.ok) throw new Error("Failed to add widget");
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
        <h2>Add Widgets to {dashboard.displayName}</h2>
        {loading ? (
          <div className="entities-empty-sub">Loading widget types...</div>
        ) : widgetTypes.length === 0 ? (
          <div className="entities-empty-sub">No available widget types for this data source.</div>
        ) : (
          <div className="widget-select-list">
            {widgetTypes.map((wt: any) => (
              <label key={wt.id} className="widget-select-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(wt.id)}
                  onChange={() => toggleWidget(wt.id)}
                />
                {wt.name}
                <span className="widget-select-category">{wt.category}</span>
              </label>
            ))}
          </div>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || selectedIds.length === 0}>
            {saving ? "Adding..." : `Add ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
