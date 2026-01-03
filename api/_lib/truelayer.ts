/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../types/truelayer-client.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
import { AuthAPIClient, Constants } from 'truelayer-client';
import { getOptionalEnv, getRequiredEnv } from './env.js';

const SANDBOX_AUTH_URL = 'https://auth.truelayer-sandbox.com';

let authClient: AuthAPIClient | null = null;

const applyEnvironmentOverrides = (): void => {
  const environment = (getOptionalEnv('TRUELAYER_ENVIRONMENT') ?? 'production').toLowerCase();
  if (environment !== 'production') {
    Reflect.set(Constants, 'AUTH_URL', SANDBOX_AUTH_URL);
  }
};

export const getAuthClient = (): AuthAPIClient => {
  if (!authClient) {
    applyEnvironmentOverrides();
    authClient = new AuthAPIClient({
      client_id: getRequiredEnv('TRUELAYER_CLIENT_ID'),
      client_secret: getRequiredEnv('TRUELAYER_CLIENT_SECRET')
    });
  }
  return authClient;
};

export const getRedirectUri = (): string => getRequiredEnv('TRUELAYER_REDIRECT_URI');

export const isSandboxEnvironment = (): boolean =>
  (getOptionalEnv('TRUELAYER_ENVIRONMENT') ?? 'production').toLowerCase() !== 'production';
