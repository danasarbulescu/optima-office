"use client";

import { useState, useEffect } from "react";
import { Client, EntityConfig, Package, Dashboard, ClientUser, DataSource } from "@/lib/types";
import { DATA_SOURCE_TYPES } from "@/lib/data-source-types";

/* ─── Edit Client Modal ─── */

export function EditClientModal({
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

export function AddEntityModal({
  clientId,
  dataSources,
  onClose,
  onSaved,
}: {
  clientId: string;
  dataSources: DataSource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [dataSourceId, setDataSourceId] = useState("");
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeSources = dataSources.filter(ds => ds.status === 'active');
  const selectedDs = activeSources.find(ds => ds.id === dataSourceId);
  const dsType = selectedDs?.type || 'cdata';
  const entityFields = DATA_SOURCE_TYPES[dsType]?.entityFields || [];

  const updateSourceConfig = (key: string, value: string) => {
    setSourceConfig(prev => ({ ...prev, [key]: value }));
  };

  const entityFieldsValid = entityFields.every(f => (sourceConfig[f.key] || '').trim());

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
        body: JSON.stringify({ displayName, dataSourceId: dataSourceId || undefined, sourceConfig }),
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
          <label>Data Source</label>
          <select value={dataSourceId} onChange={e => setDataSourceId(e.target.value)}>
            <option value="">(Use default)</option>
            {activeSources.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.displayName}</option>
            ))}
          </select>
        </div>
        {entityFields.length > 0 && (
          <>
            <div className="modal-separator" />
            {entityFields.map(f => (
              <div className="modal-field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type="text"
                  value={sourceConfig[f.key] || ""}
                  onChange={e => updateSourceConfig(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !entityFieldsValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Entity Modal ─── */

export function EditEntityModal({
  entity,
  dataSources,
  onClose,
  onSaved,
}: {
  entity: EntityConfig;
  dataSources: DataSource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(entity.displayName);
  const [dataSourceId, setDataSourceId] = useState(entity.dataSourceId || "");
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>(
    entity.sourceConfig || { catalogId: entity.catalogId }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeSources = dataSources.filter(ds => ds.status === 'active');
  const selectedDs = activeSources.find(ds => ds.id === dataSourceId);
  const dsType = selectedDs?.type || 'cdata';
  const entityFields = DATA_SOURCE_TYPES[dsType]?.entityFields || [];

  const updateSourceConfig = (key: string, value: string) => {
    setSourceConfig(prev => ({ ...prev, [key]: value }));
  };

  const entityFieldsValid = entityFields.every(f => (sourceConfig[f.key] || '').trim());

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, dataSourceId: dataSourceId || "", sourceConfig }),
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
          <label>Data Source</label>
          <select value={dataSourceId} onChange={e => setDataSourceId(e.target.value)}>
            <option value="">(Use default)</option>
            {activeSources.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.displayName}</option>
            ))}
          </select>
        </div>
        {entityFields.length > 0 && (
          <>
            <div className="modal-separator" />
            {entityFields.map(f => (
              <div className="modal-field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type="text"
                  value={sourceConfig[f.key] || ""}
                  onChange={e => updateSourceConfig(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || !entityFieldsValid}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Package Modal ─── */

export function AddPackageModal({
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

export function EditPackageModal({
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

export function AddDashboardModal({
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
        body: JSON.stringify({ packageId, clientId, slug, displayName, sortOrder }),
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

export function EditDashboardModal({
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
        body: JSON.stringify({ slug, displayName, sortOrder }),
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

export function AddWidgetModal({
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
        const res = await fetch(`/api/widget-types`);
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
  }, [existingWidgetTypeIds]);

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

/* ─── Add Client User Modal ─── */

export function AddClientUserModal({
  clientId,
  packages,
  onClose,
  onSaved,
}: {
  clientId: string;
  packages: Package[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const togglePackage = (id: string) => {
    setSelectedPackageIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/client-users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
        body: JSON.stringify({
          clientId,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          authorizedPackageIds: selectedPackageIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create client user");
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
        <h2>New Client User</h2>
        <div className="modal-field">
          <label>First Name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>Last Name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {packages.length > 0 && (
          <>
            <div className="modal-separator" />
            <div className="modal-field">
              <label>Authorized Packages</label>
              <div className="widget-select-list">
                {packages.map(pkg => (
                  <label key={pkg.id} className="widget-select-item">
                    <input
                      type="checkbox"
                      checked={selectedPackageIds.includes(pkg.id)}
                      onChange={() => togglePackage(pkg.id)}
                    />
                    {pkg.displayName}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
          >
            {saving ? "Creating..." : "Create & Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Client User Modal ─── */

export function EditClientUserModal({
  clientUser,
  packages,
  onClose,
  onSaved,
}: {
  clientUser: ClientUser;
  packages: Package[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(clientUser.firstName);
  const [lastName, setLastName] = useState(clientUser.lastName);
  const [status, setStatus] = useState(clientUser.status);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(
    clientUser.authorizedPackageIds || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const togglePackage = (id: string) => {
    setSelectedPackageIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client-users/${encodeURIComponent(clientUser.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          status,
          authorizedPackageIds: selectedPackageIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update client user");
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
        <h2>Edit Client User</h2>
        <div className="modal-field">
          <label>First Name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label>Last Name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={clientUser.email} disabled className="input-disabled" />
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select className="status-select" value={status} onChange={e => setStatus(e.target.value as 'active' | 'archived')}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {packages.length > 0 && (
          <>
            <div className="modal-separator" />
            <div className="modal-field">
              <label>Authorized Packages</label>
              <div className="widget-select-list">
                {packages.map(pkg => (
                  <label key={pkg.id} className="widget-select-item">
                    <input
                      type="checkbox"
                      checked={selectedPackageIds.includes(pkg.id)}
                      onChange={() => togglePackage(pkg.id)}
                    />
                    {pkg.displayName}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
