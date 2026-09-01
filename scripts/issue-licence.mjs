#!/usr/bin/env node

/**
 * ISSUING A LICENCE. The owner's side of `apps/desktop/src-tauri/src/license.rs`.
 *
 *   node scripts/issue-licence.mjs --generate
 *   node scripts/issue-licence.mjs --issue --email ada@example.com --name "Ada Lovelace"
 *   node scripts/issue-licence.mjs --issue --email x@example.com --name "X" --trial-months 3
 *   node scripts/issue-licence.mjs --verify WTL1-…
 *
 * There is also a page for this — `node scripts/licence-desk.mjs` — which
 * issues the same licences through a form and keeps a record of them. What a
 * licence IS (the claims, the month arithmetic, the signature) lives once, in
 * `licence-core.mjs`, and both tools use it; this file keeps `--generate`,
 * because a signing key is made once, ever, and only deliberately.
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
 * there is no canonical serialisation for these tools and the Rust to agree
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

import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { b64u, issueLicence, PRIVATE_KEY, rawPublic, SIGNING_DIR, verifyLicence } from './licence-core.mjs';

const say = line => process.stdout.write(`${line}\n`);
const die = line => {
  process.stderr.write(`issue-licence: ${line}\n`);
  process.exit(1);
};

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

  let issued;
  try {
    issued = issueLicence({ name, email, trialMonths });
  } catch (refused) {
    die(refused instanceof Error ? refused.message : String(refused));
  }
  const { claims, licence } = issued;

  say('');
  say(`  ${claims.kind === 'trial' ? `Trial, ${trialMonths} month(s)` : 'Lifetime'} — ${name} <${email}>`);
  if (claims.expires !== undefined) {
    say(`  Ends ${new Date(claims.expires * 1000).toLocaleDateString('en-GB', {
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
  let claims;
  try {
    claims = verifyLicence(licence);
  } catch (refused) {
    die(refused instanceof Error ? refused.message : String(refused));
  }

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
  say('  node scripts/licence-desk.mjs');
  say('      The same, as a page — with a copy button and a record of every licence.');
  say('');
  process.exit(1);
}
