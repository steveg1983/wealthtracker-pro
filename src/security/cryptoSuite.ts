/**
 * The crypto-js surface this application actually uses — and nothing else.
 *
 * `import CryptoJS from 'crypto-js'` pulls the package index, and that index
 * requires every cipher and digest the library ships: TripleDES, Blowfish, RC4,
 * Rabbit, SHA-3, SHA-512, RIPEMD-160, six block modes and seven padding
 * schemes. Measured on the 2026-08-12 build, 242 KB of crypto-js sat in the
 * entry chunk and roughly 140 KB of it was algorithms no line of this codebase
 * calls. It was eager, too: `encryptedStorageService` runs at boot, so every
 * user downloaded all of it before the first screen painted.
 *
 * crypto-js is built so that each algorithm module augments one shared `core`
 * singleton. Importing core plus only the algorithms we call therefore yields
 * exactly the same `CryptoJS` object the index would have — same AES, same
 * OpenSSL-compatible key derivation, same defaults (CBC, Pkcs7). The bytes on
 * disk are unchanged, so anything encrypted by a previous build still decrypts.
 *
 * The algorithms below are the complete set used across
 * `encryptedStorageService` and `csrf-protection`:
 *
 *   AES        — encryptedStorageService
 *   SHA256     — csrf-protection, encryptedStorageService (MAC key derivation)
 *   HmacSHA256 — encryptedStorageService (record authentication)
 *
 * PBKDF2 and enc.Base64 were here too, until 2026-08-28. Both existed for
 * `encryption-enhanced.ts`, a 401-line service with no production consumer —
 * only its own test imported it. It was retired, and these two went with it.
 * Nothing else in the app derives a key or base64-encodes through crypto-js:
 * the backup file format uses Web Crypto's PBKDF2 and AES-GCM instead
 * (`services/backup/encryption.ts`), which authenticates natively.
 *
 * Measured, that removal was worth 0.2 KB gzipped and left the entry chunk
 * unchanged at 323.9 KB — the retired service itself had no importers, so
 * Rollup had never bundled a byte of it, and only these two imports were ever
 * real weight. Recorded because the 242 KB figure above makes this file look
 * like a place where large savings live; it is not. It is a place where the
 * BOOT PATH's contents are decided, which is why the import list is pinned by
 * a test even when the bytes at stake are small.
 *
 * `enc.Utf8`, `enc.Hex` and `lib.WordArray` live in core itself; `mode.CBC`,
 * `pad.Pkcs7` and `lib.CipherParams` arrive with `cipher-core`, which `aes`
 * requires. Adding a new algorithm means adding its import HERE — reaching for
 * the `crypto-js` index again would quietly restore all 242 KB.
 */

import CryptoJS from 'crypto-js/core';
import AES from 'crypto-js/aes';
import SHA256 from 'crypto-js/sha256';
import HmacSHA256 from 'crypto-js/hmac-sha256';

// This build declares node_modules side-effect free (`treeshake.moduleSideEffects:
// 'no-external'` in vite.config.ts), so a bare `import 'crypto-js/aes'` would be
// dropped from the bundle and `CryptoJS.AES` would be undefined at runtime —
// silently, at the first attempt to read a user's encrypted data. Reading the
// bindings here is what keeps them: the check below is a genuine use, so the
// imports cannot be elided, and a packaging regression fails loudly at module
// load rather than as an unreadable ledger later on.
const requiredAlgorithms: ReadonlyArray<readonly [string, unknown]> = [
  ['AES', AES],
  ['SHA256', SHA256],
  ['HmacSHA256', HmacSHA256]
];

const missingAlgorithms = requiredAlgorithms
  .filter(([, implementation]) => implementation == null)
  .map(([name]) => name);

if (missingAlgorithms.length > 0) {
  throw new Error(
    `crypto-js algorithms missing from the bundle: ${missingAlgorithms.join(', ')}. ` +
    'This is a build/packaging fault, not a user error — encrypted storage cannot be read.'
  );
}

export default CryptoJS;
