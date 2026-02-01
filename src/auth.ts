import * as fs from 'fs';
import * as path from 'path';
import { TokenData } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const OAuthClient = require('intuit-oauth');

const TOKENS_PATH = path.resolve(__dirname, '..', '.tokens.json');

export function createOAuthClient(): typeof OAuthClient {
  return new OAuthClient({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    environment: process.env.ENVIRONMENT || 'sandbox',
    redirectUri: process.env.REDIRECT_URI,
  });
}

export function getAuthorizationUrl(oauthClient: typeof OAuthClient): string {
  return oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'qbo-export',
  });
}

export async function exchangeCodeForTokens(
  oauthClient: typeof OAuthClient,
  callbackUrl: string
): Promise<TokenData> {
  const authResponse = await oauthClient.createToken(callbackUrl);
  const token = oauthClient.getToken();

  const tokenData: TokenData = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    x_refresh_token_expires_in: token.x_refresh_token_expires_in,
    realmId: oauthClient.token.realmId,
    createdAt: Date.now(),
  };

  saveTokens(tokenData);
  return tokenData;
}

export async function refreshAccessToken(
  oauthClient: typeof OAuthClient
): Promise<TokenData> {
  const authResponse = await oauthClient.refresh();
  const token = oauthClient.getToken();

  const existing = loadTokens();
  const tokenData: TokenData = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    x_refresh_token_expires_in: token.x_refresh_token_expires_in,
    realmId: existing?.realmId || oauthClient.token.realmId,
    createdAt: Date.now(),
  };

  saveTokens(tokenData);
  return tokenData;
}

export function saveTokens(tokenData: TokenData): void {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokenData, null, 2));
}

export function loadTokens(): TokenData | null {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  const raw = fs.readFileSync(TOKENS_PATH, 'utf-8');
  return JSON.parse(raw) as TokenData;
}

export function isAccessTokenValid(tokenData: TokenData): boolean {
  const elapsed = Date.now() - tokenData.createdAt;
  const expiresInMs = tokenData.expires_in * 1000;
  // Consider expired 60 seconds early to avoid edge cases
  return elapsed < expiresInMs - 60_000;
}

export function isRefreshTokenValid(tokenData: TokenData): boolean {
  const elapsed = Date.now() - tokenData.createdAt;
  const expiresInMs = tokenData.x_refresh_token_expires_in * 1000;
  return elapsed < expiresInMs - 60_000;
}

export function restoreTokensToClient(
  oauthClient: typeof OAuthClient,
  tokenData: TokenData
): void {
  oauthClient.token.setToken({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
  });
  oauthClient.token.realmId = tokenData.realmId;
}
