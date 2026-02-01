import * as dotenv from 'dotenv';
dotenv.config();

import {
  createOAuthClient,
  getAuthorizationUrl,
  loadTokens,
  isAccessTokenValid,
  isRefreshTokenValid,
  restoreTokensToClient,
  refreshAccessToken,
} from './auth';
import { startCallbackServer } from './server';
import { fetchAllReports } from './reports';
import { saveAllReports } from './export';
import { CLIArgs } from './types';

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let start = '';
  let end = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      start = args[i + 1];
      i++;
    } else if (args[i] === '--end' && args[i + 1]) {
      end = args[i + 1];
      i++;
    }
  }

  if (!start || !end) {
    console.error('Usage: npx ts-node src/index.ts --start YYYY-MM-DD --end YYYY-MM-DD');
    process.exit(1);
  }

  return { start, end };
}

async function authenticate(oauthClient: any): Promise<void> {
  const existing = loadTokens();

  if (existing) {
    restoreTokensToClient(oauthClient, existing);

    if (isAccessTokenValid(existing)) {
      console.log('Using existing access token.');
      return;
    }

    if (isRefreshTokenValid(existing)) {
      console.log('Access token expired. Refreshing...');
      await refreshAccessToken(oauthClient);
      console.log('Token refreshed successfully.');
      return;
    }

    console.log('Refresh token expired. Re-authenticating...');
  }

  // Need fresh OAuth flow
  const authUrl = getAuthorizationUrl(oauthClient);
  console.log('\nOpen this URL in your browser to authorize:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization callback...\n');

  const { server } = await startCallbackServer(oauthClient);

  // Give the browser a moment to receive the response, then shut down
  await new Promise((resolve) => setTimeout(resolve, 1000));
  server.close();
  console.log('Authorization complete. Callback server stopped.\n');
}

async function main(): Promise<void> {
  const { start, end } = parseArgs();

  // Validate env vars
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.error('Missing CLIENT_ID or CLIENT_SECRET in .env file.');
    console.error('Copy .env.example to .env and fill in your Intuit app credentials.');
    process.exit(1);
  }

  const oauthClient = createOAuthClient();

  console.log('=== QuickBooks Online Report Export ===\n');
  console.log(`Date range: ${start} to ${end}\n`);

  // Step 1: Authenticate
  await authenticate(oauthClient);

  // Step 2: Fetch reports
  console.log('Fetching reports...\n');
  const reports = await fetchAllReports(oauthClient, start, end);

  // Step 3: Save to disk
  console.log('\nSaving reports...\n');
  const savedPaths = saveAllReports(reports, start, end);

  // Summary
  console.log(`\nDone! ${savedPaths.length} report(s) saved to output/`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
