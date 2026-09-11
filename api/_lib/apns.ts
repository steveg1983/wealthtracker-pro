import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import http2 from 'node:http2';
import { getOptionalEnv } from './env.js';

/**
 * Apple Push Notification service, spoken directly.
 *
 * Token-based authentication (a .p8 signing key, ES256) over HTTP/2 to
 * api.push.apple.com — the whole protocol is one signed header and one POST,
 * and node's own `crypto` and `http2` cover both. No dependency, for the
 * reason the rate limiter and Sentry wiring give: a serverless function that
 * carries a client library carries it on every cold start.
 *
 * ── INERT UNTIL CONFIGURED ──────────────────────────────────────────────────
 *
 * Four variables, all server-side (none VITE_-prefixed — a signing key in a
 * browser bundle would let anyone push to every phone):
 *
 *   APNS_TEAM_ID      the Apple Developer team (VT6W829WRX)
 *   APNS_KEY_ID       the ten-character id of the .p8 key
 *   APNS_PRIVATE_KEY  the .p8 contents — PEM, with real newlines or the
 *                     literal two characters "\n" (which is what pasting into
 *                     a one-line env field produces); base64 of the PEM is
 *                     accepted too
 *   APNS_BUNDLE_ID    the app's bundle id; defaults to com.wealthtracker.mobile
 *
 * With any of the first three unset, `apnsConfig()` answers null and every
 * caller skips sending, logs once, and carries on — the same pattern as
 * SENTRY_DSN. Nothing else in a cron run depends on a push going out.
 *
 * ── THE TOKEN IS CACHED, AND FOR HOW LONG IS APPLE'S RULE ───────────────────
 *
 * Apple refuses a provider token older than an hour and asks that one not be
 * minted more than once every twenty minutes. Fifty minutes sits inside both.
 *
 * ── WHAT A PUSH CARRIES ─────────────────────────────────────────────────────
 *
 * A title, a body, an optional URL for the app to open, and never an amount:
 * a lock screen is read by whoever is holding the phone. Callers compose the
 * words; this module only delivers them.
 */

export interface ApnsConfig {
  teamId: string;
  keyId: string;
  privateKey: KeyObject;
  bundleId: string;
}

export type ApnsEnvironment = 'production' | 'sandbox';

export const APNS_HOSTS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com'
};

export const DEFAULT_BUNDLE_ID = 'com.wealthtracker.mobile';

/** Fifty minutes: under Apple's one-hour maximum, over its twenty-minute minimum. */
export const PROVIDER_TOKEN_LIFETIME_MS = 50 * 60 * 1000;

/** Give up on Apple after this long; a hung push must not hold a cron's budget. */
const REQUEST_TIMEOUT_MS = 10_000;

/** A push not delivered within the hour is stale news; Apple drops it. */
const EXPIRATION_SECONDS = 60 * 60;

/**
 * The PEM, however it was pasted. A one-line env field turns newlines into
 * the two characters "\n"; some hosts would rather hold base64. Both come
 * back to the PEM Apple issued.
 */
export const normalizePrivateKeyPem = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.includes('-----BEGIN')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
  return decoded.includes('-----BEGIN') ? decoded.replace(/\\n/g, '\n') : trimmed;
};

let cachedConfig: ApnsConfig | null | undefined;

export const apnsConfig = (): ApnsConfig | null => {
  if (cachedConfig !== undefined) return cachedConfig;
  const teamId = getOptionalEnv('APNS_TEAM_ID')?.trim();
  const keyId = getOptionalEnv('APNS_KEY_ID')?.trim();
  const rawKey = getOptionalEnv('APNS_PRIVATE_KEY');
  if (!teamId || !keyId || !rawKey?.trim()) {
    cachedConfig = null;
    return null;
  }
  try {
    cachedConfig = {
      teamId,
      keyId,
      privateKey: createPrivateKey(normalizePrivateKeyPem(rawKey)),
      bundleId: getOptionalEnv('APNS_BUNDLE_ID')?.trim() || DEFAULT_BUNDLE_ID
    };
  } catch (error) {
    // A key that does not parse is a configuration error, not a reason for
    // every cron to throw. Say so once per cold start and stay inert.
    console.error('[apns] APNS_PRIVATE_KEY is not a readable PEM key; pushes are disabled', {
      message: error instanceof Error ? error.message : String(error)
    });
    cachedConfig = null;
  }
  return cachedConfig;
};

const base64url = (value: Buffer | string): string =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * The provider token: `{alg: ES256, kid}` . `{iss: team, iat}` . signature,
 * where the signature is the raw r‖s pair (ieee-p1363) rather than DER —
 * JOSE's ES256 encoding, and the one Apple checks.
 */
export const signProviderToken = (config: ApnsConfig, issuedAt: Date): string => {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(issuedAt.getTime() / 1000) }));
  const signingInput = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363'
  });
  return `${signingInput}.${base64url(signature)}`;
};

let cachedToken: { value: string; mintedAt: number; keyId: string } | null = null;

const providerToken = (config: ApnsConfig, now: Date): string => {
  if (
    cachedToken &&
    cachedToken.keyId === config.keyId &&
    now.getTime() - cachedToken.mintedAt < PROVIDER_TOKEN_LIFETIME_MS
  ) {
    return cachedToken.value;
  }
  cachedToken = { value: signProviderToken(config, now), mintedAt: now.getTime(), keyId: config.keyId };
  return cachedToken.value;
};

/** Apple said the token we sent it was bad; the next push mints a fresh one. */
export const forgetProviderToken = (): void => {
  cachedToken = null;
};

export interface ApnsAlert {
  title: string;
  body: string;
  /** Where the app should go when the notification is tapped. */
  url?: string;
  /** Pushes sharing an id replace one another on the lock screen. */
  collapseId?: string;
  /** Pushes sharing a thread are grouped by iOS. */
  threadId?: string;
}

export interface ApnsPayload {
  aps: {
    alert: { title: string; body: string };
    sound: 'default';
    'thread-id'?: string;
  };
  url?: string;
}

export const buildApnsPayload = (alert: ApnsAlert): ApnsPayload => ({
  aps: {
    alert: { title: alert.title, body: alert.body },
    sound: 'default',
    ...(alert.threadId ? { 'thread-id': alert.threadId } : {})
  },
  ...(alert.url ? { url: alert.url } : {})
});

export const buildApnsHeaders = (
  config: ApnsConfig,
  token: string,
  alert: ApnsAlert,
  bearer: string,
  now: Date
): Record<string, string> => ({
  ':method': 'POST',
  ':path': `/3/device/${token}`,
  authorization: `bearer ${bearer}`,
  'apns-topic': config.bundleId,
  'apns-push-type': 'alert',
  'apns-priority': '10',
  'apns-expiration': String(Math.floor(now.getTime() / 1000) + EXPIRATION_SECONDS),
  'content-type': 'application/json',
  ...(alert.collapseId ? { 'apns-collapse-id': alert.collapseId } : {})
});

export type ApnsResult =
  | { kind: 'sent' }
  /** Apple no longer delivers to this token: the app was removed, or the token rotated. */
  | { kind: 'unregistered'; reason: string }
  /** The token is not one this environment knows — often the OTHER environment's. */
  | { kind: 'bad_token'; reason: string }
  /** Our provider token was refused: the key, team or bundle id is wrong. */
  | { kind: 'auth_failed'; reason: string }
  | { kind: 'failed'; status: number; reason: string };

/**
 * Apple's answer, read. Status codes and reason strings are the documented
 * ones (Sending notification requests to APNs → response codes).
 */
export const classifyApnsResponse = (status: number, body: string): ApnsResult => {
  if (status === 200) return { kind: 'sent' };
  let reason = '';
  try {
    const parsed = JSON.parse(body) as { reason?: unknown };
    reason = typeof parsed.reason === 'string' ? parsed.reason : '';
  } catch {
    reason = body.slice(0, 200);
  }
  if (status === 410 || reason === 'Unregistered') return { kind: 'unregistered', reason: reason || 'Unregistered' };
  if (status === 400 && (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic')) {
    return { kind: 'bad_token', reason };
  }
  if (status === 403 || reason.endsWith('ProviderToken')) return { kind: 'auth_failed', reason: reason || `HTTP ${status}` };
  return { kind: 'failed', status, reason: reason || `HTTP ${status}` };
};

/**
 * One push to one device. Resolves with Apple's verdict; rejects only when
 * Apple could not be reached at all (network, timeout), which the caller
 * counts as a failure rather than a fact about the token.
 */
export const sendApnsAlert = (
  config: ApnsConfig,
  environment: ApnsEnvironment,
  deviceToken: string,
  alert: ApnsAlert,
  now: Date = new Date()
): Promise<ApnsResult> =>
  new Promise((resolve, reject) => {
    const client = http2.connect(APNS_HOSTS[environment]);
    let settled = false;
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.close();
      outcome();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`APNs did not answer within ${REQUEST_TIMEOUT_MS} ms`))),
      REQUEST_TIMEOUT_MS
    );

    client.on('error', (error) => finish(() => reject(error)));

    const request = client.request(buildApnsHeaders(config, deviceToken, alert, providerToken(config, now), now));
    let status = 0;
    let body = '';
    request.setEncoding('utf8');
    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      const result = classifyApnsResponse(status, body);
      if (result.kind === 'auth_failed') forgetProviderToken();
      finish(() => resolve(result));
    });
    request.on('error', (error) => finish(() => reject(error)));
    request.end(JSON.stringify(buildApnsPayload(alert)));
  });
