"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Client, EntityConfig, Package, Dashboard, DashboardWidget, ClientUser, DataSource, getEntityBindings } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import { PackageRow } from "./PackageAccordion";
import {
  EditClientModal,
  AddEntityModal,
  EditEntityModal,
  AddPackageModal,
  EditPackageModal,
  AddDashboardModal,
  EditDashboardModal,
  AddWidgetModal,
  AddClientUserModal,
  EditClientUserModal,
  ManageAccessModal,
} from "./modals";
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
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [addClientUserOpen, setAddClientUserOpen] = useState(false);
  const [editingClientUser, setEditingClientUser] = useState<ClientUser | null>(null);
  const [managingAccessUser, setManagingAccessUser] = useState<ClientUser | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  // Sync state
  const [syncingEntityId, setSyncingEntityId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ entityId: string; status: 'success' | 'error'; message: string } | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchClientUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/client-users?clientId=${clientId}`, {
        headers: { "x-client-id": clientId },
      });
      if (res.ok) {
        const data = await res.json();
        setClientUsers(data.clientUsers);
      }
    } catch { /* non-fatal */ }
  }, [clientId]);

  // Initial load: single bootstrap call (one auth resolution instead of 5+)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/bootstrap`);
        if (!res.ok) throw new Error("Client not found");
        const data = await res.json();
        setClient(data.client);
        setEntities(data.entities);
        setPackages(data.packages);
        setDashboards(data.dashboards);
        setAllWidgets(data.widgetsByDashboard);
        setClientUsers(data.clientUsers);
        setDataSources(data.dataSources);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

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

  const afterClientUserMutation = () => {
    fetchClientUsers();
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    const msg = entities.length > 0
      ? `Delete client "${client.displayName}" and its ${entities.length} entit${entities.length === 1 ? "y" : "ies"}?`
      : `Delete client "${client.displayName}"?`;
    if (!confirm(msg)) return;
    try {
      for (const cu of clientUsers) {
        await fetch(`/api/client-users/${encodeURIComponent(cu.id)}`, { method: "DELETE" });
      }
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

  const handleSyncEntity = async (entity: EntityConfig) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncResult(null);
    setSyncingEntityId(entity.id);
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncResult({ entityId: entity.id, status: 'success', message: `Synced ${data.rowCount} rows` });
      syncTimerRef.current = setTimeout(() => setSyncResult(null), 3000);
    } catch (err: any) {
      setSyncResult({ entityId: entity.id, status: 'error', message: err.message });
    } finally {
      setSyncingEntityId(null);
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
    if (!confirm(`Delete package "${pkg.displayName}"? This will delete all its dashboards.`)) return;
    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(pkg.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete package");
      afterPackageMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (!confirm(`Delete dashboard "${dashboard.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/dashboards/${encodeURIComponent(dashboard.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete dashboard");
      afterPackageMutation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteClientUser = async (cu: ClientUser) => {
    if (!confirm(`Delete client user "${cu.firstName} ${cu.lastName}"? This will also remove their login access.`)) return;
    try {
      const res = await fetch(`/api/client-users/${encodeURIComponent(cu.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client user");
      afterClientUserMutation();
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
                <th>Data Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => {
                const eBindings = getEntityBindings(e);
                const firstDs = eBindings.length > 0 ? dataSources.find(d => d.id === eBindings[0].dataSourceId) : null;
                const extraCount = eBindings.length > 1 ? eBindings.length - 1 : 0;
                return (
                  <tr key={e.id}>
                    <td>{e.displayName}</td>
                    <td>
                      {firstDs ? (
                        <>
                          {firstDs.displayName}
                          {extraCount > 0 && <span className="extra-ds-count">(+{extraCount} more)</span>}
                        </>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="sync-btn"
                          disabled={syncingEntityId === e.id}
                          onClick={() => handleSyncEntity(e)}
                        >
                          {syncingEntityId === e.id ? 'Syncing...' : 'Sync'}
                        </button>
                        {syncResult?.entityId === e.id && (
                          <span className={`sync-result ${syncResult.status}`}>{syncResult.message}</span>
                        )}
                        <button className="edit-btn" onClick={() => setEditingEntity(e)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteEntity(e)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Client Users Section */}
      <div className="entities-section">
        <div className="entities-section-header">
          <h3>Client Users</h3>
          <button className="add-entity-btn" onClick={() => setAddClientUserOpen(true)}>New Client User</button>
        </div>
        {clientUsers.length === 0 ? (
          <div className="entities-empty-sub">No client users yet.</div>
        ) : (
          <table className="entities-sub-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientUsers.map((cu) => (
                <tr key={cu.id}>
                  <td>{cu.firstName} {cu.lastName}</td>
                  <td>{cu.email}</td>
                  <td>
                    <span className={`status-badge ${cu.status === "active" ? "status-active" : "status-archived"}`}>
                      {cu.status.charAt(0).toUpperCase() + cu.status.slice(1)}
                    </span>
                  </td>
                  <td>{(cu.authorizedPackageIds?.length || 0) + (cu.authorizedDashboardIds?.length || 0) || "None"}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => setManagingAccessUser(cu)}>Access</button>
                      <button className="edit-btn" onClick={() => setEditingClientUser(cu)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDeleteClientUser(cu)}>Delete</button>
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
          dataSources={dataSources}
          onClose={() => setAddEntityOpen(false)}
          onSaved={() => { setAddEntityOpen(false); afterEntityMutation(); }}
        />
      )}
      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          dataSources={dataSources}
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
      {addClientUserOpen && (
        <AddClientUserModal
          clientId={clientId}
          onClose={() => setAddClientUserOpen(false)}
          onSaved={() => { setAddClientUserOpen(false); afterClientUserMutation(); }}
        />
      )}
      {editingClientUser && (
        <EditClientUserModal
          clientUser={editingClientUser}
          onClose={() => setEditingClientUser(null)}
          onSaved={() => { setEditingClientUser(null); afterClientUserMutation(); }}
        />
      )}
      {managingAccessUser && (
        <ManageAccessModal
          clientUser={managingAccessUser}
          packages={packages}
          dashboardsByPackage={dashboardsByPackage}
          onClose={() => setManagingAccessUser(null)}
          onSaved={() => { setManagingAccessUser(null); afterClientUserMutation(); }}
        />
      )}
    </div>
  );
}
