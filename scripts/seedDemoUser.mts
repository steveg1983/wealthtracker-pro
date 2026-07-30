/**
 * Create a demo login with a believable set of accounts and transactions.
 *
 * Makes the Clerk user (so the credentials work on the deployed app), the
 * `users` row, a clean generic category tree, four accounts and ~three months
 * of transactions — including uncleared July rows for the Reconciliation page,
 * a handful of unfiled rows for the Categorisation page, and an unmatched
 * equal-and-opposite pair for the transfer sweep to find.
 *
 * SAFE BY CONSTRUCTION:
 *  - every write is scoped to the demo user's freshly created id;
 *  - it REFUSES to run if that user already has categories, accounts or
 *    transactions — re-running cannot duplicate, and pointing it at an
 *    existing user cannot touch their data;
 *  - categories are inserted directly with fresh UUIDs, so the app's own
 *    first-login bootstrap sees them and does nothing.
 *
 * Transfer legs are linked by direct update (type/category/linked ids on both
 * sides), mirroring what the link_transfer_pair RPC does. A 2026-07-26 probe
 * concluded that RPC was absent in production; a later catalog check proved
 * it exists — the probe hit a stale PostgREST schema cache. The direct
 * update is kept anyway: it needs no RPC grant and is equally verifiable.
 *
 * Usage:
 *   npx tsx scripts/seedDemoUser.mts --email demo@example.com --password 'S3cret!' [--env .env.local]
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };

const EMAIL = flag('email') ?? fail('--email is required');
const PASSWORD = flag('password') ?? fail('--password is required');
const envPath = flag('env') ?? '.env.local';
if (!existsSync(envPath)) fail(`env file not found: ${envPath}`);

const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const url = env.VITE_SUPABASE_URL ?? fail('VITE_SUPABASE_URL missing');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? fail('SUPABASE_SERVICE_ROLE_KEY missing');
const clerkKey = env.CLERK_SECRET_KEY ?? fail('CLERK_SECRET_KEY missing');
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// ── 1. Clerk user ────────────────────────────────────────────────────────────

interface ClerkUser { id: string }

async function clerkFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

async function findOrCreateClerkUser(): Promise<string> {
  const lookup = await clerkFetch(`/users?email_address=${encodeURIComponent(EMAIL)}`);
  if (!lookup.ok) fail(`Clerk lookup failed: HTTP ${lookup.status}`);
  const existing = (await lookup.json()) as ClerkUser[];
  if (existing.length > 0) {
    console.log(`Clerk user already exists (${existing[0].id}) — reusing.`);
    return existing[0].id;
  }

  const created = await clerkFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [EMAIL],
      password: PASSWORD,
      first_name: 'Danielle',
      last_name: 'Demo',
      // A memorable demo password is the point; Clerk's breach-list check
      // would reject anything memorable.
      skip_password_checks: true,
    }),
  });
  if (!created.ok) {
    const body = await created.text();
    fail(`Clerk create failed: HTTP ${created.status} ${body}`);
  }
  const user = (await created.json()) as ClerkUser;
  console.log(`Clerk user created: ${user.id}`);
  return user.id;
}

// ── 2. users row ─────────────────────────────────────────────────────────────

async function findOrCreateDbUser(clerkId: string): Promise<string> {
  const { data: found, error: readErr } = await sb.from('users').select('id').eq('clerk_id', clerkId).maybeSingle();
  if (readErr) fail(`users read: ${readErr.message}`);
  if (found) { console.log(`users row already exists (${found.id}) — reusing.`); return found.id; }

  const { data: inserted, error: insErr } = await sb.from('users').insert({
    clerk_id: clerkId,
    email: EMAIL,
    first_name: 'Danielle',
    last_name: 'Demo',
    subscription_tier: 'pro',
    subscription_status: 'active',
  }).select('id').single();
  if (insErr || !inserted) fail(`users insert: ${insErr?.message}`);
  console.log(`users row created: ${inserted.id}`);
  return inserted.id;
}

const clerkId = await findOrCreateClerkUser();
const USER = await findOrCreateDbUser(clerkId);

// ── 3. The guard: never seed on top of existing data ─────────────────────────

for (const table of ['categories', 'accounts', 'transactions'] as const) {
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', USER);
  if (error) fail(`${table} count: ${error.message}`);
  if ((count ?? 0) > 0) fail(`user ${USER} already has ${count} ${table} — refusing to seed twice`);
}

// ── 4. Categories: minimal system set + a clean generic tree ─────────────────

interface CatSeed {
  name: string; type: 'income' | 'expense' | 'both'; level: 'type' | 'sub' | 'detail';
  parent?: string; isSystem?: boolean; isTransfer?: boolean; isRevaluation?: boolean;
}

const CAT_SEEDS: CatSeed[] = [
  { name: 'Income', type: 'income', level: 'type', isSystem: true },
  { name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { name: 'Transfer', type: 'both', level: 'type', isSystem: true, isTransfer: true },
  { name: 'Transfer In', type: 'both', level: 'detail', parent: 'Transfer', isSystem: true, isTransfer: true },
  { name: 'Transfer Out', type: 'both', level: 'detail', parent: 'Transfer', isSystem: true, isTransfer: true },
  { name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluation: true },
  { name: 'Market Value Change', type: 'both', level: 'detail', parent: 'Revaluation', isSystem: true, isRevaluation: true },
  { name: 'Account Adjustment', type: 'both', level: 'detail', parent: 'Revaluation', isSystem: true, isRevaluation: true },

  { name: 'Salary & Wages', type: 'income', level: 'sub', parent: 'Income' },
  { name: 'Salary', type: 'income', level: 'detail', parent: 'Salary & Wages' },
  { name: 'Bonus', type: 'income', level: 'detail', parent: 'Salary & Wages' },
  { name: 'Savings & Investments', type: 'income', level: 'sub', parent: 'Income' },
  { name: 'Bank Interest', type: 'income', level: 'detail', parent: 'Savings & Investments' },
  { name: 'Dividends', type: 'income', level: 'detail', parent: 'Savings & Investments' },
  { name: 'Other Income', type: 'income', level: 'sub', parent: 'Income' },
  { name: 'Refunds', type: 'income', level: 'detail', parent: 'Other Income' },

  { name: 'Home', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Rent', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Council Tax', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Gas & Electricity', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Water', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Internet & TV', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Home Insurance', type: 'expense', level: 'detail', parent: 'Home' },
  { name: 'Food & Drink', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Groceries', type: 'expense', level: 'detail', parent: 'Food & Drink' },
  { name: 'Dining Out', type: 'expense', level: 'detail', parent: 'Food & Drink' },
  { name: 'Coffee & Snacks', type: 'expense', level: 'detail', parent: 'Food & Drink' },
  { name: 'Takeaway', type: 'expense', level: 'detail', parent: 'Food & Drink' },
  { name: 'Transport', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Public Transport', type: 'expense', level: 'detail', parent: 'Transport' },
  { name: 'Taxi', type: 'expense', level: 'detail', parent: 'Transport' },
  { name: 'Rail', type: 'expense', level: 'detail', parent: 'Transport' },
  { name: 'Lifestyle', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Subscriptions', type: 'expense', level: 'detail', parent: 'Lifestyle' },
  { name: 'Gym & Fitness', type: 'expense', level: 'detail', parent: 'Lifestyle' },
  { name: 'Clothes', type: 'expense', level: 'detail', parent: 'Lifestyle' },
  { name: 'Gifts', type: 'expense', level: 'detail', parent: 'Lifestyle' },
  { name: 'Entertainment', type: 'expense', level: 'detail', parent: 'Lifestyle' },
  { name: 'Health', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Pharmacy', type: 'expense', level: 'detail', parent: 'Health' },
  { name: 'Dental', type: 'expense', level: 'detail', parent: 'Health' },
  { name: 'Money', type: 'expense', level: 'sub', parent: 'Expense' },
  { name: 'Bank Charges', type: 'expense', level: 'detail', parent: 'Money' },
];

const catId = new Map<string, string>(CAT_SEEDS.map(c => [c.name, randomUUID()]));
const catRows = CAT_SEEDS.map(c => ({
  id: catId.get(c.name),
  user_id: USER,
  name: c.name,
  type: c.type,
  level: c.level,
  parent_id: c.parent ? catId.get(c.parent) : null,
  is_system: c.isSystem ?? false,
  is_transfer_category: c.isTransfer ?? false,
  is_revaluation_category: c.isRevaluation ?? false,
  is_active: true,
}));
{
  const { error } = await sb.from('categories').insert(catRows);
  if (error) fail(`categories insert: ${error.message}`);
  console.log(`categories: ${catRows.length} created`);
}
const cat = (name: string): string => catId.get(name) ?? fail(`unknown category ${name}`);

// ── 5. Accounts ──────────────────────────────────────────────────────────────

interface AccountSeed { key: string; name: string; type: string; initial: number; institution: string }
const ACCOUNT_SEEDS: AccountSeed[] = [
  { key: 'current', name: 'Everyday Current Account', type: 'checking', initial: 1850.00, institution: 'Barclays' },
  { key: 'saver', name: 'Rainy Day Saver', type: 'savings', initial: 6200.00, institution: 'Barclays' },
  { key: 'amex', name: 'Gold Rewards Card', type: 'credit', initial: 0, institution: 'American Express' },
  { key: 'isa', name: 'Stocks & Shares ISA', type: 'investment', initial: 14500.00, institution: 'Vanguard' },
];
const acctId = new Map<string, string>(ACCOUNT_SEEDS.map(a => [a.key, randomUUID()]));
{
  const { error } = await sb.from('accounts').insert(ACCOUNT_SEEDS.map(a => ({
    id: acctId.get(a.key),
    user_id: USER,
    name: a.name,
    type: a.type,
    currency: 'GBP',
    balance: a.initial, // corrected after transactions land
    initial_balance: a.initial,
    institution: a.institution,
    is_active: true,
  })));
  if (error) fail(`accounts insert: ${error.message}`);
  console.log(`accounts: ${ACCOUNT_SEEDS.length} created`);
}
const acct = (key: string): string => acctId.get(key) ?? fail(`unknown account ${key}`);

// ── 6. Transactions ──────────────────────────────────────────────────────────

interface TxnSeed {
  id: string; account: string; date: string; description: string;
  amount: number; type: 'income' | 'expense' | 'transfer'; category: string | null;
}
const txns: TxnSeed[] = [];
const CLEARED_UP_TO = '2026-07-10'; // later rows stay uncleared for the Reconciliation demo

const add = (account: string, date: string, description: string, amount: number, category: string | null): TxnSeed => {
  const t: TxnSeed = {
    id: randomUUID(), account, date, description, amount,
    type: amount >= 0 ? 'income' : 'expense',
    category,
  };
  txns.push(t);
  return t;
};

/** A linked transfer: two legs, opposite amounts, joined the way the app joins them. */
const transferPairs: Array<{ out: TxnSeed; into: TxnSeed }> = [];
const addTransfer = (fromAcct: string, toAcct: string, date: string, description: string, amount: number): void => {
  const out = add(fromAcct, date, description, -amount, cat('Transfer Out'));
  const into = add(toAcct, date, description, amount, cat('Transfer In'));
  out.type = 'transfer';
  into.type = 'transfer';
  transferPairs.push({ out, into });
};

// Rounded-but-not-round figures read as real; dates land on weekday-ish spreads.
for (const [m, salaryDay] of [['05', '2026-05-22'], ['06', '2026-06-25'], ['07', '2026-07-24']] as const) {
  add('current', salaryDay, 'ACME DESIGN STUDIO LTD — SALARY', 2741.52, cat('Salary'));
  add('current', `2026-${m}-01`, 'MARLOW COURT LETTINGS — RENT', -1150.00, cat('Rent'));
  add('current', `2026-${m}-01`, 'HACKNEY COUNCIL — COUNCIL TAX', -156.00, cat('Council Tax'));
  add('current', `2026-${m}-03`, 'OCTOPUS ENERGY', -92.40, cat('Gas & Electricity'));
  add('current', `2026-${m}-05`, 'THAMES WATER', -41.20, cat('Water'));
  add('current', `2026-${m}-07`, 'BT BROADBAND & TV', -35.99, cat('Internet & TV'));
  add('current', `2026-${m}-08`, 'ADMIRAL HOME INSURANCE', -14.85, cat('Home Insurance'));
  add('current', `2026-${m}-10`, 'PUREGYM LONDON FIELDS', -34.00, cat('Gym & Fitness'));
  add('current', `2026-${m}-12`, 'NETFLIX.COM', -10.99, cat('Subscriptions'));
  add('current', `2026-${m}-15`, 'SPOTIFY UK', -11.99, cat('Subscriptions'));
  add('current', `2026-${m}-16`, 'GIFFGAFF MOBILE', -12.00, cat('Subscriptions'));

  add('current', `2026-${m}-02`, 'TESCO STORES 3417', -58.12, cat('Groceries'));
  add('current', `2026-${m}-09`, "SAINSBURY'S LOCAL", -42.76, cat('Groceries'));
  add('current', `2026-${m}-16`, 'ALDI STORES LONDON', -63.44, cat('Groceries'));
  add('current', `2026-${m}-23`, 'TESCO STORES 3417', -71.08, cat('Groceries'));

  add('current', `2026-${m}-04`, 'PRET A MANGER', -4.65, cat('Coffee & Snacks'));
  add('current', `2026-${m}-11`, "GAIL'S BAKERY", -6.20, cat('Coffee & Snacks'));
  add('current', `2026-${m}-18`, 'COSTA COFFEE', -3.85, cat('Coffee & Snacks'));

  add('current', `2026-${m}-06`, 'TFL TRAVEL CHARGE', -6.70, cat('Public Transport'));
  add('current', `2026-${m}-13`, 'TFL TRAVEL CHARGE', -8.40, cat('Public Transport'));
  add('current', `2026-${m}-20`, 'TFL TRAVEL CHARGE', -5.60, cat('Public Transport'));
  add('current', `2026-${m}-21`, 'UBER TRIP', -14.50, cat('Taxi'));

  add('current', `2026-${m}-14`, 'FRANCO MANCA E8', -31.40, cat('Dining Out'));
  add('current', `2026-${m}-19`, 'DELIVEROO', -26.85, cat('Takeaway'));

  // Amex spending
  add('amex', `2026-${m}-05`, 'AMAZON.CO.UK', -23.99, cat('Entertainment'));
  add('amex', `2026-${m}-09`, 'ASOS.COM', -54.00, cat('Clothes'));
  add('amex', `2026-${m}-13`, 'BOOTS 1123 LONDON', -18.75, cat('Pharmacy'));
  add('amex', `2026-${m}-17`, 'TRAINLINE', -45.20, cat('Rail'));
  add('amex', `2026-${m}-22`, 'JOHN LEWIS OXFORD ST', -62.50, cat('Gifts'));

  // Standing orders into savings and the ISA
  addTransfer('current', 'saver', `2026-${m}-26`, 'STANDING ORDER — RAINY DAY', 300.00);
  addTransfer('current', 'isa', `2026-${m}-27`, 'STANDING ORDER — VANGUARD ISA', 200.00);
}

// Amex is paid in full a month behind: May's bill in June, June's in July.
addTransfer('current', 'amex', '2026-06-10', 'AMEX PAYMENT RECEIVED — THANK YOU', 204.44);
addTransfer('current', 'amex', '2026-07-10', 'AMEX PAYMENT RECEIVED — THANK YOU', 204.44);

// Savings interest (May and June paid; July not due yet)
add('saver', '2026-05-31', 'INTEREST PAID', 6.14, cat('Bank Interest'));
add('saver', '2026-06-30', 'INTEREST PAID', 6.42, cat('Bank Interest'));

// ISA revaluations: value moved, nothing was earned or spent.
add('isa', '2026-05-29', 'MARKET VALUE UPDATE', 212.40, cat('Market Value Change'));
add('isa', '2026-06-30', 'MARKET VALUE UPDATE', -148.16, cat('Market Value Change'));
add('isa', '2026-07-15', 'MARKET VALUE UPDATE', 327.85, cat('Market Value Change'));

// One refund, so income isn't only salary
add('current', '2026-06-18', 'ASOS.COM REFUND', 22.00, cat('Refunds'));

// Left UNFILED on purpose: the Categorisation page needs work to show.
add('current', '2026-07-18', 'CARD PAYMENT 4471 LONDON', -32.50, null);
add('amex', '2026-07-19', 'AMZNMKTPLACE AMAZON.CO.UK', -16.20, null);
add('current', '2026-07-21', 'CONTACTLESS 9912', -8.90, null);
add('current', '2026-07-22', 'FPS CREDIT J SMITH', 25.00, null);
// ...including one equal-and-opposite pair for the transfer sweep to find.
add('current', '2026-07-20', 'MOBILE TRANSFER 3319', -150.00, null);
add('saver', '2026-07-20', 'MOBILE TRANSFER 3319', 150.00, null);

// ── 7. Insert, link, and set balances ────────────────────────────────────────

{
  const rows = txns.map(t => ({
    id: t.id,
    user_id: USER,
    account_id: acct(t.account),
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category,
    is_cleared: t.date <= CLEARED_UP_TO,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('transactions').insert(rows.slice(i, i + 200));
    if (error) fail(`transactions insert (batch ${i}): ${error.message}`);
  }
  console.log(`transactions: ${rows.length} created`);
}

for (const { out, into } of transferPairs) {
  for (const [leg, other] of [[out, into], [into, out]] as const) {
    const { error } = await sb.from('transactions')
      .update({ transfer_account_id: acct(other.account), linked_transfer_id: other.id })
      .eq('id', leg.id).eq('user_id', USER);
    if (error) fail(`transfer link (${leg.description}): ${error.message}`);
  }
}
console.log(`transfers: ${transferPairs.length} pairs linked`);

for (const a of ACCOUNT_SEEDS) {
  const sum = txns.filter(t => t.account === a.key).reduce((s, t) => s + Math.round(t.amount * 100), 0);
  const balance = (Math.round(a.initial * 100) + sum) / 100;
  const { error } = await sb.from('accounts').update({ balance }).eq('id', acct(a.key)).eq('user_id', USER);
  if (error) fail(`balance update (${a.name}): ${error.message}`);
  console.log(`  ${a.name}: £${balance.toFixed(2)}`);
}

// ── 8. Read back and prove it ────────────────────────────────────────────────

for (const table of ['categories', 'accounts', 'transactions'] as const) {
  const { count } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', USER);
  console.log(`verify ${table}: ${count}`);
}
const { count: unfiled } = await sb.from('transactions')
  .select('id', { count: 'exact', head: true }).eq('user_id', USER).is('category', null);
console.log(`verify unfiled rows (Categorisation demo): ${unfiled}`);
console.log('DONE');
