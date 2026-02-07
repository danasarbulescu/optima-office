"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CompanyProvider, useCompany } from "@/context/CompanyContext";

function MultiSelectDropdown() {
  const { clients, clientsLoading, selectedCompanies, setSelectedCompanies } = useCompany();
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

  const toggleCompany = (id: string) => {
    setSelectedCompanies(
      selectedCompanies.includes(id)
        ? selectedCompanies.filter((c) => c !== id)
        : [...selectedCompanies, id]
    );
  };

  const selectAll = () => setSelectedCompanies(clients.map((c) => c.id));
  const deselectAll = () => setSelectedCompanies([]);

  if (clientsLoading) return <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading...</span>;
  if (clients.length === 0) return null;

  const allSelected = selectedCompanies.length === clients.length;
  const label =
    selectedCompanies.length === 0
      ? "No clients"
      : selectedCompanies.length === 1
        ? clients.find((c) => c.id === selectedCompanies[0])?.displayName ?? selectedCompanies[0]
        : allSelected
          ? "All clients"
          : `${selectedCompanies.length} clients`;

  return (
    <div className="multi-select" ref={ref}>
      <button className="multi-select-trigger" onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="multi-select-dropdown">
          <div className="multi-select-actions">
            <button onClick={selectAll} disabled={allSelected}>Select All</button>
            <button onClick={deselectAll} disabled={selectedCompanies.length === 0}>Deselect All</button>
          </div>
          {clients.map((c) => (
            <label key={c.id} className="multi-select-option">
              <input
                type="checkbox"
                checked={selectedCompanies.includes(c.id)}
                onChange={() => toggleCompany(c.id)}
              />
              {c.displayName}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();

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
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/trend-analysis" className="nav-link">Trend Analysis</Link>
          <Link href="/clients" className="nav-link">Clients</Link>
          <Link href="/tools" className="nav-link">Tools</Link>
        </nav>
        <div className="app-controls">
          <MultiSelectDropdown />
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Authenticator.Provider>
      <CompanyProvider>
        <AuthedLayoutContent>{children}</AuthedLayoutContent>
      </CompanyProvider>
    </Authenticator.Provider>
  );
}
