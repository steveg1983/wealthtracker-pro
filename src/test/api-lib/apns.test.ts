import { describe, it, expect } from 'vitest';
import { createPrivateKey, generateKeyPairSync, verify } from 'node:crypto';
import {
  buildApnsHeaders,
  buildApnsPayload,
  classifyApnsResponse,
  normalizePrivateKeyPem,
  signProviderToken,
  PROVIDER_TOKEN_LIFETIME_MS,
  type ApnsConfig,
} from '../../../api/_lib/apns';

/**
 * APPLE'S SIDE OF A PUSH, WITHOUT APPLE.
 *
 * The HTTP/2 call is the one thing here that only a phone can prove; what
 * surrounds it — the signed provider token, the headers, the payload, and
 * the reading of Apple's answer — is pure and is pinned here. Every key
 * generated on the spot; nothing here is a real credential (public repo).
 */

const throwawayKey = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

const configWith = (privateKeyPem: string): ApnsConfig => ({
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  privateKey: createPrivateKey(privateKeyPem),
  bundleId: 'com.example.invented',
});

const base64urlDecode = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

describe('the provider token', () => {
  it('is a JOSE ES256 token Apple can verify with the matching public key', () => {
    const { privateKey, publicKey } = throwawayKey();
    const config = configWith(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    const issuedAt = new Date('2026-09-11T08:00:00Z');

    const token = signProviderToken(config, issuedAt);
    const [header, claims, signature] = token.split('.');

    expect(JSON.parse(base64urlDecode(header).toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(JSON.parse(base64urlDecode(claims).toString())).toEqual({
      iss: 'TEAM123456',
      iat: Math.floor(issuedAt.getTime() / 1000),
    });
    // The signature is the raw r‖s pair (ieee-p1363), which is what JOSE's
    // ES256 means and what Apple checks — a DER signature would be refused.
    const raw = base64urlDecode(signature);
    expect(raw).toHaveLength(64);
    expect(
      verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, raw)
    ).toBe(true);
  });

  it('lives fifty minutes — under Apple\'s hour, over its twenty-minute floor', () => {
    expect(PROVIDER_TOKEN_LIFETIME_MS).toBe(50 * 60 * 1000);
  });
});

describe('the .p8, however it was pasted', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----';

  it('real newlines pass through', () => {
    expect(normalizePrivateKeyPem(pem)).toBe(pem);
  });

  it('the two characters "\\n" — what a one-line env field holds — become newlines', () => {
    expect(normalizePrivateKeyPem(pem.replace(/\n/g, '\\n'))).toBe(pem);
  });

  it('base64 of the PEM is unwrapped', () => {
    expect(normalizePrivateKeyPem(Buffer.from(pem).toString('base64'))).toBe(pem);
  });
});

describe('what a push carries', () => {
  it('a title, a body, a sound, and the app\'s destination — never an amount', () => {
    const payload = buildApnsPayload({ title: '3 new transactions', body: '3 from Sample Bank are waiting for you to review.', url: '/transactions', threadId: 'feed-activity' });
    expect(payload).toEqual({
      aps: { alert: { title: '3 new transactions', body: '3 from Sample Bank are waiting for you to review.' }, sound: 'default', 'thread-id': 'feed-activity' },
      url: '/transactions',
    });
    expect(JSON.stringify(payload)).not.toMatch(/£|\$|\d+\.\d\d/);
  });

  it('headers name the topic, the alert type, top priority, and a collapse id when given', () => {
    const { privateKey } = throwawayKey();
    const config = configWith(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    const now = new Date('2026-09-11T08:00:00Z');
    const headers = buildApnsHeaders(config, 'abc123', { title: 't', body: 'b', collapseId: 'feed-activity' }, 'bearer-token', now);
    expect(headers).toMatchObject({
      ':method': 'POST',
      ':path': '/3/device/abc123',
      authorization: 'bearer bearer-token',
      'apns-topic': 'com.example.invented',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-collapse-id': 'feed-activity',
    });
    expect(Number(headers['apns-expiration'])).toBe(Math.floor(now.getTime() / 1000) + 3600);
  });
});

describe('reading Apple\'s answer', () => {
  it('200 is sent', () => {
    expect(classifyApnsResponse(200, '')).toEqual({ kind: 'sent' });
  });

  it('410, or the word Unregistered, retires the token', () => {
    expect(classifyApnsResponse(410, '{"reason":"Unregistered"}')).toEqual({ kind: 'unregistered', reason: 'Unregistered' });
  });

  it('a bad device token is its own answer — usually the other environment\'s', () => {
    expect(classifyApnsResponse(400, '{"reason":"BadDeviceToken"}')).toEqual({ kind: 'bad_token', reason: 'BadDeviceToken' });
    expect(classifyApnsResponse(400, '{"reason":"DeviceTokenNotForTopic"}')).toEqual({ kind: 'bad_token', reason: 'DeviceTokenNotForTopic' });
  });

  it('a refused provider token is about US, not the device', () => {
    expect(classifyApnsResponse(403, '{"reason":"InvalidProviderToken"}')).toEqual({ kind: 'auth_failed', reason: 'InvalidProviderToken' });
    expect(classifyApnsResponse(403, '{"reason":"ExpiredProviderToken"}').kind).toBe('auth_failed');
  });

  it('anything else is a failure that names its status', () => {
    expect(classifyApnsResponse(503, '{"reason":"ServiceUnavailable"}')).toEqual({ kind: 'failed', status: 503, reason: 'ServiceUnavailable' });
    expect(classifyApnsResponse(429, 'not json')).toEqual({ kind: 'failed', status: 429, reason: 'not json' });
  });
});
