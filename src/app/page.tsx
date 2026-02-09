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
      // Fetch auth context to get clientId, then find the first package/dashboard
      (async () => {
        try {
          const authRes = await fetch("/api/auth/context");
          if (!authRes.ok) {
            router.replace("/clients");
            return;
          }
          const authData = await authRes.json();
          const clientId = authData.isInternal ? "*" : authData.clientId;

          const pkgRes = await fetch(`/api/packages?clientId=${clientId}`, {
            headers: { "x-client-id": clientId },
          });
          if (pkgRes.ok) {
            const { packages } = await pkgRes.json();
            if (packages.length > 0) {
              const dashRes = await fetch(`/api/dashboards?clientId=${clientId}`, {
                headers: { "x-client-id": clientId },
              });
              if (dashRes.ok) {
                const { dashboards } = await dashRes.json();
                const firstPkg = packages[0];
                const firstDash = dashboards
                  .filter((d: any) => d.packageId === firstPkg.id)
                  .sort((a: any, b: any) => a.sortOrder - b.sortOrder)[0];
                if (firstDash) {
                  router.replace(`/${firstPkg.slug}/${firstDash.slug}`);
                  return;
                }
              }
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
