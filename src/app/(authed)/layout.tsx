"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EntityProvider, useEntity } from "@/context/EntityContext";
import { ClientProvider, useClient } from "@/context/ClientContext";
import { getAllModuleManifests } from "@/modules/registry";

function MultiSelectDropdown() {
  const { entities, entitiesLoading, selectedEntities, setSelectedEntities } = useEntity();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleEntity = (id: string) => {
    setSelectedEntities(
      selectedEntities.includes(id)
        ? selectedEntities.filter((e) => e !== id)
        : [...selectedEntities, id]
    );
  };

  const selectAll = () => setSelectedEntities(entities.map((e) => e.id));
  const deselectAll = () => setSelectedEntities([]);

  if (entitiesLoading) return <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>;
  if (entities.length === 0) return null;

  const allSelected = selectedEntities.length === entities.length;
  const label =
    selectedEntities.length === 0
      ? "No entities"
      : selectedEntities.length === 1
        ? entities.find((e) => e.id === selectedEntities[0])?.displayName ?? selectedEntities[0]
        : allSelected
          ? "All entities"
          : `${selectedEntities.length} entities`;

  return (
    <div className="multi-select" ref={ref}>
      <button className="multi-select-trigger" onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="multi-select-dropdown">
          <div className="multi-select-actions">
            <button onClick={selectAll} disabled={allSelected}>Select All</button>
            <button onClick={deselectAll} disabled={selectedEntities.length === 0}>Deselect All</button>
          </div>
          {entities.map((e) => (
            <label key={e.id} className="multi-select-option">
              <input
                type="checkbox"
                checked={selectedEntities.includes(e.id)}
                onChange={() => toggleEntity(e.id)}
              />
              {e.displayName}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientSwitcher() {
  const { clients, currentClientId, setCurrentClientId, isInternal, clientLoading, isImpersonating } = useClient();

  if (clientLoading || !isInternal || isImpersonating) return null;

  return (
    <select
      className="client-switcher"
      value={currentClientId || ''}
      onChange={(e) => setCurrentClientId(e.target.value)}
    >
      <option value="*">All Clients</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.displayName}</option>
      ))}
    </select>
  );
}

function ModuleNav() {
  const { enabledModules } = useClient();
  const moduleNavItems = getAllModuleManifests().filter(m => enabledModules.includes(m.id));

  return (
    <>
      {moduleNavItems.map(m => (
        <Link key={m.id} href={`/${m.route}`} className="nav-link">{m.navLabel}</Link>
      ))}
    </>
  );
}

function ViewAsClientButton() {
  const { isInternal, currentClientId, isImpersonating, startImpersonating } = useClient();

  if (!isInternal || currentClientId === '*' || isImpersonating) return null;

  return (
    <button onClick={startImpersonating} className="view-as-client-btn">
      View as Client
    </button>
  );
}

function ImpersonationBanner() {
  const { isImpersonating, currentClient, stopImpersonating } = useClient();

  if (!isImpersonating) return null;

  return (
    <div className="impersonation-banner">
      <span>Viewing as <strong>{currentClient?.displayName || 'Client'}</strong></span>
      <button onClick={stopImpersonating}>Exit</button>
    </div>
  );
}

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();
  const { isInternal, isImpersonating } = useClient();

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  if (authStatus === "configuring") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
        <div style={{ color: "#9a9caa" }}>Loading...</div>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-user">{user?.signInDetails?.loginId}</span>
        <nav className="app-nav">
          <ModuleNav />
          {isInternal && !isImpersonating && (
            <>
              <Link href="/clients" className="nav-link">Clients</Link>
              <Link href="/tools" className="nav-link">Tools</Link>
            </>
          )}
        </nav>
        <div className="app-controls">
          <ClientSwitcher />
          <ViewAsClientButton />
          <MultiSelectDropdown />
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>
      <ImpersonationBanner />
      <main>{children}</main>
    </div>
  );
}

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Authenticator.Provider>
      <ClientProvider>
        <EntityProvider>
          <AuthedLayoutContent>{children}</AuthedLayoutContent>
        </EntityProvider>
      </ClientProvider>
    </Authenticator.Provider>
  );
}
