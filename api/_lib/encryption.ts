import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getRequiredEnv } from './env.js';

const KEY_LENGTH = 32;
const IV_LENGTH = 12; // AES-GCM recommended IV length

let cachedKey: Buffer | null = null;

const toKeyBuffer = (): Buffer => {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = getRequiredEnv('ENCRYPTION_KEY').trim();
  let keyBuffer: Buffer;
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    keyBuffer = Buffer.from(secret, 'hex');
  } else {
    keyBuffer = Buffer.from(secret, 'utf8');
  }

  if (keyBuffer.length < KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY must be at least 32 bytes long');
  }

  cachedKey = keyBuffer.subarray(0, KEY_LENGTH);
  return cachedKey;
};

export const encryptSecret = (payload: string): string => {
  const key = toKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

export const decryptSecret = (encoded: string): string => {
  const key = toKeyBuffer();
  const buffer = Buffer.from(encoded, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};
