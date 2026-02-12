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
  expires_in?: number;
}

interface AccountProviderInfo {
  provider_id: string;
  display_name: string;
  logo_uri?: string;
}

export interface TrueLayerAccount {
  account_id: string;
  provider: AccountProviderInfo;
  display_name?: string;
  account_type?: string;
  currency?: string;
  account_number?: {
    number?: string;
    iban?: string;
    sort_code?: string;
  };
}

export interface TrueLayerTransaction {
  transaction_id: string;
  account_id: string;
  description: string;
  amount: number;
  currency: string;
  timestamp?: string;
  normalised_provider_transaction_id?: string;
  transaction_type?: string;
  merchant_name?: string;
  meta?: Record<string, unknown>;
}

interface AccountsResponse {
  results: TrueLayerAccount[];
}

interface AccountBalanceResult {
  available?: number | string | null;
  current?: number | string | null;
}

interface AccountBalancesResponse {
  results: AccountBalanceResult[];
}

interface TransactionsResponse {
  results: TrueLayerTransaction[];
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
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('client_id', getRequiredEnv('TRUELAYER_CLIENT_ID'));
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', options.scope.join(' '));
  url.searchParams.set('nonce', options.nonce);
  url.searchParams.set('state', options.state);

  // CRITICAL: TrueLayer requires at least one provider to be specified
  // In sandbox, use 'mock' provider. In production, use 'uk-ob-all' for all UK banks
  const isSandbox = isSandboxEnvironment();
  url.searchParams.set('providers', isSandbox ? 'mock' : 'uk-ob-all');

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

export const refreshAccessToken = async (refreshToken: string): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getRequiredEnv('TRUELAYER_CLIENT_ID'),
    client_secret: getRequiredEnv('TRUELAYER_CLIENT_SECRET'),
    refresh_token: refreshToken
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
    throw new Error(`TrueLayer token refresh failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error('TrueLayer token refresh returned no access token');
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

const toNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const fetchAccountBalance = async (
  accessToken: string,
  accountId: string
): Promise<number | null> => {
  const response = await fetch(`${getApiBaseUrl()}/data/v1/accounts/${encodeURIComponent(accountId)}/balance`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TrueLayer balance fetch failed (${accountId}): ${response.status} ${details}`);
  }

  const payload = (await response.json()) as AccountBalancesResponse;
  const balanceRow = Array.isArray(payload.results) ? payload.results[0] : undefined;
  if (!balanceRow) {
    return null;
  }

  const current = toNumber(balanceRow.current);
  if (current !== null) {
    return current;
  }
  return toNumber(balanceRow.available);
};

interface FetchTransactionsOptions {
  from?: string;
  to?: string;
}

export const fetchTransactions = async (
  accessToken: string,
  accountId: string,
  options: FetchTransactionsOptions = {}
): Promise<TrueLayerTransaction[]> => {
  const url = new URL(`${getApiBaseUrl()}/data/v1/accounts/${encodeURIComponent(accountId)}/transactions`);
  if (options.from) {
    url.searchParams.set('from', options.from);
  }
  if (options.to) {
    url.searchParams.set('to', options.to);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TrueLayer transactions fetch failed (${accountId}): ${response.status} ${details}`);
  }

  const payload = (await response.json()) as TransactionsResponse;
  return Array.isArray(payload.results) ? payload.results : [];
};
