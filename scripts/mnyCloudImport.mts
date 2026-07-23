/**
 * MS Money → WealthTracker CLOUD migration (one-shot, destructive).
 *
 * Takes the transformed seed produced by scripts/mnyLocalImport.mts and
 * migrates it into the production Supabase under the user's account:
 *
 *   1. PREFLIGHT — the split-leg columns must exist (apply
 *      supabase/migrations/20260720120000_split_leg_transfers.sql first);
 *      exactly one target user must be identifiable.
 *   2. BACKUP   — every current row (accounts, categories, transactions,
 *      splits, budgets, goals, linked_accounts) is written to
 *      ~/WealthTracker-backups/ BEFORE anything is touched.
 *   3. WIPE     — deletes ALL of the user's financial data (FK order).
 *   4. IMPORT   — inserts the full Money dataset with fresh UUIDs, remapping
 *      every cross-reference (accounts, categories incl. To/From, transfer
 *      pairs, split-line transfer legs).
 *   5. VERIFY   — recounts, per-account ledger invariant
 *      (initial_balance + Σ transactions = balance), split reconciliation,
 *      transfer-pair and split-leg reciprocity. Decimal maths throughout.
 *
 * DRY RUN by default — prints the plan and stops before the wipe.
 * The destructive run requires BOTH flags: --execute --confirm-wipe
 *
 * Usage:
 *   npx tsx scripts/mnyCloudImport.mts <seed.json>                  # dry run
 *   npx tsx scripts/mnyCloudImport.mts <seed.json> --execute --confirm-wipe
 *
 * Notes:
 *   - Uses SUPABASE_SERVICE_ROLE_KEY from .env.local (never printed).
 *   - Bank connections (TrueLayer auth) are kept; the account-level links
 *     (linked_accounts) are cleared because the account rows they point at
 *     are replaced — re-link accounts in Settings → Banking afterwards.
 *   - Bypasses the app's audit-log RPCs by design (bulk migration).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const seedPath = args.find(a => !a.startsWith('--'));
const EXECUTE = args.includes('--execute');
const CONFIRM = args.includes('--confirm-wipe');
const VERIFY_ONLY = args.includes('--verify-only');
if (!seedPath) {
  console.error('usage: tsx scripts/mnyCloudImport.mts <seed.json> [--execute --confirm-wipe]');
  process.exit(1);
}

// ── Environment (never printed) ──────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// ── Seed ─────────────────────────────────────────────────────────────────────
interface SeedAccount {
  id: string; name: string; type: string; balance: number; openingBalance?: number;
  openingBalanceDate?: string; currency: string; isActive?: boolean; notes?: string;
  createdAt?: string;
}
interface SeedCategory {
  id: string; name: string; type: string; level: string; parentId?: string;
  isSystem?: boolean; isTransferCategory?: boolean; accountId?: string; isActive?: boolean;
}
interface SeedTransaction {
  id: string; date: string; description: string; amount: number; type: string;
  category?: string; accountId: string; notes?: string; cleared?: boolean;
  bankReference?: string; isSplit?: boolean; transferAccountId?: string;
  linkedTransferId?: string; linkedTransferSplitId?: string;
}
interface SeedSplit {
  id: string; transactionId: string; category: string; amount: number; memo?: string;
  sortOrder: number; transferAccountId?: string; linkedTransferId?: string;
}
const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
  accounts: SeedAccount[]; categories: SeedCategory[];
  transactions: SeedTransaction[]; transactionSplits: SeedSplit[];
};
console.log(`Seed: ${seed.accounts.length} accounts, ${seed.categories.length} categories, ` +
  `${seed.transactions.length} transactions, ${seed.transactionSplits.length} split lines`);

// ── Helpers ──────────────────────────────────────────────────────────────────
const fail = (msg: string): never => { console.error(`\nABORT: ${msg}`); process.exit(1); };

// Kept in step with src/services/import/msMoney/msMoneyImport.ts (not imported:
// this script runs standalone under tsx, outside the app's module graph).
const MS_MONEY_IMPORT_SOURCE = 'ms-money';
const IMPORT_PROVENANCE_CONFLICT = 'user_id,import_source,import_source_id';

async function fetchAll(table: string, filter?: { col: string; val: string }): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select('*').range(from, from + PAGE - 1);
    if (filter) q = q.eq(filter.col, filter.val);
    const { data, error } = await q;
    if (error) fail(`reading ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

async function insertAll(
  table: string, rows: Record<string, unknown>[], onConflict?: string
): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    // With a conflict target this becomes ON CONFLICT DO NOTHING — the
    // database refuses a duplicate instead of the script creating one.
    const { error } = onConflict
      ? await sb.from(table).upsert(slice, { onConflict, ignoreDuplicates: true })
      : await sb.from(table).insert(slice);
    if (error) fail(`inserting into ${table} (batch at ${i}): ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  if (rows.length) process.stdout.write('\n');
}

const dateOnly = (iso: string): string => iso.slice(0, 10);
// 'current' is stored as 'checking' (accountService translates on read).
const dbAccountType = (t: string): string => (t === 'current' ? 'checking' : t);

(async () => {
  // ── 1. Preflight ───────────────────────────────────────────────────────────
  const probe = await sb.from('transaction_splits').select('transfer_account_id').limit(1);
  const probe2 = await sb.from('transactions').select('linked_transfer_split_id').limit(1);
  if (probe.error || probe2.error) {
    const msg = 'split-leg columns missing — apply ' +
      'supabase/migrations/20260720120000_split_leg_transfers.sql first.';
    if (EXECUTE) fail(msg);
    console.log(`\nPREFLIGHT (dry run continues): ${msg}`);
  }
  const probe3 = await sb.from('transactions').select('import_source_id').limit(1);
  if (probe3.error) {
    const msg = 'import-provenance columns missing — apply ' +
      'supabase/migrations/20260722170000_transaction_import_provenance.sql first ' +
      '(without them the import is not idempotent).';
    if (EXECUTE) fail(msg);
    console.log(`\nPREFLIGHT (dry run continues): ${msg}`);
  }

  const { data: users, error: uerr } = await sb.from('users').select('id, email, clerk_id');
  if (uerr || !users?.length) fail(`cannot identify user: ${uerr?.message ?? 'no users'}`);
  if (users.length > 1) fail(`expected exactly 1 user, found ${users.length} — refusing to guess`);
  const userId = users[0].id as string;
  console.log(`Target user: ${users[0].email} (${userId})`);

  if (VERIFY_ONLY) {
    await verifyImport(userId, seed.transactionSplits.filter(s => s.amount !== 0).length);
    console.log('\nVERIFY-ONLY complete.');
    return;
  }

  // ── 2. Backup ──────────────────────────────────────────────────────────────
  const current: Record<string, Record<string, unknown>[]> = {};
  for (const t of ['accounts', 'categories', 'transactions', 'transaction_splits', 'budgets', 'goals']) {
    current[t] = await fetchAll(t, { col: 'user_id', val: userId });
  }
  const acctIds = new Set(current.accounts.map(a => String(a.id)));
  current.linked_accounts = (await fetchAll('linked_accounts')).filter(r => acctIds.has(String(r.account_id)));

  const backupDir = join(homedir(), 'WealthTracker-backups');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `prod-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backupPath, JSON.stringify({ userId, backedUpAt: new Date().toISOString(), ...current }));
  console.log(`\nBACKUP written: ${backupPath}`);
  for (const [t, rows] of Object.entries(current)) console.log(`  ${t}: ${rows.length} rows`);

  // ── Plan ───────────────────────────────────────────────────────────────────
  console.log('\nPLAN:');
  console.log(`  DELETE  ${current.accounts.length} accounts, ${current.transactions.length} transactions, ` +
    `${current.transaction_splits.length} splits, ${current.categories.length} categories, ` +
    `${current.budgets.length} budgets, ${current.goals.length} goals, ` +
    `${current.linked_accounts.length} bank-account links (connections kept — re-link in Settings)`);
  console.log(`  IMPORT  ${seed.accounts.length} accounts, ${seed.transactions.length} transactions, ` +
    `${seed.transactionSplits.length} split lines, ${seed.categories.length} categories`);

  if (!EXECUTE || !CONFIRM) {
    console.log('\nDRY RUN complete — nothing was changed.');
    console.log('To run for real: add --execute --confirm-wipe');
    return;
  }

  // ── 3. Wipe (FK order) ─────────────────────────────────────────────────────
  console.log('\nWIPING…');
  // Clear self-referential FKs first so row deletion order inside each table
  // cannot trip the references.
  {
    const { error } = await sb.from('transactions')
      .update({ linked_transfer_id: null, linked_transfer_split_id: null })
      .eq('user_id', userId).not('linked_transfer_id', 'is', null);
    if (error) fail(`unlinking transfers: ${error.message}`);
  }
  for (const [table, run] of [
    ['transaction_splits', () => sb.from('transaction_splits').delete().eq('user_id', userId)],
    ['transactions', () => sb.from('transactions').delete().eq('user_id', userId)],
    ['linked_accounts', () => sb.from('linked_accounts').delete().in('account_id', [...acctIds])],
    ['budgets', () => sb.from('budgets').delete().eq('user_id', userId)],
    ['goals', () => sb.from('goals').delete().eq('user_id', userId)],
    // Accounts BEFORE categories: the protect_transfer_category trigger
    // refuses to delete a To/From category while its account row exists —
    // deleting the account first cascades its transfer category away
    // (categories_account_id_fkey ON DELETE CASCADE), and the remaining
    // ordinary categories then delete freely.
    ['accounts', () => sb.from('accounts').delete().eq('user_id', userId)],
    ['categories', () => sb.from('categories').delete().eq('user_id', userId)],
  ] as Array<[string, () => PromiseLike<{ error: { message: string } | null }>]>) {
    const { error } = await run();
    if (error) fail(`wiping ${table}: ${error.message} (backup is at ${backupPath})`);
    console.log(`  wiped ${table}`);
  }

  // ── 4. Import ──────────────────────────────────────────────────────────────
  console.log('\nIMPORTING…');
  const acctMap = new Map(seed.accounts.map(a => [a.id, randomUUID()]));
  const catMap = new Map(seed.categories.map(c => [c.id, randomUUID()]));
  const txnMap = new Map(seed.transactions.map(t => [t.id, randomUUID()]));
  const splitMap = new Map(seed.transactionSplits.map(s => [s.id, randomUUID()]));
  const cat = (id?: string): string => (id && catMap.get(id)) || '';

  await insertAll('accounts', seed.accounts.map(a => ({
    id: acctMap.get(a.id),
    user_id: userId,
    name: a.name,
    type: dbAccountType(a.type),
    balance: a.balance,
    initial_balance: a.openingBalance ?? 0,
    opening_balance_date: a.openingBalanceDate ? dateOnly(a.openingBalanceDate) : null,
    currency: a.currency || 'GBP',
    is_active: a.isActive !== false,
    notes: a.notes ?? null,
    created_at: a.createdAt ?? new Date().toISOString(),
  })));

  await insertAll('categories', seed.categories.map(c => ({
    id: catMap.get(c.id),
    user_id: userId,
    name: c.name,
    type: c.type,
    level: c.level,
    parent_id: c.parentId ? catMap.get(c.parentId) : null,
    is_system: c.isSystem === true,
    is_transfer_category: c.isTransferCategory === true,
    account_id: c.accountId ? acctMap.get(c.accountId) : null,
    is_active: c.isActive !== false,
  })));

  // Transactions in TWO passes: linked transfer pairs reference EACH OTHER,
  // so no batch order can satisfy linked_transfer_id on insert (the FK is
  // checked per statement). Insert everything unlinked first, then upsert the
  // full rows of the linked ones with linked_transfer_id set.
  // (linked_transfer_split_id is a third pass — splits don't exist yet.)
  const txnRow = (t: SeedTransaction, withLink: boolean): Record<string, unknown> => ({
    id: txnMap.get(t.id),
    user_id: userId,
    account_id: acctMap.get(t.accountId),
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: dateOnly(t.date),
    category: t.isSplit ? '' : cat(t.category),
    notes: t.notes ?? null,
    is_cleared: t.cleared === true,
    is_split: t.isSplit === true,
    transfer_account_id: t.transferAccountId ? acctMap.get(t.transferAccountId) : null,
    linked_transfer_id: withLink && t.linkedTransferId ? txnMap.get(t.linkedTransferId) : null,
    is_recurring: false,
    metadata: t.bankReference ? { bankReference: t.bankReference } : {},
    // Import provenance (migration 20260722170000): the transform's stable
    // per-source id, so a second run is refused by the unique index instead of
    // duplicating the file. NOT external_transaction_id — that is the bank
    // feed's column and its dedupe/backfill logic keys off it.
    import_source: MS_MONEY_IMPORT_SOURCE,
    import_source_id: t.id,
  });
  await insertAll('transactions', seed.transactions.map(t => txnRow(t, false)), IMPORT_PROVENANCE_CONFLICT);

  const linkedTxns = seed.transactions.filter(t => t.linkedTransferId);
  {
    const BATCH = 500;
    for (let i = 0; i < linkedTxns.length; i += BATCH) {
      const { error } = await sb.from('transactions')
        .upsert(linkedTxns.slice(i, i + BATCH).map(t => txnRow(t, true)), { onConflict: 'id' });
      if (error) fail(`linking transfer pairs (batch at ${i}): ${error.message}`);
      process.stdout.write(`\r  transfer links: ${Math.min(i + BATCH, linkedTxns.length)}/${linkedTxns.length}`);
    }
    process.stdout.write('\n');
  }

  // The cloud schema requires every split line to be categorised
  // (transaction_splits_category_not_blank); Money split lines with no
  // category file under "Unassigned (MS Money import)" — same meaning,
  // now explicit.
  const unassigned = catMap.get('mny-unassigned');
  if (!unassigned) fail('seed is missing the mny-unassigned category');
  // Zero-amount lines are empty Money artifacts (no category, no memo, no
  // effect on any sum) and the cloud schema refuses them — drop, not remap.
  // Refuse if one is a transfer leg (would strand its counterpart).
  const zeroLegs = seed.transactionSplits.filter(s => s.amount === 0 && s.linkedTransferId);
  if (zeroLegs.length) fail(`zero-amount split line(s) that are transfer legs: ${zeroLegs.map(s => s.id).join(', ')}`);
  const importSplits = seed.transactionSplits.filter(s => s.amount !== 0);
  const droppedZero = seed.transactionSplits.length - importSplits.length;
  if (droppedZero) console.log(`  ${droppedZero} zero-amount empty split line(s) dropped (no effect on sums)`);
  const blankLines = importSplits.filter(s => !cat(s.category)).length;
  if (blankLines) console.log(`  ${blankLines} uncategorised split line(s) → Unassigned (MS Money import)`);
  await insertAll('transaction_splits', importSplits.map(s => ({
    id: splitMap.get(s.id),
    transaction_id: txnMap.get(s.transactionId),
    user_id: userId,
    category: cat(s.category) || unassigned,
    amount: s.amount,
    memo: s.memo ?? null,
    sort_order: s.sortOrder,
    transfer_account_id: s.transferAccountId ? acctMap.get(s.transferAccountId) : null,
    linked_transfer_id: s.linkedTransferId ? txnMap.get(s.linkedTransferId) : null,
  })));

  const pinned = seed.transactions.filter(t => t.linkedTransferSplitId);
  for (const t of pinned) {
    const { error } = await sb.from('transactions')
      .update({ linked_transfer_split_id: splitMap.get(t.linkedTransferSplitId as string) })
      .eq('id', txnMap.get(t.id) as string);
    if (error) fail(`pinning split leg on ${t.id}: ${error.message}`);
  }
  console.log(`  pinned ${pinned.length} split-leg counterparts`);

  // ── 5. Verify ──────────────────────────────────────────────────────────────
  await verifyImport(userId, importSplits.length);
  console.log(`\nDONE. Backup kept at ${backupPath}`);
  console.log('Re-link bank feeds: Settings → Banking → link accounts to the imported ones.');
})();

/** Full post-import verification — Decimal maths, fails the process on any breach. */
async function verifyImport(userId: string, expectedSplits: number): Promise<void> {
  console.log('\nVERIFYING…');
  const dbAccts = await fetchAll('accounts', { col: 'user_id', val: userId });
  const dbTxns = await fetchAll('transactions', { col: 'user_id', val: userId });
  const dbSplits = await fetchAll('transaction_splits', { col: 'user_id', val: userId });
  const dbCats = await fetchAll('categories', { col: 'user_id', val: userId });
  console.log(`  counts: ${dbAccts.length} accounts, ${dbTxns.length} transactions, ` +
    `${dbSplits.length} splits, ${dbCats.length} categories`);
  if (dbAccts.length !== seed.accounts.length) fail('account count mismatch');
  if (dbTxns.length !== seed.transactions.length) fail('transaction count mismatch');
  if (dbSplits.length !== expectedSplits) fail('split count mismatch');

  // Ledger invariant per account: initial_balance + Σ txns == balance
  const sums = new Map<string, Decimal>();
  for (const t of dbTxns) {
    const k = String(t.account_id);
    sums.set(k, (sums.get(k) ?? new Decimal(0)).plus(String(t.amount)));
  }
  let badLedger = 0;
  for (const a of dbAccts) {
    const computed = new Decimal(String(a.initial_balance ?? 0)).plus(sums.get(String(a.id)) ?? 0);
    if (!computed.equals(new Decimal(String(a.balance ?? 0)))) {
      badLedger++;
      console.log(`  LEDGER MISMATCH ${a.name}: stored ${a.balance}, computed ${computed}`);
    }
  }

  // Splits reconcile to parents
  const txnById = new Map(dbTxns.map(t => [String(t.id), t]));
  const byParent = new Map<string, Decimal>();
  for (const s of dbSplits) {
    const k = String(s.transaction_id);
    byParent.set(k, (byParent.get(k) ?? new Decimal(0)).plus(String(s.amount)));
  }
  let badSplits = 0;
  for (const [tid, sum] of byParent) {
    if (!sum.equals(new Decimal(String(txnById.get(tid)?.amount ?? NaN)))) badSplits++;
  }

  // Transfer reciprocity + split-leg consistency
  const splitById = new Map(dbSplits.map(s => [String(s.id), s]));
  const currencyByAcct = new Map(dbAccts.map(a => [String(a.id), String(a.currency ?? 'GBP')]));
  let linked = 0, unlinked = 0, badPairs = 0, legs = 0, badLegs = 0;
  let crossCurrencyPairs = 0;
  for (const t of dbTxns) {
    if (t.type !== 'transfer') continue;
    if (!t.linked_transfer_id) { unlinked++; continue; }
    linked++;
    if (t.linked_transfer_split_id) {
      legs++;
      const line = splitById.get(String(t.linked_transfer_split_id));
      const ok = line &&
        String(line.transaction_id) === String(t.linked_transfer_id) &&
        String(line.linked_transfer_id) === String(t.id) &&
        new Decimal(String(line.amount)).negated().equals(new Decimal(String(t.amount)));
      if (!ok) badLegs++;
    } else {
      const partner = txnById.get(String(t.linked_transfer_id));
      // Exact negation only applies when both accounts share a currency —
      // Money records each side of a cross-currency transfer in its own
      // currency (e.g. −$1,336.25 ↔ +£1,069.00), so those pairs only need
      // to be reciprocal.
      const sameCurrency = partner &&
        currencyByAcct.get(String(t.account_id)) === currencyByAcct.get(String(partner.account_id));
      if (partner && !sameCurrency) crossCurrencyPairs++;
      const ok = partner &&
        String(partner.linked_transfer_id) === String(t.id) &&
        (!sameCurrency ||
          new Decimal(String(partner.amount)).negated().equals(new Decimal(String(t.amount))));
      if (!ok) badPairs++;
    }
  }

  console.log(`  ledger invariant: ${dbAccts.length - badLedger}/${dbAccts.length} accounts OK`);
  console.log(`  splits reconcile: ${byParent.size - badSplits}/${byParent.size} OK`);
  console.log(`  transfers: ${linked} linked (${legs} split-leg, ` +
    `${crossCurrencyPairs} cross-currency legs), ${unlinked} unlinked, ` +
    `${badPairs} broken pairs, ${badLegs} broken legs`);

  if (badLedger || badSplits || badPairs || badLegs) {
    fail('verification FAILED — see ~/WealthTracker-backups for the pre-wipe backups');
  }
}
