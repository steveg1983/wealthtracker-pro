/**
 * Microsoft Money (.mny) page decryption — pure JavaScript, no native code.
 *
 * A .mny file is an MSISAM database (an encrypted Access/Jet variant). The
 * first 0x0e data pages are RC4-encrypted with a per-page key derived from a
 * salt in the (itself masked) header. This module reproduces the key
 * derivation from Jackcess's MSISAMCryptCodecHandler so an ordinary MDB
 * reader can then parse the decrypted bytes.
 *
 * We only ever READ. Password-protected Money files are out of scope: the
 * common case (and the migration target) is the empty-password database, which
 * is what Money writes by default. If a real password were set the derived key
 * would not decrypt and parsing would fail loudly — never silently wrong.
 *
 * References:
 *  - jackcessencrypt MSISAMCryptCodecHandler / BaseCryptCodecHandler
 *  - mdb-reader (Jet header unmasking key)
 */

const PAGE_SIZE = 4096;
const HEADER_MASK_KEY = Uint8Array.from([0xc7, 0xda, 0x39, 0x6b]);
const HEADER_MASK_START = 0x18;
const HEADER_MASK_LEN = 128;
const SALT_OFFSET = 0x72;
const ENCRYPTION_FLAGS_OFFSET = 0x298;
const USE_SHA1 = 0x20;
const NEW_ENCRYPTION = 0x6;
const PASSWORD_LENGTH = 0x28; // 40 bytes, zero-filled for the empty password
const DIGEST_LENGTH = 0x10; // 16
const MAX_ENCRYPTED_PAGE = 0x0e;

/** RC4 keystream cipher (symmetric — same routine encrypts and decrypts). */
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    const t = s[i]; s[i] = s[j]; s[j] = t;
  }
  const out = new Uint8Array(data.length);
  let a = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    a = (a + 1) & 0xff;
    j = (j + s[a]) & 0xff;
    const t = s[a]; s[a] = s[j]; s[j] = t;
    out[k] = data[k] ^ s[(s[a] + s[j]) & 0xff];
  }
  return out;
}

/**
 * SHA-1 of a byte array. A self-contained implementation (no Web Crypto) so
 * decryption runs identically in the browser, Node, workers and jsdom without
 * depending on `crypto.subtle`, which jsdom does not provide. It only ever
 * hashes a fixed 40-byte buffer here, so speed is irrelevant.
 */
export function sha1(data: Uint8Array): Uint8Array {
  const ml = data.length * 8;
  // pad to 512-bit blocks: 0x80, then zeros, then 64-bit big-endian length
  const withOne = data.length + 1;
  const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(total);
  msg.set(data);
  msg[data.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(total - 4, ml >>> 0, false);
  view.setUint32(total - 8, Math.floor(ml / 0x100000000), false);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const rol = (n: number, c: number) => ((n << c) | (n >>> (32 - c))) >>> 0;
  const w = new Uint32Array(80);

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  new DataView(out.buffer).setUint32(0, h0, false);
  new DataView(out.buffer).setUint32(4, h1, false);
  new DataView(out.buffer).setUint32(8, h2, false);
  new DataView(out.buffer).setUint32(12, h3, false);
  new DataView(out.buffer).setUint32(16, h4, false);
  return out;
}

function digest(algo: 'SHA-1' | 'MD5', data: Uint8Array): Uint8Array {
  // Money's modern format (NEW_ENCRYPTION) always sets USE_SHA1, so SHA-1 is
  // the live branch. MD5 (pre-2002 files) is handled by the loud-failure
  // contract rather than supported.
  if (algo === 'MD5') {
    throw new MnyDecryptError(
      'This looks like a very old Microsoft Money file (MD5 encryption). Only Money 2002 and later files can be imported.'
    );
  }
  return sha1(data);
}

export class MnyDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MnyDecryptError';
  }
}

/**
 * Decrypt a .mny file in place-safe fashion, returning a NEW byte array whose
 * encrypted pages are decrypted and whose other pages are copied verbatim.
 * The result is a plain (identity-codec) MSISAM database an MDB reader parses.
 */
export function decryptMny(bytes: Uint8Array): Uint8Array {
  if (bytes.length < PAGE_SIZE) {
    throw new MnyDecryptError('File is too small to be a Microsoft Money database.');
  }
  // Validate the engine signature before doing anything else.
  const engine = new TextDecoder('latin1').decode(bytes.subarray(0x04, 0x13));
  if (engine !== 'MSISAM Database') {
    throw new MnyDecryptError('Not a Microsoft Money file (missing MSISAM signature).');
  }

  const out = bytes.slice(); // copy — never mutate the caller's buffer

  // 1. Unmask the header page to recover the true salt (Jet fixed-key RC4).
  const header = out.slice(0, PAGE_SIZE);
  const unmasked = rc4(HEADER_MASK_KEY, header.subarray(HEADER_MASK_START, HEADER_MASK_START + HEADER_MASK_LEN));
  header.set(unmasked, HEADER_MASK_START);

  const flags = header[ENCRYPTION_FLAGS_OFFSET];
  if ((flags & NEW_ENCRYPTION) === 0) {
    throw new MnyDecryptError(
      'This Microsoft Money file uses a legacy encryption scheme that is not supported. Only Money 2002 and later files can be imported.'
    );
  }

  // 2. Derive the base hash: digest(empty password) ++ 4-byte salt.
  const algo = (flags & USE_SHA1) !== 0 ? 'SHA-1' : 'MD5';
  const pwdDigest = digest(algo, new Uint8Array(PASSWORD_LENGTH)).subarray(0, DIGEST_LENGTH);
  const baseHash = new Uint8Array(DIGEST_LENGTH + 4);
  baseHash.set(pwdDigest, 0);
  baseHash.set(header.subarray(SALT_OFFSET, SALT_OFFSET + 4), DIGEST_LENGTH);

  // 3. Decrypt each encrypted page with its page-numbered key.
  const pageKey = new Uint8Array(DIGEST_LENGTH + 4);
  for (let page = 1; page <= MAX_ENCRYPTED_PAGE; page++) {
    const start = page * PAGE_SIZE;
    if (start >= out.length) break;
    pageKey.set(baseHash);
    // applyPageNumber: XOR the little-endian page number over bytes 16..19.
    pageKey[DIGEST_LENGTH + 0] = (page & 0xff) ^ baseHash[DIGEST_LENGTH + 0];
    pageKey[DIGEST_LENGTH + 1] = ((page >>> 8) & 0xff) ^ baseHash[DIGEST_LENGTH + 1];
    pageKey[DIGEST_LENGTH + 2] = ((page >>> 16) & 0xff) ^ baseHash[DIGEST_LENGTH + 2];
    pageKey[DIGEST_LENGTH + 3] = ((page >>> 24) & 0xff) ^ baseHash[DIGEST_LENGTH + 3];
    const decrypted = rc4(pageKey, out.subarray(start, start + PAGE_SIZE));
    out.set(decrypted, start);
  }

  return out;
}
