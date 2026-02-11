"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Client } from "@/lib/types";
import { useEntity } from "@/context/EntityContext";
import { useClient } from "@/context/ClientContext";
import "./clients.css";

type ClientSortColumn = "displayName" | "slug";
type SortDirection = "asc" | "desc";

export default function ClientsPage() {
  const router = useRouter();
  const { refreshEntities } = useEntity();
  const { clients: bootstrapClients, clientLoading } = useClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<ClientSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchData = useCallback(async () => {
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

  // Initialize from bootstrap data (no /api/clients call on mount)
  useEffect(() => {
    if (!clientLoading) {
      setClients(bootstrapClients);
      setLoading(false);
    }
  }, [clientLoading, bootstrapClients]);

  const activeClients = useMemo(
    () => clients.filter((c) => (c.status || "active") === "active"),
    [clients]
  );
  const archivedClients = useMemo(
    () => clients.filter((c) => c.status === "archived"),
    [clients]
  );

  const handleSort = (column: ClientSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleRemoveClient = async (c: Client) => {
    if (!confirm(`Are you sure you want to delete "${c.displayName}"? That will also delete client's packages, dashboards and their data. Widget will not be affected.`)) return;
    setError("");
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete client "${c.displayName}"`);
      await fetchData();
      refreshEntities();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm("Are you sure you want to delete all Clients? That will also delete client's packages, dashboards and their data. Widget will not be affected.")) return;
    setRemoving(true);
    setError("");
    try {
      for (const c of clients) {
        const res = await fetch(`/api/clients/${encodeURIComponent(c.id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete client "${c.displayName}"`);
      }
      await fetchData();
      refreshEntities();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const sortedClients = useMemo(() => {
    if (!sortColumn) return activeClients;
    const sorted = [...activeClients].sort((a, b) => {
      const aVal = (a[sortColumn] ?? "").toString().toLowerCase();
      const bVal = (b[sortColumn] ?? "").toString().toLowerCase();
      return aVal.localeCompare(bVal);
    });
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [activeClients, sortColumn, sortDirection]);

  const sortIndicator = (column: ClientSortColumn) => {
    if (sortColumn !== column)
      return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  if (loading) return <div className="app-loading">Loading clients...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="clients-page">
      <div className="clients-header">
        <h1>Clients</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {clients.length > 0 && (
            <button className="delete-btn" onClick={handleRemoveAll} disabled={removing}>
              {removing ? "Removing..." : "Remove All"}
            </button>
          )}
          {archivedClients.length > 0 && (
            <button className="archived-btn" onClick={() => setShowArchivedModal(true)}>
              Archived ({archivedClients.length})
            </button>
          )}
          <button className="add-client-btn" onClick={() => setShowAddClientModal(true)}>
            New Client
          </button>
        </div>
      </div>

      {activeClients.length === 0 ? (
        <div className="clients-empty">No clients configured. Add one to get started.</div>
      ) : (
        <div className="clients-table-wrapper">
          <table className="clients-table">
            <thead>
              <tr>
                <th>ID</th>
                <th className="sortable-th" onClick={() => handleSort("displayName")}>
                  Name {sortIndicator("displayName")}
                </th>
                <th className="sortable-th" onClick={() => handleSort("slug")}>
                  Slug {sortIndicator("slug")}
                </th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((c) => {
                const contactName = [c.firstName, c.lastName].filter(Boolean).join(" ");
                return (
                  <tr
                    key={c.id}
                    className="client-row"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <td><code className="slug-badge">{c.id.slice(0, 6)}</code></td>
                    <td>{c.displayName}</td>
                    <td><code className="slug-badge">{c.slug}</code></td>
                    <td>{contactName || <span className="text-muted">—</span>}</td>
                    <td><span className="status-badge status-active">Active</span></td>
                    <td>
                      <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c); }}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddClientModal && (
        <AddClientModal
          onClose={() => setShowAddClientModal(false)}
          onSaved={() => { setShowAddClientModal(false); fetchData(); refreshEntities(); }}
        />
      )}
      {showArchivedModal && (
        <ArchivedClientsModal
          clients={archivedClients}
          onActivate={async (id) => {
            await fetch(`/api/clients/${encodeURIComponent(id)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "active" }),
            });
            await fetchData();
            refreshEntities();
          }}
          onClose={() => setShowArchivedModal(false)}
        />
      )}
    </div>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9-]*$/.test(slug);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { slug, displayName };
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
          <label>Name</label>
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

/* ─── Archived Clients Modal ─── */

function ArchivedClientsModal({
  clients,
  onActivate,
  onClose,
}: {
  clients: Client[];
  onActivate: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [activating, setActivating] = useState<string | null>(null);

  const handleActivate = async (id: string) => {
    setActivating(id);
    await onActivate(id);
    setActivating(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Archived Clients</h2>
        {clients.length === 0 ? (
          <div className="entities-empty-sub">No archived clients.</div>
        ) : (
          <div className="archived-modal-list">
            {clients.map((c) => (
              <div key={c.id} className="archived-modal-item">
                <span>{c.displayName}</span>
                <button
                  className="activate-btn"
                  onClick={() => handleActivate(c.id)}
                  disabled={activating === c.id}
                >
                  {activating === c.id ? "Activating..." : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
