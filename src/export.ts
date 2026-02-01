import * as fs from 'fs';
import * as path from 'path';
import { ReportRequest } from './types';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

export function saveReport(
  reportType: ReportRequest['reportType'],
  data: any,
  startDate: string,
  endDate: string
): string {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filename = `${reportType}_${startDate}_to_${endDate}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

export function saveAllReports(
  reports: { reportType: ReportRequest['reportType']; data: any }[],
  startDate: string,
  endDate: string
): string[] {
  const savedPaths: string[] = [];

  for (const { reportType, data } of reports) {
    const filepath = saveReport(reportType, data, startDate, endDate);
    savedPaths.push(filepath);
    console.log(`  Saved: ${filepath}`);
  }

  return savedPaths;
}
