/**
 * `cryptoSuite` narrows crypto-js from its full index down to the three
 * algorithms this codebase actually calls, which removed ~140 KB of unused
 * ciphers from the entry chunk. The saving is only worth having if the object
 * it produces is INDISTINGUISHABLE from the one the index produced — a stored
 * ledger encrypted by a previous build must still open under this one, or the
 * optimisation has cost a user their data.
 *
 * So these tests deliberately import the full `crypto-js` barrel alongside the
 * narrowed suite and assert the two agree: ciphertext crosses in both
 * directions and every digest matches. Importing the barrel here is safe —
 * test files are never bundled.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import FullCryptoJS from 'crypto-js';
import cryptoSuite from '../cryptoSuite';

// Deliberately not financial: this repo is public, and a fixture only needs to
// be a string that survives a round trip.
const PLAINTEXT = 'the quick brown fox jumps over the lazy dog';
const PASSPHRASE = 'test-passphrase-not-a-real-secret';

describe('cryptoSuite — the narrowed crypto-js surface', () => {
  describe('exposes every algorithm the application calls', () => {
    it.each([
      ['AES', () => cryptoSuite.AES],
      ['SHA256', () => cryptoSuite.SHA256],
      ['HmacSHA256', () => cryptoSuite.HmacSHA256],
      ['algo.SHA256', () => cryptoSuite.algo.SHA256],
      ['enc.Utf8', () => cryptoSuite.enc.Utf8],
      ['lib.WordArray', () => cryptoSuite.lib.WordArray],
      ['lib.CipherParams', () => cryptoSuite.lib.CipherParams],
      ['mode.CBC', () => cryptoSuite.mode.CBC],
      ['pad.Pkcs7', () => cryptoSuite.pad.Pkcs7]
    ])('%s is present', (_name, read) => {
      expect(read()).toBeDefined();
    });

  });

  /**
   * The other half of the point: what the suite must NOT drag in.
   *
   * PBKDF2 and enc.Base64 were imported until 2026-08-28, for
   * `encryption-enhanced.ts` — a 401-line service no production module ever
   * imported. Retiring it let both go. cryptoSuite is on the boot path, so
   * anything added back is downloaded by every user before the first paint.
   *
   * This reads the SOURCE, which looks crude until you try the obvious
   * version. `expect(cryptoSuite.PBKDF2).toBeUndefined()` fails right here —
   * every crypto-js module augments one shared `core` singleton, and the file
   * you are reading imports the full barrel two lines up to prove parity. The
   * barrel puts PBKDF2 back on the very object under test. Runtime absence is
   * therefore unobservable in-process once anything, anywhere in the run, has
   * touched the index; the import list is the only honest place to assert it.
   */
  describe('keeps the boot path narrow', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/security/cryptoSuite.ts'), 'utf8');

    it.each([
      ['crypto-js/pbkdf2'],
      ['crypto-js/enc-base64']
    ])('does not import %s', (specifier) => {
      expect(source).not.toContain(specifier);
    });

    it('imports exactly the algorithms it declares', () => {
      const imported = [...source.matchAll(/from 'crypto-js\/([a-z0-9-]+)'/g)].map((m) => m[1]);

      expect(imported.sort()).toEqual(['aes', 'core', 'hmac-sha256', 'sha256']);
    });
  });

  describe('is byte-compatible with the full crypto-js index', () => {
    it('decrypts AES ciphertext produced by the full library', () => {
      // This is the compatibility that matters: the "old build" wrote this.
      const legacyCiphertext = FullCryptoJS.AES.encrypt(PLAINTEXT, PASSPHRASE).toString();

      const recovered = cryptoSuite.AES
        .decrypt(legacyCiphertext, PASSPHRASE)
        .toString(cryptoSuite.enc.Utf8);

      expect(recovered).toBe(PLAINTEXT);
    });

    it('produces AES ciphertext the full library can still read', () => {
      const ciphertext = cryptoSuite.AES.encrypt(PLAINTEXT, PASSPHRASE).toString();

      const recovered = FullCryptoJS.AES
        .decrypt(ciphertext, PASSPHRASE)
        .toString(FullCryptoJS.enc.Utf8);

      expect(recovered).toBe(PLAINTEXT);
    });

    it('round-trips through an explicit CBC/Pkcs7 configuration', () => {
      // Nothing pins mode and padding explicitly today — AES's defaults are
      // CBC/Pkcs7 — but a stored ledger was written under them, so their
      // behaviour is pinned here rather than assumed.
      const key = cryptoSuite.enc.Utf8.parse('0123456789abcdef0123456789abcdef');
      const iv = cryptoSuite.enc.Utf8.parse('0123456789abcdef');

      const encrypted = cryptoSuite.AES.encrypt(PLAINTEXT, key, {
        iv,
        mode: cryptoSuite.mode.CBC,
        padding: cryptoSuite.pad.Pkcs7
      });

      const recovered = FullCryptoJS.AES
        .decrypt(
          FullCryptoJS.lib.CipherParams.create({ ciphertext: encrypted.ciphertext }),
          key,
          { iv, mode: FullCryptoJS.mode.CBC, padding: FullCryptoJS.pad.Pkcs7 }
        )
        .toString(FullCryptoJS.enc.Utf8);

      expect(recovered).toBe(PLAINTEXT);
    });

    it('yields identical SHA256 and HmacSHA256 output', () => {
      expect(cryptoSuite.SHA256(PLAINTEXT).toString())
        .toBe(FullCryptoJS.SHA256(PLAINTEXT).toString());

      // Both of these now carry a stored record's authentication tag, so a
      // divergence here would make every existing record unreadable.
      expect(cryptoSuite.HmacSHA256(PLAINTEXT, PASSPHRASE).toString())
        .toBe(FullCryptoJS.HmacSHA256(PLAINTEXT, PASSPHRASE).toString());
    });
  });

  it('generates random WordArrays of the requested length', () => {
    const random = cryptoSuite.lib.WordArray.random(256 / 8);
    // 32 bytes rendered as hex.
    expect(random.toString()).toHaveLength(64);
    expect(random.toString()).not.toBe(cryptoSuite.lib.WordArray.random(256 / 8).toString());
  });
});
