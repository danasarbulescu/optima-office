export interface SandboxConfig {
  id: string;
  label: string;
  tablePrefix: string;
}

export const SANDBOXES: SandboxConfig[] = [
  {
    id: 'win-desktop',
    label: 'Win Desktop Sandbox',
    tablePrefix: 'amplify-quickbooksexport-marin-sandbox-59a22a3c9b',
  },
  {
    id: 'win-xps',
    label: 'Win XPS Sandbox',
    tablePrefix: 'amplify-quickbooksexport-Marin-sandbox-a3c0c362ac',
  },
  {
    id: 'production',
    label: 'Production',
    tablePrefix: 'amplify-d15bx1surdnd12-main-branch-593bd34ebb',
  },
];

export function getSandboxById(id: string): SandboxConfig | undefined {
  return SANDBOXES.find((s) => s.id === id);
}
