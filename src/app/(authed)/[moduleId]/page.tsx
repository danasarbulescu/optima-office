"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useClient } from "@/context/ClientContext";
import { getModuleManifest } from "@/modules/registry";

const components: Record<string, React.ComponentType> = {
  dashboard: dynamic(() => import("@/modules/dashboard/DashboardPage")),
  "trend-analysis": dynamic(() => import("@/modules/trend-analysis/TrendPage")),
};

function ModuleNotFound() {
  return <div className="app-error">Module not found.</div>;
}

export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { enabledModules, isInternal, clientLoading } = useClient();

  if (clientLoading) return null;

  const manifest = getModuleManifest(moduleId);
  if (!manifest) return <ModuleNotFound />;

  if (!isInternal && !enabledModules.includes(moduleId)) {
    return <ModuleNotFound />;
  }

  const Component = components[moduleId];
  if (!Component) return <ModuleNotFound />;

  return <Component />;
}
