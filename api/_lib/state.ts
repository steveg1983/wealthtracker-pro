import { createHmac, randomBytes } from 'node:crypto';
import { getOptionalEnv } from './env.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  userId: string;
  issuedAt: number;
  nonce: string;
}

const getStateSecret = (): string => {
  const secret =
    getOptionalEnv('BANKING_STATE_SECRET') ??
    getOptionalEnv('TRUELAYER_STATE_SECRET');

  if (!secret) {
    throw new Error('BANKING_STATE_SECRET (or TRUELAYER_STATE_SECRET) must be set');
  }

  return secret;
};

export const createStateToken = (userId: string): string => {
  if (!userId) {
    throw new Error('userId is required to generate state token');
  }

  const payload: StatePayload = {
    userId,
    issuedAt: Date.now(),
    nonce: randomBytes(12).toString('hex'),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = getStateSecret();
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');

  return `${encodedPayload}.${signature}`;
};

export const decodeStateToken = (token: string): StatePayload | null => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    return null;
  }

  const secret = getStateSecret();
  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (expectedSignature !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
