export function formatAbbrev(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1) + 'M';
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(2) + 'K';
  } else {
    formatted = abs.toFixed(2);
  }

  if (value < 0) return `(${formatted})`;
  return formatted;
}

export function formatPct(value: number): string {
  return value.toFixed(2) + '%';
}

export function formatVariance(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return prefix + formatAbbrev(value);
}
