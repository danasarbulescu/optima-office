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
