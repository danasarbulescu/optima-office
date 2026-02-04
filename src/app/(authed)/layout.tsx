"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { CompanyProvider, useCompany } from "@/context/CompanyContext";
import { COMPANIES, COMBINED_ID, COMBINED_DISPLAY_NAME } from "@/lib/companies";

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();
  const { selectedCompany, setSelectedCompany } = useCompany();

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  if (authStatus === "configuring") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#666" }}>Loading...</div>
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
        </nav>
        <div className="app-controls">
          <select
            className="company-selector"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            {COMPANIES.map(c => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
            <option value={COMBINED_ID}>{COMBINED_DISPLAY_NAME}</option>
          </select>
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
