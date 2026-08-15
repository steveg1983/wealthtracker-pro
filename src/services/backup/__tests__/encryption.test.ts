/**
 * Password-protected backups — against real Web Crypto, not a stubbed cipher.
 *
 * jsdom ships an object at `crypto.subtle` whose `deriveKey` is missing, so
 * `src/test/browserShims.ts` swaps in Node's `webcrypto`. That is the same
 * specification and the same algorithms, so everything below exercises real
 * AES-GCM and real PBKDF2 — a break in the cipher would fail these tests.
 *
 * The tests that matter most are the refusals. An encryption feature whose
 * happy path works and whose failure path silently returns rubbish is worse
 * than no encryption, because the rubbish gets restored over real data.
 */
import { describe, it, expect } from 'vitest';
import {
  encryptBackupBundle,
  decryptBackupBundle,
  isEncryptedBackup,
  encryptedBackupFileName,
  BackupDecryptionError,
  ENCRYPTED_BACKUP_FORMAT,
  PBKDF2_ITERATIONS,
} from '../encryption';
import type { BackupBundle } from '../format';

/** Shaped like a bundle, with values chosen so a partial decrypt is obvious. */
function bundleFixture(): BackupBundle {
  return {
    format: 'wealthtracker-backup-v2',
    version: '20260812140000',
    exportedAt: '2026-08-15T09:30:00.000Z',
    rows: {
      accounts: [{ id: 'acc-1', name: 'Everyday', balance: '1234.56' }],
      transactions: [{ id: 'txn-1', account_id: 'acc-1', amount: '-19.99' }],
    },
    links: { accountParents: [], transactionLinks: [] },
    preferences: { currency: 'GBP' },
  } as unknown as BackupBundle;
}

const PASSWORD = 'correct horse battery staple';

describe('backup encryption', () => {
  describe('the round trip', () => {
    it('gives back exactly the bundle that went in', async () => {
      const original = bundleFixture();
      const envelope = await encryptBackupBundle(original, PASSWORD);
      const restored = await decryptBackupBundle(envelope, PASSWORD);

      expect(restored).toEqual(original);
    });

    it('puts nothing readable in the envelope', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);

      /*
       * SEARCHED IN THE DECODED BYTES, NOT IN THE BASE64.
       *
       * This test used to run `JSON.stringify(envelope)` and assert the
       * secrets were absent from THAT — which includes the base64 ciphertext.
       * Base64 of random bytes is random text over [A-Za-z0-9+/], so any short
       * needle drawn from that alphabet turns up by chance eventually. On 15
       * August it did: the ciphertext contained "…aeCGBPHPgd…" and CI failed
       * on a PR that had not touched encryption. Roughly a 1-in-380 run for a
       * three-character needle across ~700 characters of ciphertext, which is
       * frequent enough to erode trust in the suite and rare enough to be
       * blamed on whatever change was in flight.
       *
       * The property actually worth asserting is that the PLAINTEXT is not
       * recoverable from the envelope, so decode the ciphertext and look in
       * the bytes. A match there would be a real leak; a match in the base64
       * is an artefact of the encoding.
       */
      const cipherBytes = Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0));
      const asBytes = new TextDecoder('utf-8', { fatal: false }).decode(cipherBytes);

      // The metadata is the other half: everything OUTSIDE the ciphertext is
      // published in clear, so it is checked in clear.
      const { ciphertext: _ciphertext, ...metadata } = envelope;
      const asMetadata = JSON.stringify(metadata);

      // Checked individually so a failure names which one escaped.
      for (const secret of ['Everyday', '1234.56', '19.99', 'acc-1', 'GBP']) {
        expect(asBytes, `${secret} found in the ciphertext`).not.toContain(secret);
        expect(asMetadata, `${secret} found in the envelope metadata`).not.toContain(secret);
      }
    });

    it('publishes the date, and only the date', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);

      // So the restore dialog can label three files without opening them.
      expect(envelope.exportedAt).toBe('2026-08-15T09:30:00.000Z');
      expect(envelope.kdf.iterations).toBe(PBKDF2_ITERATIONS);
      expect(envelope.kdf.name).toBe('PBKDF2');
      expect(envelope.cipher.name).toBe('AES-GCM');
    });

    it('never writes the same file twice for the same input', async () => {
      const bundle = bundleFixture();
      const first = await encryptBackupBundle(bundle, PASSWORD);
      const second = await encryptBackupBundle(bundle, PASSWORD);

      // Fresh salt and IV each time. Equal ciphertexts would mean a fixed IV,
      // which is the classic way to make GCM leak.
      expect(first.cipher.iv).not.toBe(second.cipher.iv);
      expect(first.kdf.salt).not.toBe(second.kdf.salt);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    });
  });

  describe('the refusals', () => {
    it('refuses the wrong password without guessing which fault it was', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);

      await expect(
        decryptBackupBundle(envelope, 'not the password')
      ).rejects.toThrow(BackupDecryptionError);

      // Naming only "wrong password" would send someone away to retype a
      // password that was right, when the file was the thing that changed.
      await expect(
        decryptBackupBundle(envelope, 'not the password')
      ).rejects.toThrow(/altered since it was made/);
    });

    it('refuses a file altered by one byte', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
      const bytes = atob(envelope.ciphertext);
      const flipped = `${String.fromCharCode(bytes.charCodeAt(0) ^ 0x01)}${bytes.slice(1)}`;

      // This is the property that makes GCM the right choice: a tampered
      // backup fails loudly instead of restoring plausible rubbish.
      await expect(
        decryptBackupBundle({ ...envelope, ciphertext: btoa(flipped) }, PASSWORD)
      ).rejects.toThrow(BackupDecryptionError);
    });

    it('refuses a file whose header says it is newer than this app', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);

      await expect(
        decryptBackupBundle({ ...envelope, version: 99 }, PASSWORD)
      ).rejects.toThrow(/newer version/);
    });

    it('will not encrypt with an empty password', async () => {
      await expect(encryptBackupBundle(bundleFixture(), '')).rejects.toThrow(
        /password is required/
      );
    });
  });

  describe('recognising an encrypted file', () => {
    it('recognises one it wrote', async () => {
      const envelope = await encryptBackupBundle(bundleFixture(), PASSWORD);
      expect(isEncryptedBackup(envelope)).toBe(true);
    });

    it('does not mistake a plain backup for one', () => {
      expect(isEncryptedBackup(bundleFixture())).toBe(false);
    });

    it('rejects a file that claims the format but lacks its parts', () => {
      // Reaches "this file is damaged" rather than throwing inside decrypt.
      expect(isEncryptedBackup({ format: ENCRYPTED_BACKUP_FORMAT })).toBe(false);
      expect(
        isEncryptedBackup({
          format: ENCRYPTED_BACKUP_FORMAT,
          ciphertext: 'x',
          cipher: { iv: 'y' },
          kdf: { salt: 'z' }, // no iterations
        })
      ).toBe(false);
    });

    it('survives the things a file picker actually yields', () => {
      expect(isEncryptedBackup(null)).toBe(false);
      expect(isEncryptedBackup(undefined)).toBe(false);
      expect(isEncryptedBackup('a string')).toBe(false);
      expect(isEncryptedBackup([])).toBe(false);
    });
  });

  describe('data that is large or awkward', () => {
    it('handles a bundle far past the chunking boundary', async () => {
      // toBase64 chunks at 0x8000; `fromCharCode(...bytes)` on the whole array
      // would overflow the stack, and only on the big files worth protecting.
      const big = bundleFixture();
      (big as unknown as { rows: { transactions: unknown[] } }).rows.transactions =
        Array.from({ length: 5000 }, (_, i) => ({
          id: `txn-${i}`,
          description: `Payment number ${i}`,
          amount: '-12.34',
        }));

      const envelope = await encryptBackupBundle(big, PASSWORD);
      const restored = await decryptBackupBundle(envelope, PASSWORD);

      expect(restored).toEqual(big);
    });

    it('keeps non-ASCII intact through the trip', async () => {
      const bundle = bundleFixture();
      (bundle as unknown as { rows: { accounts: Record<string, unknown>[] } }).rows.accounts = [
        { id: 'a', name: 'Café — Épargne 💷 £' },
      ];

      const restored = await decryptBackupBundle(
        await encryptBackupBundle(bundle, PASSWORD),
        PASSWORD
      );

      expect(
        (restored as unknown as { rows: { accounts: { name: string }[] } }).rows.accounts[0].name
      ).toBe('Café — Épargne 💷 £');
    });

    it('accepts a password with spaces and symbols', async () => {
      const password = ' pass phrase — with "quotes" & £symbols\t ';
      const restored = await decryptBackupBundle(
        await encryptBackupBundle(bundleFixture(), password),
        password
      );
      expect(restored).toEqual(bundleFixture());
    });
  });

  describe('the file name', () => {
    it('carries the date and says it is encrypted', () => {
      expect(encryptedBackupFileName('2026-08-15T09:30:00.000Z')).toBe(
        'wealthtracker-backup-2026-08-15-encrypted.json'
      );
    });
  });
});
