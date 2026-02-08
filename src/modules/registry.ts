import type { ModuleManifest } from './types';
import { manifest as dashboard } from './dashboard/manifest';
import { manifest as trend } from './trend-analysis/manifest';

const modules: ModuleManifest[] = [dashboard, trend];

export function getModuleManifest(id: string): ModuleManifest | undefined {
  return modules.find(m => m.id === id);
}

export function getAllModuleManifests(): ModuleManifest[] {
  return [...modules].sort((a, b) => a.navOrder - b.navOrder);
}
