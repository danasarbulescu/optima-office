"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClient } from "@/context/ClientContext";
import type { Dashboard } from "@/lib/types";

export default function PackagePage() {
  const { packageSlug } = useParams<{ packageSlug: string }>();
  const { currentClientId } = useClient();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!packageSlug || !currentClientId) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/dashboards?clientId=${currentClientId}`,
          { headers: { "x-client-id": currentClientId } }
        );
        if (!res.ok) {
          setChecked(true);
          return;
        }
        const { dashboards } = await res.json() as { dashboards: Dashboard[] };

        // Find dashboards in this package by resolving package slug
        const pkgRes = await fetch(
          `/api/packages?clientId=${currentClientId}`,
          { headers: { "x-client-id": currentClientId } }
        );
        if (!pkgRes.ok) {
          setChecked(true);
          return;
        }
        const { packages } = await pkgRes.json();
        const pkg = packages.find((p: any) => p.slug === packageSlug);
        if (!pkg) {
          setChecked(true);
          return;
        }

        const pkgDashboards = dashboards
          .filter((d: Dashboard) => d.packageId === pkg.id)
          .sort((a: Dashboard, b: Dashboard) => a.sortOrder - b.sortOrder);

        if (pkgDashboards.length > 0) {
          router.replace(`/${packageSlug}/${pkgDashboards[0].slug}`);
        } else {
          setChecked(true);
        }
      } catch {
        setChecked(true);
      }
    })();
  }, [packageSlug, currentClientId, router]);

  if (!checked) {
    return <div className="app-loading">Loading...</div>;
  }

  return <div className="app-empty">No dashboards found in this package.</div>;
}
