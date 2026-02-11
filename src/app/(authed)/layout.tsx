"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EntityProvider } from "@/context/EntityContext";
import { ClientProvider, useClient } from "@/context/ClientContext";
import { PackageProvider, usePackages } from "@/context/PackageContext";
import { BootstrapProvider } from "@/context/BootstrapContext";

function PackageNav() {
  const { packages, dashboardsByPackage, packagesLoading } = usePackages();
  const [openPkg, setOpenPkg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenPkg(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (packagesLoading || packages.length === 0) return null;

  return (
    <div className="package-nav" ref={dropdownRef}>
      {packages.map(pkg => {
        const dashboards = dashboardsByPackage[pkg.id] || [];
        if (dashboards.length === 1) {
          return (
            <Link
              key={pkg.id}
              href={`/${pkg.slug}/${dashboards[0].slug}`}
              className="nav-link"
              onClick={() => setOpenPkg(null)}
            >
              {pkg.displayName}
            </Link>
          );
        }
        return (
          <div key={pkg.id} className="package-dropdown">
            <button
              className="nav-link package-trigger"
              onClick={() => setOpenPkg(openPkg === pkg.id ? null : pkg.id)}
            >
              {pkg.displayName} ▾
            </button>
            {openPkg === pkg.id && (
              <div className="package-dropdown-menu">
                {dashboards.map(d => (
                  <Link
                    key={d.id}
                    href={`/${pkg.slug}/${d.slug}`}
                    className="package-dropdown-item"
                    onClick={() => setOpenPkg(null)}
                  >
                    {d.displayName}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { authStatus, signOut, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const router = useRouter();
  const { isInternal, isImpersonating, impersonatingClientUser, stopImpersonatingUser } = useClient();

  const handleStopUserImpersonation = () => {
    if (!confirm("You are about to switch back to your Admin view.")) return;
    stopImpersonatingUser();
    router.push("/clients");
  };

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
      <header className={`app-header${impersonatingClientUser ? ' app-header-impersonating-user' : ''}`}>
        <span className="app-user">
          {user?.signInDetails?.loginId}
          {impersonatingClientUser && <> as <strong>{impersonatingClientUser.firstName} {impersonatingClientUser.lastName}</strong></>}
        </span>
        <nav className="app-nav">
          <PackageNav />
          {isInternal && !isImpersonating && (
            <>
              <Link href="/clients" className="nav-link">Clients</Link>
              <Link href="/data-sources" className="nav-link">Data Sources</Link>
              <Link href="/widgets" className="nav-link">Widgets</Link>
              <Link href="/tools" className="nav-link">Tools</Link>
            </>
          )}
        </nav>
        <div className="app-controls">
          {impersonatingClientUser ? (
            <button onClick={handleStopUserImpersonation} className="admin-view-btn">
              Admin View
            </button>
          ) : (
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Authenticator.Provider>
      <BootstrapProvider>
        <ClientProvider>
          <PackageProvider>
            <EntityProvider>
              <AuthedLayoutContent>{children}</AuthedLayoutContent>
            </EntityProvider>
          </PackageProvider>
        </ClientProvider>
      </BootstrapProvider>
    </Authenticator.Provider>
  );
}
