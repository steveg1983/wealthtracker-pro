/**
 * WHAT A LICENCE IS, once, for every owner-side tool.
 *
 * Two programs issue and check licences on the owner's machine —
 * `issue-licence.mjs` (the terminal) and `licence-desk.mjs` (the page) — and
 * the moment there are two, the claims schema, the calendar-month arithmetic
 * and the signature format must live in exactly one place, because they are
 * what `apps/desktop/src-tauri/src/license.rs` verifies byte for byte. This is
 * that place. The CLI keeps `--generate` (a key is made once, ever, and only
 * deliberately); everything both tools do is here.
 *
 * The design arguments — why Node's own crypto, why the signature is over the
 * transported bytes, why a fence and not a vault — stay in
 * `issue-licence.mjs`'s header, which remains the file a person reads first.
 */

import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where the private key lives.
 *
 * Overridable ONLY by an environment variable, and only so that the tools' own
 * end-to-end checks can run against an ephemeral pair in a temp directory
 * without going anywhere near the owner's. There is no flag for it, because a
 * flag is a thing that ends up in a shell history.
 */
export const SIGNING_DIR =
  process.env.WEALTHTRACKER_SIGNING_DIR ?? path.join(homedir(), 'Documents', 'WealthTracker-signing');
export const PRIVATE_KEY = path.join(SIGNING_DIR, 'wealthtracker-licence.key');

/**
 * The committed public key the shell compiles in. One file, one line.
 *
 * Overridable by an environment variable for ONE reason, which is the
 * end-to-end check in `apps/desktop/README.md`: generate an ephemeral pair into
 * a temp directory, issue against it, verify against it, tamper a byte and watch
 * it fail — all without touching the committed key or the owner's. It is not a
 * way to make a build trust a different key: the SHELL reads the committed file
 * with `include_str!` at compile time and has never heard of this variable.
 */
export const PUBLIC_KEY_FILE =
  process.env.WEALTHTRACKER_PUBLIC_KEY_FILE ??
  path.join(REPO, 'apps', 'desktop', 'licence-public-key.txt');

/** The envelope's version. `license.rs`'s `PREFIX`. */
export const PREFIX = 'WTL1-';
/** The claims schema version. `license.rs`'s `CLAIMS_VERSION`. */
export const CLAIMS_VERSION = 1;

export const b64u = bytes => Buffer.from(bytes).toString('base64url');
export const unb64u = text => Buffer.from(text, 'base64url');

/** The raw 32 bytes of an Ed25519 public key, out of a KeyObject. */
export const rawPublic = key => unb64u(key.export({ format: 'jwk' }).x);

/** The first line of the committed key file that is neither blank nor a comment. */
export const committedPublicKey = () => {
  const line = readFileSync(PUBLIC_KEY_FILE, 'utf8')
    .split('\n')
    .map(text => text.trim())
    .find(text => text !== '' && !text.startsWith('#'));
  return line ?? 'PLACEHOLDER';
};

/** A public KeyObject from the raw 32 bytes, via JWK. */
export const publicKeyFromRaw = raw =>
  createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: b64u(raw) }, format: 'jwk' });

/**
 * Build and sign one licence. Returns `{ claims, licence }`.
 *
 * # Errors
 * Throws a sentence a person can act on — a missing name, a trial length that
 * is not a whole number of months between 1 and 60, a signing key that has not
 * been generated yet. Both tools show the sentence as it is.
 */
export function issueLicence({ name, email, trialMonths }) {
  if (!email) throw new Error('a licence needs an email address.');
  if (!name) throw new Error("a licence needs the person's name — it is what the app displays.");

  if (!existsSync(PRIVATE_KEY)) {
    throw new Error(`no signing key at ${PRIVATE_KEY}. Run --generate first (once, ever).`);
  }
  const privateKey = createPrivateKey(readFileSync(PRIVATE_KEY, 'utf8'));

  const issued = Math.floor(Date.now() / 1000);

  // A trial's end is computed as a CALENDAR month rather than as 30 days, so
  // that "three months" means what a person buying it thinks it means.
  let expires;
  if (trialMonths !== undefined) {
    const months = Number(trialMonths);
    if (!Number.isInteger(months) || months < 1 || months > 60) {
      throw new Error('a trial runs a whole number of months, between 1 and 60.');
    }
    const end = new Date(issued * 1000);
    end.setMonth(end.getMonth() + months);
    expires = Math.floor(end.getTime() / 1000);
  }

  const claims = {
    v: CLAIMS_VERSION,
    kind: expires === undefined ? 'lifetime' : 'trial',
    name,
    email,
    issued,
    // Omitted entirely for a lifetime licence — `license.rs` refuses a lifetime
    // claim that carries an end date, because a licence that contradicts itself
    // would make somebody choose which half to believe.
    ...(expires === undefined ? {} : { expires }),
    // Something a support conversation can name. Random rather than sequential:
    // a counter would need a ledger of its own, and there is nothing here that
    // needs one to sign.
    id: `wtl-${b64u(randomBytes(9))}`
  };

  const body = Buffer.from(JSON.stringify(claims), 'utf8');
  const licence = `${PREFIX}${b64u(body)}.${b64u(sign(null, body, privateKey))}`;
  return { claims, licence };
}

/**
 * Check one pasted licence string against the COMMITTED public key — what a
 * person's copy of the app actually carries — and return its claims.
 *
 * # Errors
 * Throws a sentence naming what is wrong: not a licence string at all, a
 * placeholder build with nothing to check against, or a signature that does
 * not match — which means a mis-copy, or a key this build no longer ships.
 */
export function verifyLicence(licence) {
  const committed = committedPublicKey();
  if (committed === 'PLACEHOLDER') {
    throw new Error(
      'apps/desktop/licence-public-key.txt still holds the placeholder, so there is nothing\n' +
        '  to verify against. Run --generate and commit the public key it prints.'
    );
  }

  if (!licence || !licence.startsWith(PREFIX)) {
    throw new Error(`that does not begin with ${PREFIX}, so it is not a WealthTracker licence key.`);
  }
  const [claimsPart, signaturePart, ...rest] = licence.slice(PREFIX.length).split('.');
  if (signaturePart === undefined || rest.length > 0) {
    throw new Error('that is not one claims part and one signature part separated by a full stop.');
  }

  const body = unb64u(claimsPart);
  const ok = verify(null, body, publicKeyFromRaw(unb64u(committed)), unb64u(signaturePart));
  if (!ok) {
    throw new Error(
      'REFUSED. That signature does not match the committed public key.\n' +
        '  Either the string was mis-copied, or it was signed by a key this build no longer ships.'
    );
  }

  return JSON.parse(body.toString('utf8'));
}
