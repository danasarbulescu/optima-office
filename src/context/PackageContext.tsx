"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useClient } from './ClientContext';
import { useBootstrap } from './BootstrapContext';
import type { Package, Dashboard, DashboardWidget } from '@/lib/types';

interface PackageContextValue {
  packages: Package[];
  dashboardsByPackage: Record<string, Dashboard[]>;
  widgetsByDashboard: Record<string, DashboardWidget[]>;
  packagesLoading: boolean;
  refreshPackages: () => void;
}

const PackageContext = createContext<PackageContextValue | undefined>(undefined);

function filterPackagesAndDashboards(
  rawPackages: Package[],
  rawDashboards: Dashboard[],
  authorizedPackageIds: string[] | null,
  authorizedDashboardIds: string[] | null,
): { packages: Package[]; dashboardsByPackage: Record<string, Dashboard[]> } {
  // Process dashboards first so we can determine which packages have visible dashboards
  const grouped: Record<string, Dashboard[]> = {};
  for (const d of rawDashboards) {
    if (authorizedPackageIds) {
      const hasPackageAccess = authorizedPackageIds.includes(d.packageId);
      const hasDashboardAccess = (authorizedDashboardIds || []).includes(d.id);
      if (!hasPackageAccess && !hasDashboardAccess) continue;
    }
    if (!grouped[d.packageId]) grouped[d.packageId] = [];
    grouped[d.packageId].push(d);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Filter packages: visible if authorized at package level OR has any visible dashboards
  const filtered = authorizedPackageIds
    ? rawPackages.filter(p =>
        authorizedPackageIds.includes(p.id) || (grouped[p.id]?.length > 0)
      )
    : rawPackages;

  return { packages: filtered, dashboardsByPackage: grouped };
}

export function PackageProvider({ children }: { children: ReactNode }) {
  const { authorizedPackageIds, authorizedDashboardIds } = useClient();
  const bootstrap = useBootstrap();
  const [packages, setPackages] = useState<Package[]>([]);
  const [dashboardsByPackage, setDashboardsByPackage] = useState<Record<string, Dashboard[]>>({});
  const [widgetsByDashboard, setWidgetsByDashboard] = useState<Record<string, DashboardWidget[]>>({});

  // Process bootstrap data with authorization filtering
  useEffect(() => {
    if (bootstrap.loading) return;

    const result = filterPackagesAndDashboards(
      bootstrap.packages,
      bootstrap.dashboards,
      authorizedPackageIds,
      authorizedDashboardIds,
    );
    setPackages(result.packages);
    setDashboardsByPackage(result.dashboardsByPackage);

    // Filter widgets to only include visible dashboards
    const visibleDashboardIds = new Set(
      Object.values(result.dashboardsByPackage).flat().map(d => d.id)
    );
    const filtered: Record<string, DashboardWidget[]> = {};
    for (const [dashId, widgets] of Object.entries(bootstrap.widgetsByDashboard)) {
      if (visibleDashboardIds.has(dashId)) {
        filtered[dashId] = widgets;
      }
    }
    setWidgetsByDashboard(filtered);
  }, [bootstrap.loading, bootstrap.packages, bootstrap.dashboards, bootstrap.widgetsByDashboard, authorizedPackageIds, authorizedDashboardIds]);

  return (
    <PackageContext.Provider
      value={{
        packages,
        dashboardsByPackage,
        widgetsByDashboard,
        packagesLoading: bootstrap.loading,
        refreshPackages: () => bootstrap.refetch(),
      }}
    >
      {children}
    </PackageContext.Provider>
  );
}

export function usePackages(): PackageContextValue {
  const context = useContext(PackageContext);
  if (!context) {
    throw new Error('usePackages must be used within a PackageProvider');
  }
  return context;
}
