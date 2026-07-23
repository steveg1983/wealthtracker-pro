/**
 * What does the app report for a period, straight from the database?
 *
 * A cross-check for the question "the app says X and my old software says Y" —
 * the one that found the MS Money import's duplicate rows. It answers with the
 * SAME classifier the UI uses (`computeIncomeExpense`), imported directly: a
 * second implementation of the rules in SQL that agreed would prove nothing,
 * and one that disagreed would not say which of the two was wrong.
 *
 * READ-ONLY. It issues nothing but SELECTs, and pages every one of them —
 * PostgREST caps a request at 1000 rows and returns the truncation silently,
 * which is exactly how a balance was once reported £67k adrift.
 *
 * Prints totals and per-group subtotals. Never a payee, never an account name.
 *
 * Usage:
 *   npx tsx scripts/periodTotals.mts --from 2026-05-01 --to 2026-05-31
 *   npx tsx scripts/periodTotals.mts --from 2026-01-01 --to 2026-12-31 --env .env.scratch
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { computeIncomeExpense } from '../src/utils/incomeExpense.ts';
import type { Category, Transaction, TransactionSplit } from '../src/types';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const FROM = flag('from');
const TO = flag('to');
const envPath = flag('env') ?? '.env.local';
const userOverride = flag('user');

const fail = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
if (!FROM || !TO) fail('usage: tsx scripts/periodTotals.mts --from YYYY-MM-DD --to YYYY-MM-DD [--env .env.local] [--user <uuid>]');
if (!ISO_DAY.test(FROM) || !ISO_DAY.test(TO)) fail('--from and --to must be YYYY-MM-DD');
if (FROM > TO) fail(`--from (${FROM}) is after --to (${TO})`);
if (!existsSync(envPath)) fail(`env file not found: ${envPath}`);

const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail(`Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envPath}`);
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

interface DbCategory {
  id: string; name: string; type: string | null; parent_id: string | null;
  level: string | null; is_transfer_category: boolean | null;
  is_revaluation_category: boolean | null; is_unassigned_bucket: boolean | null;
}
interface DbTransaction {
  id: string; date: string; description: string | null; account_id: string;
  amount: string | number; type: string; category: string | null; is_split: boolean | null;
}
interface DbSplit { id: string; transaction_id: string; amount: string | number; category: string | null; memo: string | null }

/** Resolve the user whose data this is, refusing to guess between several. */
async function resolveUser(): Promise<string> {
  if (userOverride) return userOverride;
  const { data, error } = await sb.from('users').select('id').limit(5).returns<Array<{ id: string }>>();
  if (error) fail(`reading users: ${error.message}`);
  const users = data ?? [];
  if (users.length === 1) return users[0].id;
  fail(`${users.length} users in this database — say which with --user <uuid>`);
}

const USER = await resolveUser();

/** Every SELECT here is paged: a silent 1000-row truncation is a wrong answer. */
async function page<T>(table: string, cols: string, narrow?: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const query = narrow
      ? narrow(from)
      : sb.from(table).select(cols).eq('user_id', USER).order('id').range(from, from + PAGE - 1).returns<T[]>();
    const { data, error } = await query;
    if (error) fail(`reading ${table}: ${error.message}`);
    const got: T[] = data ?? [];
    rows.push(...got);
    if (got.length < PAGE) return rows;
  }
}

const PAGE = 1000;
const cats = await page<DbCategory>('categories', 'id,name,type,parent_id,level,is_transfer_category,is_revaluation_category,is_unassigned_bucket');
const txns = await page<DbTransaction>('transactions', '', from => sb
  .from('transactions')
  .select('id,date,description,account_id,amount,type,category,is_split')
  .eq('user_id', USER).gte('date', FROM).lte('date', TO)
  .order('id').range(from, from + PAGE - 1).returns<DbTransaction[]>());
const txnIds = new Set(txns.map(t => t.id));
const splits = (await page<DbSplit>('transaction_splits', 'id,transaction_id,amount,category,memo'))
  .filter(s => txnIds.has(s.transaction_id));

const categories: Category[] = cats.map(c => ({
  id: c.id,
  name: c.name,
  type: (c.type === 'income' || c.type === 'expense' || c.type === 'both') ? c.type : 'both',
  level: (c.level === 'type' || c.level === 'sub' || c.level === 'detail') ? c.level : 'detail',
  parentId: c.parent_id ?? undefined,
  isTransferCategory: c.is_transfer_category ?? undefined,
  isRevaluationCategory: c.is_revaluation_category ?? undefined,
  isUnassignedBucket: c.is_unassigned_bucket ?? undefined,
}));
const transactions: Transaction[] = txns.map(t => ({
  id: t.id,
  date: new Date(`${t.date.slice(0, 10)}T00:00:00.000Z`),
  description: t.description ?? '',
  accountId: t.account_id,
  amount: Number(t.amount),
  type: t.type === 'income' || t.type === 'transfer' ? t.type : 'expense',
  category: t.category ?? '',
  cleared: false,
  isSplit: t.is_split === true,
}));
const transactionSplits: TransactionSplit[] = splits.map(s => ({
  id: s.id,
  transactionId: s.transaction_id,
  amount: Number(s.amount),
  category: s.category ?? '',
  description: s.memo ?? undefined,
}));

const result = computeIncomeExpense(transactions, transactionSplits, categories);
const gbp = (value: number): string =>
  `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

console.log(`Period ${FROM} … ${TO}`);
console.log(`${transactions.length} transactions, ${transactionSplits.length} split lines\n`);
console.log(`  Total income          : ${gbp(result.income.toNumber())}  (${result.incomeRows.length} rows)`);
console.log(`  Total expenses        : ${gbp(result.expenses.toNumber())}  (${result.expenseRows.length} rows)`);
console.log(`  Income less expenses  : ${gbp(result.income.minus(result.expenses).toNumber())}`);
console.log(`\n  EXCLUDED, no category : ${result.uncategorizedRows.length} rows ` +
  `(in ${gbp(result.uncategorizedIn.toNumber())}, out ${gbp(result.uncategorizedOut.toNumber())})`);

const byId = new Map(categories.map(c => [c.id, c]));
/** The nearest 'sub'-level ancestor — the level Money's reports subtotal at. */
const groupOf = (id: string): string => {
  const seen = new Set<string>();
  let current = byId.get(id);
  let fallback = current?.name ?? '(no category)';
  while (current && !seen.has(current.id)) {
    if (current.level === 'sub') return current.name;
    seen.add(current.id);
    fallback = current.name;
    const parent = current.parentId ? byId.get(current.parentId) : undefined;
    if (!parent || parent.level === 'type') break;
    current = parent;
  }
  return fallback;
};

for (const [label, rows, sign] of [
  ['EXPENSES BY GROUP', result.expenseRows, -1],
  ['INCOME BY GROUP', result.incomeRows, 1],
] as const) {
  if (!rows.length) continue;
  const totals = new Map<string, number>();
  for (const row of rows) {
    const group = groupOf(row.category);
    totals.set(group, (totals.get(group) ?? 0) + row.amount * sign);
  }
  console.log(`\n${label}`);
  for (const [group, value] of [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${gbp(value).padStart(13)}  ${group}`);
  }
}
