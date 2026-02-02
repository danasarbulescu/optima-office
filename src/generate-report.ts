import * as fs from 'fs';
import * as path from 'path';
import { fetchPLSummaries, buildGroupValues, GroupValues } from './cdata';
import { KPIs, PnLByMonth } from './lib/types';
import { sumRange, computeKPIs, build13MonthPnL } from './lib/compute';
import { formatAbbrev } from './lib/format';
import { generateHTML } from './lib/html';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { month: string; verbose: boolean } {
  const args = process.argv.slice(2);
  let month = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      month = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    console.error('Usage: ts-node src/generate-report.ts --month YYYY-MM [--verbose]');
    process.exit(1);
  }

  return { month, verbose };
}

// ---------------------------------------------------------------------------
// Verbose output
// ---------------------------------------------------------------------------

function printVerbose(
  curGroups: GroupValues,
  pyGroups: GroupValues | null,
  monthIdx: number,
  selectedMonth: string,
  kpis: KPIs,
): void {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yearStr] = selectedMonth.split('-');
  const year = Number(yearStr);

  console.log('\n' + '='.repeat(80));
  console.log(`  VERBOSE AUDIT — Selected month: ${selectedMonth} (month index: ${monthIdx})`);
  console.log('='.repeat(80));

  console.log(`\n--- Current year P&L group summaries (${year}) ---`);
  for (const [group, values] of curGroups) {
    console.log(`\n  ${group}:`);
    const parts: string[] = [];
    for (let i = 0; i < 12; i++) {
      parts.push(`${monthNames[i]}=${values[i].toFixed(2)}`);
    }
    parts.push(`Total=${(values[12] ?? 0).toFixed(2)}`);
    console.log(`    ${parts.join('  |  ')}`);
  }

  if (pyGroups) {
    console.log(`\n--- Prior year P&L group summaries (${year - 1}) ---`);
    for (const [group, values] of pyGroups) {
      console.log(`\n  ${group}:`);
      const parts: string[] = [];
      for (let i = 0; i < 12; i++) {
        parts.push(`${monthNames[i]}=${values[i].toFixed(2)}`);
      }
      parts.push(`Total=${(values[12] ?? 0).toFixed(2)}`);
      console.log(`    ${parts.join('  |  ')}`);
    }
  } else {
    console.log('\n--- No prior year P&L data available ---');
  }

  const income = curGroups.get('Income') || [];
  const grossProfit = curGroups.get('GrossProfit') || [];
  const netIncome = curGroups.get('NetIncome') || [];

  console.log('\n--- KPI calculation breakdown ---\n');

  console.log(`  Revenue Current Mo.     = Income[${monthIdx}] = ${kpis.revenueCurrentMo.toFixed(2)}`);

  const prior3Indices: string[] = [];
  for (let i = monthIdx - 3; i < monthIdx; i++) {
    if (i >= 0 && i < income.length) {
      prior3Indices.push(`Income[${i}]=${income[i].toFixed(2)}`);
    }
  }
  console.log(`  Revenue 3 prior mos avg = avg(${prior3Indices.join(', ')}) = ${kpis.revenue3MoAvg.toFixed(2)}`);

  const ytdParts: string[] = [];
  for (let i = 0; i <= monthIdx && i < income.length; i++) {
    ytdParts.push(income[i].toFixed(2));
  }
  console.log(`  YTD Revenue             = sum(Income[0..${monthIdx}]) = sum(${ytdParts.join(' + ')}) = ${kpis.ytdRevenue.toFixed(2)}`);

  if (kpis.pyToDateRevenue !== null) {
    console.log(`  PY to Date Revenue      = ${kpis.pyToDateRevenue.toFixed(2)}`);
    console.log(`  YOY Revenue Variance    = ${kpis.ytdRevenue.toFixed(2)} - ${kpis.pyToDateRevenue.toFixed(2)} = ${kpis.yoyRevenueVariance!.toFixed(2)}`);
    if (kpis.yoyRevenueVariancePct !== null) {
      console.log(`  YOY Revenue Variance %  = ${kpis.yoyRevenueVariancePct.toFixed(2)}%`);
    }
  }

  const gpCurMo = monthIdx >= 0 ? (grossProfit[monthIdx] || 0) : 0;
  console.log(`  Gross Margin Current Mo = GP[${monthIdx}] / Income[${monthIdx}] = ${gpCurMo.toFixed(2)} / ${kpis.revenueCurrentMo.toFixed(2)} = ${kpis.grossMarginCurrentMo.toFixed(2)}%`);

  const ytdGP = sumRange(grossProfit, 0, monthIdx);
  console.log(`  Gross Margin YTD        = sum(GP[0..${monthIdx}]) / sum(Income[0..${monthIdx}]) = ${ytdGP.toFixed(2)} / ${kpis.ytdRevenue.toFixed(2)} = ${kpis.grossMarginYTD.toFixed(2)}%`);

  console.log(`  Current Mo. Net Income  = NetIncome[${monthIdx}] = ${kpis.currentMoNetIncome.toFixed(2)}`);

  const ytdNIParts: string[] = [];
  for (let i = 0; i <= monthIdx && i < netIncome.length; i++) {
    ytdNIParts.push(netIncome[i].toFixed(2));
  }
  console.log(`  Net Income YTD          = sum(NI[0..${monthIdx}]) = sum(${ytdNIParts.join(' + ')}) = ${kpis.netIncomeYTD.toFixed(2)}`);

  if (kpis.pyToDateNetIncome !== null) {
    console.log(`  PY to Date Net Income   = ${kpis.pyToDateNetIncome.toFixed(2)}`);
    console.log(`  Net Income YOY Variance = ${kpis.netIncomeYTD.toFixed(2)} - ${kpis.pyToDateNetIncome.toFixed(2)} = ${kpis.netIncomeYoyVariance!.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { month, verbose } = parseArgs();
  const [yearStr, moStr] = month.split('-');
  const year = Number(yearStr);
  const monthIdx = parseInt(moStr, 10) - 1;

  // Fetch PL data from CData
  console.log('Fetching P&L data from CData...');
  const plRows = await fetchPLSummaries();

  if (plRows.length === 0) {
    console.error('No PL summary data returned from CData.');
    process.exit(1);
  }

  console.log(`Received ${plRows.length} summary rows.`);

  // Build GroupValues for current and prior year
  const curGroups = buildGroupValues(plRows, year);
  const pyGroups = buildGroupValues(plRows, year - 1);

  // Check if prior year has meaningful data
  const pyHasData = [...pyGroups.values()].some(arr => arr.slice(0, 12).some(v => v !== 0));

  // Compute KPIs
  const kpis = computeKPIs(curGroups, pyHasData ? pyGroups : null, monthIdx);

  if (verbose) {
    printVerbose(curGroups, pyHasData ? pyGroups : null, monthIdx, month, kpis);
  }

  // Build 13-month P&L data
  const pnlByMonth = build13MonthPnL(curGroups, pyHasData ? pyGroups : null, month);

  // Generate HTML
  const html = generateHTML(kpis, month, pnlByMonth);

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const outputPath = path.join(OUTPUT_DIR, 'dashboard.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Dashboard saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
