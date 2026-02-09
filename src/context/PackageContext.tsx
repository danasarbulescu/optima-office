"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useClient } from './ClientContext';
import type { Package, Dashboard } from '@/lib/types';

interface PackageContextValue {
  packages: Package[];
  dashboardsByPackage: Record<string, Dashboard[]>;
  packagesLoading: boolean;
  refreshPackages: () => void;
}

const PackageContext = createContext<PackageContextValue | undefined>(undefined);

export function PackageProvider({ children }: { children: ReactNode }) {
  const { currentClientId, clientLoading } = useClient();
  const [packages, setPackages] = useState<Package[]>([]);
  const [dashboardsByPackage, setDashboardsByPackage] = useState<Record<string, Dashboard[]>>({});
  const [packagesLoading, setPackagesLoading] = useState(true);

  const fetchPackages = async () => {
    if (!currentClientId || clientLoading) return;
    setPackagesLoading(true);
    try {
      const headers: Record<string, string> = { 'x-client-id': currentClientId };
      const [pkgRes, dashRes] = await Promise.all([
        fetch(`/api/packages?clientId=${currentClientId}`, { headers }),
        fetch(`/api/dashboards?clientId=${currentClientId}`, { headers }),
      ]);

      if (pkgRes.ok) {
        const { packages: pkgs } = await pkgRes.json();
        setPackages(pkgs);
      } else {
        setPackages([]);
      }

      if (dashRes.ok) {
        const { dashboards } = await dashRes.json();
        const grouped: Record<string, Dashboard[]> = {};
        for (const d of dashboards) {
          if (!grouped[d.packageId]) grouped[d.packageId] = [];
          grouped[d.packageId].push(d);
        }
        // Sort dashboards within each package
        for (const key of Object.keys(grouped)) {
          grouped[key].sort((a, b) => a.sortOrder - b.sortOrder);
        }
        setDashboardsByPackage(grouped);
      } else {
        setDashboardsByPackage({});
      }
    } catch {
      setPackages([]);
      setDashboardsByPackage({});
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [currentClientId, clientLoading]);

  return (
    <PackageContext.Provider
      value={{
        packages,
        dashboardsByPackage,
        packagesLoading,
        refreshPackages: fetchPackages,
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
