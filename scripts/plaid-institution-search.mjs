#!/usr/bin/env node
/**
 * Does Plaid actually cover this bank?
 *
 * The gating question before any Plaid work: TrueLayer does not link Coutts,
 * which is the whole reason for looking at Plaid — and Plaid's public docs
 * render their institution list from JavaScript, so it cannot be read from
 * outside. This asks Plaid itself.
 *
 *   PLAID_CLIENT_ID=… PLAID_SECRET=… node scripts/plaid-institution-search.mjs Coutts
 *
 * Defaults to the SANDBOX host, which answers institution queries without
 * touching a live connection or spending a production call. Pass
 * --env=development or --env=production to ask the environment your keys
 * belong to — coverage can differ between them, and production is the one
 * that decides whether this is worth building.
 *
 * Your keys are read from the environment and never printed. Nothing here
 * writes, links, or authorises anything: /institutions/search is read-only.
 */

const HOSTS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};

const args = process.argv.slice(2);
const envArg = args.find(a => a.startsWith('--env='))?.split('=')[1] ?? 'sandbox';
const query = args.filter(a => !a.startsWith('--')).join(' ') || 'Coutts';

const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;

if (!clientId || !secret) {
  console.error(
    'Set PLAID_CLIENT_ID and PLAID_SECRET in the environment first.\n' +
    'They are in your Plaid dashboard under Team Settings → Keys.\n' +
    'Example:\n' +
    '  PLAID_CLIENT_ID=xxx PLAID_SECRET=yyy node scripts/plaid-institution-search.mjs Coutts'
  );
  process.exit(1);
}

const host = HOSTS[envArg];
if (!host) {
  console.error(`Unknown --env=${envArg}. Use sandbox, development or production.`);
  process.exit(1);
}

const response = await fetch(`${host}/institutions/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    secret,
    query,
    products: ['transactions'],
    country_codes: ['GB'],
  }),
});

const body = await response.json();

if (!response.ok) {
  // Plaid names its own failures well; pass the message through rather than
  // inventing one. Never echo the request body — it holds the secret.
  console.error(`Plaid said ${response.status}: ${body.error_code ?? ''} ${body.error_message ?? ''}`);
  process.exit(1);
}

const found = body.institutions ?? [];
console.log(`\n"${query}" in GB, ${envArg}, for transactions — ${found.length} match(es)\n`);

if (found.length === 0) {
  console.log('  Nothing. Either Plaid does not cover it in this environment, or it is');
  console.log('  listed under a different name — try the parent group (e.g. "NatWest").\n');
  process.exit(0);
}

for (const institution of found) {
  const oauth = institution.oauth ? 'OAuth' : 'credentials';
  console.log(`  ${institution.name}`);
  console.log(`    id: ${institution.institution_id}  ·  ${oauth}  ·  products: ${(institution.products ?? []).join(', ')}`);
  if (institution.status?.item_logins?.status) {
    console.log(`    login health right now: ${institution.status.item_logins.status}`);
  }
  console.log('');
}
