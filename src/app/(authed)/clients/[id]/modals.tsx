"use client";

import { useState, useEffect } from "react";
import { Client, EntityConfig, Package, Dashboard, ClientUser, DataSource, AccountCategory, getEntityBindings } from "@/lib/types";
import { DATA_SOURCE_TYPES } from "@/lib/data-source-types";

interface BindingState {
  dataSourceId: string;
  sourceConfig: Record<string, string>;
}

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
  const [firstName, setFirstName] = useState(client.firstName || "");
  const [lastName, setLastName] = useState(client.lastName || "");
  const [email, setEmail] = useState(client.email || "");
  const [status, setStatus] = useState(client.status || "active");
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
          <label>Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
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
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim()}>
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
  const [bindings, setBindings] = useState<BindingState[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const activeSources = dataSources.filter(ds => ds.status === 'active');

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addBinding = () => {
    setBindings(prev => [...prev, { dataSourceId: '', sourceConfig: {} }]);
  };

  const removeBinding = (index: number) => {
    setBindings(prev => prev.filter((_, i) => i !== index));
  };

  const updateBindingDataSource = (index: number, dsId: string) => {
    setBindings(prev => prev.map((b, i) =>
      i === index ? { dataSourceId: dsId, sourceConfig: {} } : b
    ));
  };

  const updateBindingSourceConfig = (index: number, key: string, value: string) => {
    setBindings(prev => prev.map((b, i) =>
      i === index ? { ...b, sourceConfig: { ...b.sourceConfig, [key]: value } } : b
    ));
  };

  const allBindingsValid = bindings.every(b => {
    if (!b.dataSourceId) return false;
    const ds = activeSources.find(d => d.id === b.dataSourceId);
    if (!ds) return false;
    const ef = DATA_SOURCE_TYPES[ds.type]?.entityFields || [];
    return ef.every(f => (b.sourceConfig[f.key] || '').trim());
  });

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const dataSourceBindings = bindings
        .filter(b => b.dataSourceId)
        .map(b => ({ dataSourceId: b.dataSourceId, sourceConfig: b.sourceConfig }));

      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": clientId },
        body: JSON.stringify({ displayName, dataSourceBindings }),
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
        <div className="modal-separator" />
        <div className="bindings-header">
          <label>Data Sources</label>
          {activeSources.length > 0 && (
            <button type="button" className="add-binding-btn" onClick={addBinding}>+ Add Data Source</button>
          )}
        </div>
        {activeSources.length === 0 ? (
          <div className="modal-hint">Please define a Data Source first.</div>
        ) : bindings.length === 0 ? (
          <div className="modal-hint">No data sources added. Click &quot;+ Add Data Source&quot; above.</div>
        ) : (
          bindings.map((binding, index) => {
            const ds = activeSources.find(d => d.id === binding.dataSourceId);
            const dsType = ds?.type;
            const entityFields = dsType ? (DATA_SOURCE_TYPES[dsType]?.entityFields || []) : [];
            return (
              <div key={index} className="binding-section">
                <div className="binding-header">
                  <span className="binding-ds-name">{ds ? ds.displayName : 'Select a data source'}</span>
                  <button type="button" className="remove-binding-btn" onClick={() => removeBinding(index)}>Remove</button>
                </div>
                {!binding.dataSourceId && (
                  <div className="modal-field">
                    <select value="" onChange={e => updateBindingDataSource(index, e.target.value)}>
                      <option value="" disabled>Select a data source...</option>
                      {activeSources.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.displayName}</option>
                      ))}
                    </select>
                  </div>
                )}
                {entityFields.map(f => {
                  const fieldKey = `${index}-${f.key}`;
                  return (
                    <div className="modal-field" key={f.key}>
                      <label>{f.label}</label>
                      {f.sensitive ? (
                        <div className="password-field-wrapper">
                          <input
                            type={visibleFields.has(fieldKey) ? "text" : "password"}
                            value={binding.sourceConfig[f.key] || ""}
                            onChange={e => updateBindingSourceConfig(index, f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => toggleFieldVisibility(fieldKey)}
                            tabIndex={-1}
                            aria-label={visibleFields.has(fieldKey) ? "Hide value" : "Show value"}
                          >
                            {visibleFields.has(fieldKey) ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={binding.sourceConfig[f.key] || ""}
                          onChange={e => updateBindingSourceConfig(index, f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || (bindings.length > 0 && !allBindingsValid)}>
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
  const [bindings, setBindings] = useState<BindingState[]>(() => {
    const existing = getEntityBindings(entity);
    return existing.map(b => ({ dataSourceId: b.dataSourceId, sourceConfig: { ...b.sourceConfig } }));
  });
  const [accountCategories, setAccountCategories] = useState<AccountCategory[]>(
    entity.accountCategories || []
  );
  const [availableAccounts, setAvailableAccounts] = useState<{ income: string[]; cogs: string[] } | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const activeSources = dataSources.filter(ds => ds.status === 'active');

  // Load Income + COGS account names from CData for this entity
  useEffect(() => {
    const hasDataSource = entity.dataSourceId || (entity.dataSourceBindings && entity.dataSourceBindings.length > 0);
    if (!hasDataSource) return;
    setLoadingAccounts(true);
    fetch(`/api/entities/${encodeURIComponent(entity.id)}/accounts`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error || 'Failed to load accounts'))))
      .then(data => setAvailableAccounts(data))
      .catch(err => setAccountsError(err.message))
      .finally(() => setLoadingAccounts(false));
  }, [entity.id]);

  const addCategory = () => {
    setAccountCategories(prev => [...prev, { name: '', revenueAccounts: [], cogsAccounts: [] }]);
  };

  const removeCategory = (idx: number) => {
    setAccountCategories(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCategoryName = (idx: number, name: string) => {
    setAccountCategories(prev => prev.map((c, i) => i === idx ? { ...c, name } : c));
  };

  const toggleAccount = (idx: number, type: 'revenue' | 'cogs', acct: string, checked: boolean) => {
    setAccountCategories(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const field = type === 'revenue' ? 'revenueAccounts' : 'cogsAccounts';
      const current = c[field];
      return {
        ...c,
        [field]: checked ? [...current, acct] : current.filter(a => a !== acct),
      };
    }));
  };

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addBinding = () => {
    setBindings(prev => [...prev, { dataSourceId: '', sourceConfig: {} }]);
  };

  const removeBinding = (index: number) => {
    setBindings(prev => prev.filter((_, i) => i !== index));
  };

  const updateBindingDataSource = (index: number, dsId: string) => {
    setBindings(prev => prev.map((b, i) =>
      i === index ? { dataSourceId: dsId, sourceConfig: {} } : b
    ));
  };

  const updateBindingSourceConfig = (index: number, key: string, value: string) => {
    setBindings(prev => prev.map((b, i) =>
      i === index ? { ...b, sourceConfig: { ...b.sourceConfig, [key]: value } } : b
    ));
  };

  const allBindingsValid = bindings.every(b => {
    if (!b.dataSourceId) return false;
    const ds = activeSources.find(d => d.id === b.dataSourceId);
    if (!ds) return false;
    const ef = DATA_SOURCE_TYPES[ds.type]?.entityFields || [];
    return ef.every(f => (b.sourceConfig[f.key] || '').trim());
  });

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const dataSourceBindings = bindings
        .filter(b => b.dataSourceId)
        .map(b => ({ dataSourceId: b.dataSourceId, sourceConfig: b.sourceConfig }));

      const res = await fetch(`/api/entities/${encodeURIComponent(entity.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, dataSourceBindings, accountCategories }),
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
        <div className="modal-separator" />
        <div className="bindings-header">
          <label>Data Sources</label>
          {activeSources.length > 0 && (
            <button type="button" className="add-binding-btn" onClick={addBinding}>+ Add Data Source</button>
          )}
        </div>
        {activeSources.length === 0 ? (
          <div className="modal-hint">Please define a Data Source first.</div>
        ) : bindings.length === 0 ? (
          <div className="modal-hint">No data sources added. Click &quot;+ Add Data Source&quot; above.</div>
        ) : (
          bindings.map((binding, index) => {
            const ds = activeSources.find(d => d.id === binding.dataSourceId);
            const dsType = ds?.type;
            const entityFields = dsType ? (DATA_SOURCE_TYPES[dsType]?.entityFields || []) : [];
            return (
              <div key={index} className="binding-section">
                <div className="binding-header">
                  <span className="binding-ds-name">{ds ? ds.displayName : 'Select a data source'}</span>
                  <button type="button" className="remove-binding-btn" onClick={() => removeBinding(index)}>Remove</button>
                </div>
                {!binding.dataSourceId && (
                  <div className="modal-field">
                    <select value="" onChange={e => updateBindingDataSource(index, e.target.value)}>
                      <option value="" disabled>Select a data source...</option>
                      {activeSources.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.displayName}</option>
                      ))}
                    </select>
                  </div>
                )}
                {entityFields.map(f => {
                  const fieldKey = `${index}-${f.key}`;
                  return (
                    <div className="modal-field" key={f.key}>
                      <label>{f.label}</label>
                      {f.sensitive ? (
                        <div className="password-field-wrapper">
                          <input
                            type={visibleFields.has(fieldKey) ? "text" : "password"}
                            value={binding.sourceConfig[f.key] || ""}
                            onChange={e => updateBindingSourceConfig(index, f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => toggleFieldVisibility(fieldKey)}
                            tabIndex={-1}
                            aria-label={visibleFields.has(fieldKey) ? "Hide value" : "Show value"}
                          >
                            {visibleFields.has(fieldKey) ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={binding.sourceConfig[f.key] || ""}
                          onChange={e => updateBindingSourceConfig(index, f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        {/* Account Categories */}
        <div className="modal-separator" />
        <div className="account-categories-header">
          <label>Account Categories</label>
          <button type="button" className="add-binding-btn" onClick={addCategory}>+ Add Category</button>
        </div>
        {loadingAccounts && <div className="account-categories-loading">Loading accounts from data source...</div>}
        {accountsError && <div className="modal-error">{accountsError}</div>}
        {!loadingAccounts && !availableAccounts && !accountsError && (
          <div className="modal-hint">Configure a data source above to enable account selection.</div>
        )}
        {accountCategories.map((cat, idx) => (
          <div key={idx} className="account-category-section">
            <div className="account-category-header">
              <input
                type="text"
                className="category-name-input"
                value={cat.name}
                onChange={e => updateCategoryName(idx, e.target.value)}
                placeholder="Category name (e.g. Food, Alcoholic Beverages)"
              />
              <button type="button" className="remove-binding-btn" onClick={() => removeCategory(idx)}>Remove</button>
            </div>
            {availableAccounts ? (
              <>
                <div className="account-checklist-label">Revenue Accounts</div>
                <div className="account-checklist">
                  {availableAccounts.income.length === 0
                    ? <span style={{ fontSize: 12, color: '#6a6b78' }}>No income accounts found.</span>
                    : availableAccounts.income.map(acct => (
                      <label key={acct} className="account-check-option">
                        <input
                          type="checkbox"
                          checked={cat.revenueAccounts.includes(acct)}
                          onChange={e => toggleAccount(idx, 'revenue', acct, e.target.checked)}
                        />
                        {acct}
                      </label>
                    ))
                  }
                </div>
                <div className="account-checklist-label">Cost of Goods Sold Accounts</div>
                <div className="account-checklist">
                  {availableAccounts.cogs.length === 0
                    ? <span style={{ fontSize: 12, color: '#6a6b78' }}>No COGS accounts found.</span>
                    : availableAccounts.cogs.map(acct => (
                      <label key={acct} className="account-check-option">
                        <input
                          type="checkbox"
                          checked={cat.cogsAccounts.includes(acct)}
                          onChange={e => toggleAccount(idx, 'cogs', acct, e.target.checked)}
                        />
                        {acct}
                      </label>
                    ))
                  }
                </div>
              </>
            ) : (
              <div className="modal-hint">Accounts will appear here once the data source is loaded.</div>
            )}
          </div>
        ))}

        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving || !displayName.trim() || (bindings.length > 0 && !allBindingsValid)}>
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
          <label>Name</label>
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
          <label>Name</label>
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
          <label>Name</label>
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
          <label>Name</label>
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
  entities,
  onClose,
  onSaved,
}: {
  dashboard: Dashboard;
  existingWidgetTypeIds: string[];
  entities: EntityConfig[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [widgetTypes, setWidgetTypes] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categoryNameInput, setCategoryNameInput] = useState("");

  // Collect unique account category names from all entities
  const availableCategories = Array.from(
    new Set(entities.flatMap(e => (e.accountCategories || []).map(c => c.name)))
  ).sort();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/widget-types`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already-mapped widget types (category-pl-detail can appear multiple times)
          const available = data.widgetTypes.filter(
            (wt: any) => wt.id === 'category-pl-detail' || !existingWidgetTypeIds.includes(wt.id)
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
            ...(selectedIds[i] === 'category-pl-detail' && categoryNameInput.trim()
              ? { config: { categoryName: categoryNameInput.trim() } }
              : {}),
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
        {selectedIds.includes('category-pl-detail') && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#c0c4d0', marginBottom: 4 }}>
              Account Category (for Category P&L Detail widget)
            </label>
            {availableCategories.length > 0 ? (
              <select
                value={categoryNameInput}
                onChange={e => setCategoryNameInput(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: '#13141f', border: '1px solid #2a2b3d', borderRadius: 4, color: categoryNameInput ? '#e1e2ee' : '#6b7280', fontSize: 13 }}
              >
                <option value="">— Select a category —</option>
                {availableCategories.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={categoryNameInput}
                onChange={e => setCategoryNameInput(e.target.value)}
                placeholder="e.g. Food, Beverages (no categories configured on entities)"
                style={{ width: '100%', padding: '6px 10px', background: '#13141f', border: '1px solid #2a2b3d', borderRadius: 4, color: '#e1e2ee', fontSize: 13 }}
              />
            )}
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
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (sendInvite: boolean) => {
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
          authorizedPackageIds: [],
          authorizedDashboardIds: [],
          sendInvite,
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
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-save-btn modal-save-secondary"
            onClick={() => handleSave(false)}
            disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
          >
            {saving ? "Creating..." : "Create"}
          </button>
          <button
            className="modal-save-btn"
            onClick={() => handleSave(true)}
            disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
          >
            {saving ? "Creating..." : "Create & Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Client User Modal ─── */

export function EditClientUserModal({
  clientUser,
  onClose,
  onSaved,
}: {
  clientUser: ClientUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(clientUser.firstName);
  const [lastName, setLastName] = useState(clientUser.lastName);
  const [email, setEmail] = useState(clientUser.email);
  const [status, setStatus] = useState(clientUser.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emailChanged = email.trim().toLowerCase() !== clientUser.email.toLowerCase();

  const handleSave = async (sendInvite?: boolean) => {
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
          ...(emailChanged && { email: email.trim(), sendInvite: !!sendInvite }),
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
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select className="status-select" value={status} onChange={e => setStatus(e.target.value as 'active' | 'archived')}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          {emailChanged ? (
            <>
              <button
                className="modal-save-btn modal-save-secondary"
                onClick={() => handleSave(false)}
                disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="modal-save-btn"
                onClick={() => handleSave(true)}
                disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
              >
                {saving ? "Saving..." : "Save & Invite"}
              </button>
            </>
          ) : (
            <button
              className="modal-save-btn"
              onClick={() => handleSave()}
              disabled={saving || !firstName.trim() || !lastName.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Manage Access Modal ─── */

export function ManageAccessModal({
  clientUser,
  packages,
  dashboardsByPackage,
  entities,
  onClose,
  onSaved,
}: {
  clientUser: ClientUser;
  packages: Package[];
  dashboardsByPackage: Record<string, Dashboard[]>;
  entities: EntityConfig[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(
    clientUser.authorizedEntityIds || []
  );
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(
    clientUser.authorizedPackageIds || []
  );
  const [selectedDashboardIds, setSelectedDashboardIds] = useState<string[]>(
    clientUser.authorizedDashboardIds || []
  );
  const [defaultDashboardId, setDefaultDashboardId] = useState(
    clientUser.defaultDashboardId || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Compute all accessible dashboards (from selected packages + individually selected)
  const accessibleDashboards = packages.flatMap(pkg => {
    const pkgDashboards = dashboardsByPackage[pkg.id] || [];
    if (selectedPackageIds.includes(pkg.id)) return pkgDashboards;
    return pkgDashboards.filter(d => selectedDashboardIds.includes(d.id));
  });

  const toggleEntity = (entityId: string) => {
    setSelectedEntityIds(prev =>
      prev.includes(entityId)
        ? prev.filter(id => id !== entityId)
        : [...prev, entityId]
    );
  };

  const togglePackage = (pkgId: string) => {
    setSelectedPackageIds(prev => {
      if (prev.includes(pkgId)) {
        // When unchecking a package, clear default if it belonged to this package
        const pkgDashIds = (dashboardsByPackage[pkgId] || []).map(d => d.id);
        if (pkgDashIds.includes(defaultDashboardId)) {
          setDefaultDashboardId("");
        }
        return prev.filter(id => id !== pkgId);
      } else {
        // When checking a package, remove its individual dashboard IDs (now redundant)
        const pkgDashIds = (dashboardsByPackage[pkgId] || []).map(d => d.id);
        setSelectedDashboardIds(dIds => dIds.filter(id => !pkgDashIds.includes(id)));
        return [...prev, pkgId];
      }
    });
  };

  const toggleDashboard = (dashId: string) => {
    setSelectedDashboardIds(prev => {
      if (prev.includes(dashId)) {
        // Clear default if this dashboard was the default
        if (dashId === defaultDashboardId) setDefaultDashboardId("");
        return prev.filter(id => id !== dashId);
      }
      return [...prev, dashId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Clean: remove dashboard IDs that belong to checked packages (redundant)
      const allDashboards = Object.values(dashboardsByPackage).flat();
      const cleanedDashboardIds = selectedDashboardIds.filter(dId => {
        const dash = allDashboards.find(d => d.id === dId);
        return dash && !selectedPackageIds.includes(dash.packageId);
      });

      const res = await fetch(`/api/client-users/${encodeURIComponent(clientUser.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizedEntityIds: selectedEntityIds,
          authorizedPackageIds: selectedPackageIds,
          authorizedDashboardIds: cleanedDashboardIds,
          defaultDashboardId: defaultDashboardId || "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update access");
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
      <div className="modal-content" style={{ width: 520 }}>
        <h2>Manage Access &mdash; {clientUser.firstName} {clientUser.lastName}</h2>
        {entities.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#c5c7d0", marginBottom: 8 }}>Entities</h3>
            <div className="access-tree" style={{ marginBottom: 16 }}>
              {entities.map(e => (
                <label key={e.id} className="access-tree-package-label">
                  <input
                    type="checkbox"
                    checked={selectedEntityIds.includes(e.id)}
                    onChange={() => toggleEntity(e.id)}
                  />
                  <span>{e.displayName}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#c5c7d0", marginBottom: 8 }}>Reports</h3>
        {packages.length === 0 ? (
          <div className="entities-empty-sub">No packages configured for this client.</div>
        ) : (
          <div className="access-tree">
            {packages.map(pkg => {
              const pkgChecked = selectedPackageIds.includes(pkg.id);
              const pkgDashboards = dashboardsByPackage[pkg.id] || [];
              return (
                <div key={pkg.id} className="access-tree-package">
                  <label className="access-tree-package-label">
                    <input
                      type="checkbox"
                      checked={pkgChecked}
                      onChange={() => togglePackage(pkg.id)}
                    />
                    <span>{pkg.displayName}</span>
                    {pkgChecked && <span className="access-tree-hint">(all dashboards)</span>}
                  </label>
                  {pkgDashboards.length > 0 && (
                    <div className="access-tree-dashboards">
                      {pkgDashboards.map(d => {
                        const dashChecked = pkgChecked || selectedDashboardIds.includes(d.id);
                        return (
                          <label key={d.id} className="access-tree-dashboard-label">
                            <input
                              type="checkbox"
                              checked={dashChecked}
                              disabled={pkgChecked}
                              onChange={() => toggleDashboard(d.id)}
                            />
                            <span>{d.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {accessibleDashboards.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 500, fontSize: 14, color: "#c5c7d0" }}>
              Default Dashboard
              <select
                value={defaultDashboardId}
                onChange={(e) => setDefaultDashboardId(e.target.value)}
                className="modal-input"
                style={{ marginTop: 6 }}
              >
                <option value="">First available</option>
                {accessibleDashboards.map(d => {
                  const pkg = packages.find(p => p.id === d.packageId);
                  return (
                    <option key={d.id} value={d.id}>
                      {pkg ? `${pkg.displayName} / ${d.displayName}` : d.displayName}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        )}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
