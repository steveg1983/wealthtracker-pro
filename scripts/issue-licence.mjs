#!/usr/bin/env node

/**
 * ISSUING A LICENCE. The owner's side of `apps/desktop/src-tauri/src/license.rs`.
 *
 *   node scripts/issue-licence.mjs --generate
 *   node scripts/issue-licence.mjs --issue --email ada@example.com --name "Ada Lovelace"
 *   node scripts/issue-licence.mjs --issue --email x@example.com --name "X" --trial-months 3
 *   node scripts/issue-licence.mjs --verify WTL1-…
 *
 * ── THE PRIVATE KEY NEVER COMES NEAR THIS REPOSITORY ────────────────────────
 *
 * `--generate` writes it to ~/Documents/WealthTracker-signing/, chmod 600, once,
 * and refuses to overwrite one that is already there. It is never printed, never
 * logged, never echoed back, and there is no flag that would make it be — the
 * only thing that leaves this program's stdout is the PUBLIC half and the
 * licence strings themselves.
 *
 * If it is lost, nothing that was already issued stops working: every shipped
 * build carries the public half and verifies against that. What is lost is the
 * ability to issue ANOTHER, which is repaired by generating a new pair,
 * committing the new public key and re-issuing to the people who bought one.
 * That is a bad afternoon and not a catastrophe, which is the right shape for a
 * key to have — but back it up to the password manager the day you make it.
 *
 * ── WHY NODE'S OWN CRYPTO AND NOT A LIBRARY ─────────────────────────────────
 *
 * Node has signed Ed25519 natively since 12. A dependency here would be a
 * dependency in the repository's `package.json`, which is a dependency Vercel
 * installs on every deploy of the WEB app, for a script that runs on one laptop
 * a handful of times a year. The same objection `crates/Cargo.toml` makes about
 * Rust and `coreTransport.ts` makes about `@tauri-apps/api`, a third time.
 *
 * ── THE FORMAT, AND WHY THE SIGNATURE IS OVER THE TRANSPORTED BYTES ─────────
 *
 *   WTL1-<base64url(claims JSON)>.<base64url(64-byte signature)>
 *
 * The claims travel base64url'd and the signature covers exactly those bytes, so
 * there is no canonical serialisation for this script and the Rust to agree
 * about — no key ordering, no whitespace, no number formatting. Whatever
 * `JSON.stringify` produced here is what is verified there, byte for byte.
 * `license.rs`'s header argues it at length.
 *
 * ── A FENCE, NOT A VAULT ────────────────────────────────────────────────────
 *
 * Stated here as well as in the Rust, because this is the file whose output
 * somebody will one day be tempted to treat as a secret. The licence strings are
 * not secrets: they are signed statements, they can be read by anybody holding
 * one, and the scheme's whole security property is that they cannot be MADE
 * without the private key. The repository is public and the verifier is in it.
 * What is being sold is the signed, notarised, self-updating build.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify
} from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where the private key lives.
 *
 * Overridable ONLY by an environment variable, and only so that this script's
 * own end-to-end check can run against an ephemeral pair in a temp directory
 * without going anywhere near the owner's. There is no flag for it, because a
 * flag is a thing that ends up in a shell history.
 */
const SIGNING_DIR =
  process.env.WEALTHTRACKER_SIGNING_DIR ?? path.join(homedir(), 'Documents', 'WealthTracker-signing');
const PRIVATE_KEY = path.join(SIGNING_DIR, 'wealthtracker-licence.key');

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
const PUBLIC_KEY_FILE =
  process.env.WEALTHTRACKER_PUBLIC_KEY_FILE ??
  path.join(REPO, 'apps', 'desktop', 'licence-public-key.txt');

/** The envelope's version. `license.rs`'s `PREFIX`. */
const PREFIX = 'WTL1-';
/** The claims schema version. `license.rs`'s `CLAIMS_VERSION`. */
const CLAIMS_VERSION = 1;

const b64u = bytes => Buffer.from(bytes).toString('base64url');
const unb64u = text => Buffer.from(text, 'base64url');

const say = line => process.stdout.write(`${line}\n`);
const die = line => {
  process.stderr.write(`issue-licence: ${line}\n`);
  process.exit(1);
};

/** The raw 32 bytes of an Ed25519 public key, out of a KeyObject. */
const rawPublic = key => unb64u(key.export({ format: 'jwk' }).x);

/** The first line of the committed key file that is neither blank nor a comment. */
const committedPublicKey = () => {
  const line = readFileSync(PUBLIC_KEY_FILE, 'utf8')
    .split('\n')
    .map(text => text.trim())
    .find(text => text !== '' && !text.startsWith('#'));
  return line ?? 'PLACEHOLDER';
};

/** A public KeyObject from the raw 32 bytes, via JWK. */
const publicKeyFromRaw = raw =>
  createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: b64u(raw) }, format: 'jwk' });

// ── --generate ───────────────────────────────────────────────────────────────

function generate() {
  if (existsSync(PRIVATE_KEY)) {
    die(
      `${PRIVATE_KEY} already exists, and this will not write over a signing key.\n` +
        '  Every licence ever issued was signed with it. If you really are rotating, move the\n' +
        '  old one somewhere safe first — the licences it signed stop verifying the moment the\n' +
        '  new public key ships.'
    );
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  mkdirSync(SIGNING_DIR, { recursive: true, mode: 0o700 });
  // Written with an explicit mode AND chmod'd: the mode argument is ignored on
  // some platforms and a private key that is world-readable for one instant is
  // a private key that was world-readable.
  writeFileSync(PRIVATE_KEY, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  chmodSync(PRIVATE_KEY, 0o600);

  const raw = b64u(rawPublic(publicKey));

  say('');
  say('A signing key has been made.');
  say('');
  say(`  private  ${PRIVATE_KEY}  (chmod 600 — NEVER printed, NEVER committed)`);
  say('');
  say('  Back it up to your password manager NOW. Nothing else in the world has a copy.');
  say('');
  say('  public   the line below. Put it in apps/desktop/licence-public-key.txt, replacing');
  say('           the word PLACEHOLDER, and commit it. That is what arms enforcement.');
  say('');
  say(raw);
  say('');
}

// ── --issue ──────────────────────────────────────────────────────────────────

function issue({ email, name, trialMonths }) {
  if (!email) die('--issue needs --email.');
  if (!name) die('--issue needs --name "Their Name" — it is what the app displays.');

  if (!existsSync(PRIVATE_KEY)) {
    die(`no signing key at ${PRIVATE_KEY}. Run --generate first (once, ever).`);
  }
  const privateKey = createPrivateKey(readFileSync(PRIVATE_KEY, 'utf8'));

  const issued = Math.floor(Date.now() / 1000);

  // A trial's end is computed as a CALENDAR month rather than as 30 days, so
  // that "three months" means what a person buying it thinks it means.
  let expires;
  if (trialMonths !== undefined) {
    const months = Number(trialMonths);
    if (!Number.isInteger(months) || months < 1 || months > 60) {
      die('--trial-months takes a whole number of months between 1 and 60.');
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
    // needs to know how many have been sold.
    id: `wtl-${b64u(randomBytes(9))}`
  };

  const body = Buffer.from(JSON.stringify(claims), 'utf8');
  const licence = `${PREFIX}${b64u(body)}.${b64u(sign(null, body, privateKey))}`;

  say('');
  say(`  ${claims.kind === 'trial' ? `Trial, ${trialMonths} month(s)` : 'Lifetime'} — ${name} <${email}>`);
  if (expires !== undefined) {
    say(`  Ends ${new Date(expires * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`);
  }
  say(`  Reference ${claims.id}`);
  say('');
  say(licence);
  say('');
  say('  Send that line. It is not a secret — it is a signed statement, readable by anybody');
  say('  holding it, and it cannot be made without the private key.');
  say('');
}

// ── --verify ─────────────────────────────────────────────────────────────────

/**
 * THE SUPPORT TOOL. "They say it does not work" — this is how you find out.
 *
 * Checked against the COMMITTED public key rather than against the private one,
 * because that is what a person's copy of the app actually carries. A licence
 * that verifies here and not on their machine is a build problem; one that fails
 * here was mis-copied or was signed by a key that is no longer shipped.
 */
function verifyOne(licence) {
  const committed = committedPublicKey();
  if (committed === 'PLACEHOLDER') {
    die(
      'apps/desktop/licence-public-key.txt still holds the placeholder, so there is nothing\n' +
        '  to verify against. Run --generate and commit the public key it prints.'
    );
  }

  if (!licence || !licence.startsWith(PREFIX)) {
    die(`that does not begin with ${PREFIX}, so it is not a WealthTracker licence key.`);
  }
  const [claimsPart, signaturePart, ...rest] = licence.slice(PREFIX.length).split('.');
  if (signaturePart === undefined || rest.length > 0) {
    die('that is not one claims part and one signature part separated by a full stop.');
  }

  const body = unb64u(claimsPart);
  const ok = verify(null, body, publicKeyFromRaw(unb64u(committed)), unb64u(signaturePart));
  if (!ok) {
    die(
      'REFUSED. That signature does not match the committed public key.\n' +
        '  Either the string was mis-copied, or it was signed by a key this build no longer ships.'
    );
  }

  const claims = JSON.parse(body.toString('utf8'));
  say('');
  say('  VALID — signed by the key this build carries.');
  say('');
  for (const [key, value] of Object.entries(claims)) {
    const shown =
      (key === 'issued' || key === 'expires') && typeof value === 'number'
        ? `${value}  (${new Date(value * 1000).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })})`
        : value;
    say(`    ${key.padEnd(8)} ${shown}`);
  }
  if (claims.kind === 'trial' && typeof claims.expires === 'number') {
    const over = claims.expires * 1000 < Date.now();
    say('');
    say(over ? '  This trial has ENDED. The app is read-only for them, and exports fully.' : '  This trial is still running.');
  }
  say('');
}

// ── the arguments ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = name => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};

if (argv.includes('--generate')) {
  generate();
} else if (argv.includes('--issue')) {
  issue({ email: flag('--email'), name: flag('--name'), trialMonths: flag('--trial-months') });
} else if (argv.includes('--verify')) {
  verifyOne(flag('--verify'));
} else {
  say('');
  say('  node scripts/issue-licence.mjs --generate');
  say('      Make the signing key. ONCE, EVER. Writes the private half to');
  say(`      ${PRIVATE_KEY} (chmod 600) and prints the public half.`);
  say('');
  say('  node scripts/issue-licence.mjs --issue --email X --name "Y" [--trial-months N]');
  say('      Print one licence key. Without --trial-months it is a lifetime licence.');
  say('');
  say('  node scripts/issue-licence.mjs --verify WTL1-…');
  say('      Check one against the committed public key. The support tool.');
  say('');
  process.exit(1);
}
