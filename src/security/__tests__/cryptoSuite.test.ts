/**
 * `cryptoSuite` narrows crypto-js from its full index down to the five
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
      ['PBKDF2', () => cryptoSuite.PBKDF2],
      ['algo.SHA256', () => cryptoSuite.algo.SHA256],
      ['enc.Base64', () => cryptoSuite.enc.Base64],
      ['enc.Utf8', () => cryptoSuite.enc.Utf8],
      ['lib.WordArray', () => cryptoSuite.lib.WordArray],
      ['lib.CipherParams', () => cryptoSuite.lib.CipherParams],
      ['mode.CBC', () => cryptoSuite.mode.CBC],
      ['pad.Pkcs7', () => cryptoSuite.pad.Pkcs7]
    ])('%s is present', (_name, read) => {
      expect(read()).toBeDefined();
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
      // encryption-enhanced.ts pins mode and padding explicitly rather than
      // relying on the defaults, so pin them here too.
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

    it('yields identical SHA256, HmacSHA256 and PBKDF2 output', () => {
      expect(cryptoSuite.SHA256(PLAINTEXT).toString())
        .toBe(FullCryptoJS.SHA256(PLAINTEXT).toString());

      expect(cryptoSuite.HmacSHA256(PLAINTEXT, PASSPHRASE).toString())
        .toBe(FullCryptoJS.HmacSHA256(PLAINTEXT, PASSPHRASE).toString());

      const salt = cryptoSuite.enc.Utf8.parse('a-fixed-salt');
      const derive = (lib: typeof FullCryptoJS): string =>
        lib.PBKDF2(PASSPHRASE, salt, { keySize: 256 / 32, iterations: 100, hasher: lib.algo.SHA256 }).toString();

      expect(derive(cryptoSuite)).toBe(derive(FullCryptoJS));
    });

    it('encodes Base64 identically', () => {
      const words = cryptoSuite.enc.Utf8.parse(PLAINTEXT);
      expect(words.toString(cryptoSuite.enc.Base64))
        .toBe(words.toString(FullCryptoJS.enc.Base64));
    });
  });

  it('generates random WordArrays of the requested length', () => {
    const random = cryptoSuite.lib.WordArray.random(256 / 8);
    // 32 bytes rendered as hex.
    expect(random.toString()).toHaveLength(64);
    expect(random.toString()).not.toBe(cryptoSuite.lib.WordArray.random(256 / 8).toString());
  });
});
