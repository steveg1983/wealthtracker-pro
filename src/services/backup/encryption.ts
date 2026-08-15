/**
 * PASSWORD-PROTECTING A BACKUP.
 *
 * The full backup is the only export that can be restored, and the only one
 * that puts a readable copy of someone's entire financial life on their disk.
 * Until now it was plain JSON with a warning attached. This makes the warning
 * optional by making the plainness optional.
 *
 * ## What this uses, and what it deliberately does not
 *
 * Web Crypto (`crypto.subtle`): **AES-256-GCM** for the cipher, **PBKDF2** with
 * SHA-256 to turn a password into a key. Both are native, both are current.
 *
 * It does NOT use `encryptedStorageService`, the app's existing CryptoJS-based
 * helper, for two measured reasons: CryptoJS's passphrase mode derives its key
 * with the old OpenSSL `EVP_BytesToKey` construction (a small number of MD5
 * rounds, no configurable cost), and CryptoJS was measured at ~92% of the cost
 * of every write in this app. A backup is the one file where key-stretching
 * cost is a feature and throughput is irrelevant.
 *
 * **GCM is authenticated**, which is the property that matters here: a file
 * that has been altered by one byte fails to decrypt rather than decrypting
 * into plausible-looking rubbish that then gets restored over real data.
 *
 * ## Why the envelope is JSON
 *
 * An encrypted backup is still a `.json` file, and restore still begins by
 * parsing it. That means detection is a field check rather than a sniff, and —
 * more importantly — the file says what it is. Someone who finds one of these
 * in five years, with this app long gone, can read the header and knows the
 * algorithm, the KDF, the iteration count and the salt. A backup format that
 * cannot be opened without its original software is not a backup.
 *
 * The iteration count travels IN the file for the same reason: raising it later
 * must not strand the files written before the change.
 */
import type { BackupBundle } from './format';

export const ENCRYPTED_BACKUP_FORMAT = 'wealthtracker-encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;

/**
 * OWASP's 2023 floor for PBKDF2-SHA-256. Roughly half a second on a current
 * laptop — unnoticeable once, when writing a file you will keep for years, and
 * the entire defence against someone brute-forcing a weak password offline
 * after the file leaks. Raise it freely; old files carry their own count.
 */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size GCM is specified for

export interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: number;
  /** Plain, so a person can read what protects the file without decrypting it. */
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  ciphertext: string;
  /**
   * Unencrypted, and only ever this. It lets the restore dialog say "made on
   * the 14th of August" before asking for a password, so someone choosing
   * between three backup files does not have to guess-and-decrypt. Anything
   * that would identify an account, a balance or a person stays inside.
   */
  exportedAt: string;
}

/** Thrown when a file will not open. See the message for why it is one error. */
export class BackupDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupDecryptionError';
  }
}

/**
 * Chunked, because a real backup is tens of megabytes and
 * `String.fromCharCode(...bytes)` on that many arguments overflows the stack —
 * a bug that only appears on the large files most worth protecting.
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupBundle(
  bundle: BackupBundle,
  passphrase: string
): Promise<EncryptedBackupEnvelope> {
  if (passphrase === '') {
    throw new Error('A password is required to encrypt a backup.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );

  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
    },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    exportedAt: bundle.exportedAt,
  };
}

/**
 * Structural, not a `format ===` check alone: a file claiming to be encrypted
 * but missing its salt should reach the "this file is damaged" message rather
 * than throwing somewhere inside the decrypt.
 */
export function isEncryptedBackup(parsed: unknown): parsed is EncryptedBackupEnvelope {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const candidate = parsed as Partial<EncryptedBackupEnvelope>;
  return (
    candidate.format === ENCRYPTED_BACKUP_FORMAT &&
    typeof candidate.ciphertext === 'string' &&
    typeof candidate.kdf?.salt === 'string' &&
    typeof candidate.kdf?.iterations === 'number' &&
    typeof candidate.cipher?.iv === 'string'
  );
}

export async function decryptBackupBundle(
  envelope: EncryptedBackupEnvelope,
  passphrase: string
): Promise<BackupBundle> {
  if (envelope.version > ENCRYPTED_BACKUP_VERSION) {
    throw new BackupDecryptionError(
      `This backup was written by a newer version of WealthTracker (format ${envelope.version}). Update the app and try again.`
    );
  }

  const key = await deriveKey(
    passphrase,
    fromBase64(envelope.kdf.salt),
    envelope.kdf.iterations
  );

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) as BufferSource },
      key,
      fromBase64(envelope.ciphertext) as BufferSource
    );
  } catch {
    // GCM cannot tell a wrong key from altered bytes, and it is not a
    // shortcoming — refusing to distinguish them is what stops an attacker
    // learning about the key by feeding in edits. So the message names both
    // and claims neither. Guessing "wrong password" would send someone off to
    // retype a password that was right all along.
    throw new BackupDecryptionError(
      'That password did not open the file, or the file has been altered since it was made.'
    );
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as BackupBundle;
  } catch {
    throw new BackupDecryptionError(
      'The file was decrypted but its contents are not a readable backup.'
    );
  }
}

/**
 * The name carries `-encrypted` because a folder of backups is the place the
 * distinction is needed and the only place it is invisible: both files end
 * `.json`, both open in an editor, and only one of them shows you an account
 * list when it does.
 */
export function encryptedBackupFileName(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 10);
  return `wealthtracker-backup-${stamp}-encrypted.json`;
}

/** The sibling of `downloadBackupBundle`, kept beside what it writes. */
export function downloadEncryptedBackup(envelope: EncryptedBackupEnvelope): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = encryptedBackupFileName(envelope.exportedAt);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
