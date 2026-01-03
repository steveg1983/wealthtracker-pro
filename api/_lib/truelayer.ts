import { getOptionalEnv, getRequiredEnv } from './env.js';

const SANDBOX_AUTH_URL = 'https://auth.truelayer-sandbox.com';
const PRODUCTION_AUTH_URL = 'https://auth.truelayer.com';
const SANDBOX_API_URL = 'https://api.truelayer-sandbox.com';
const PRODUCTION_API_URL = 'https://api.truelayer.com';

interface AuthUrlOptions {
  redirectUri: string;
  scope: string[];
  nonce: string;
  state: string;
  enableOpenBanking?: boolean;
  enableOauth?: boolean;
  enableMock?: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface AccountProviderInfo {
  provider_id: string;
  display_name: string;
  logo_uri?: string;
}

export interface TrueLayerAccount {
  account_id: string;
  provider: AccountProviderInfo;
}

interface AccountsResponse {
  results: TrueLayerAccount[];
}

const getEnvironment = (): string =>
  (getOptionalEnv('TRUELAYER_ENVIRONMENT') ?? 'production').toLowerCase();

const getAuthBaseUrl = (): string =>
  getEnvironment() === 'production' ? PRODUCTION_AUTH_URL : SANDBOX_AUTH_URL;

const getApiBaseUrl = (): string =>
  getEnvironment() === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL;

export const getRedirectUri = (): string => getRequiredEnv('TRUELAYER_REDIRECT_URI');

export const isSandboxEnvironment = (): boolean =>
  getEnvironment() !== 'production';

export const buildAuthUrl = (options: AuthUrlOptions): string => {
  const url = new URL(getAuthBaseUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', getRequiredEnv('TRUELAYER_CLIENT_ID'));
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', options.scope.join(' '));
  url.searchParams.set('nonce', options.nonce);
  url.searchParams.set('state', options.state);
  if (options.enableMock) {
    url.searchParams.set('enable_mock', 'true');
  }
  if (options.enableOpenBanking) {
    url.searchParams.set('enable_open_banking_providers', 'true');
  }
  if (options.enableOauth) {
    url.searchParams.set('enable_oauth_providers', 'true');
  }
  return url.toString();
};

export const exchangeCodeForToken = async (code: string): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getRequiredEnv('TRUELAYER_CLIENT_ID'),
    client_secret: getRequiredEnv('TRUELAYER_CLIENT_SECRET'),
    redirect_uri: getRedirectUri(),
    code
  });

  const response = await fetch(`${getAuthBaseUrl()}/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TrueLayer token exchange failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error('TrueLayer token exchange returned no access token');
  }

  return data;
};

export const fetchAccounts = async (accessToken: string): Promise<TrueLayerAccount[]> => {
  const response = await fetch(`${getApiBaseUrl()}/data/v1/accounts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TrueLayer accounts fetch failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as AccountsResponse;
  return Array.isArray(data.results) ? data.results : [];
};
