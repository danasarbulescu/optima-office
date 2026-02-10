"use client";

import { useAuthenticator, Authenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function HomeContent() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated" && !resolving) {
      setResolving(true);
      // Single bootstrap call for auth + packages + dashboards
      (async () => {
        try {
          const res = await fetch("/api/bootstrap");
          if (!res.ok) {
            router.replace("/clients");
            return;
          }
          const data = await res.json();

          if (data.packages?.length > 0 && data.dashboards?.length > 0) {
            // Check for a configured default dashboard
            const defaultId = data.auth?.defaultDashboardId;
            if (defaultId) {
              const defaultDash = data.dashboards.find((d: any) => d.id === defaultId);
              if (defaultDash) {
                const defaultPkg = data.packages.find((p: any) => p.id === defaultDash.packageId);
                if (defaultPkg) {
                  router.replace(`/${defaultPkg.slug}/${defaultDash.slug}`);
                  return;
                }
              }
            }

            // Fallback: first package's first dashboard
            const firstPkg = data.packages[0];
            const firstDash = data.dashboards
              .filter((d: any) => d.packageId === firstPkg.id)
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder)[0];
            if (firstDash) {
              router.replace(`/${firstPkg.slug}/${firstDash.slug}`);
              return;
            }
          }
          // Fallback: no packages configured yet
          router.replace("/clients");
        } catch {
          router.replace("/clients");
        }
      })();
    } else if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router, resolving]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#666" }}>Loading...</div>
    </div>
  );
}

export default function Home() {
  return (
    <Authenticator.Provider>
      <HomeContent />
    </Authenticator.Provider>
  );
}
