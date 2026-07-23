/**
 * What is actually IN the uncategorised review band?
 *
 * Rows with no category are excluded from every report by design (direction is
 * never guessed). That is the right rule and it leaves a question: what is
 * sitting in there, and which of it is a report bug rather than data the user
 * genuinely has to file?
 *
 * This classifies the band by evidence rather than by guessing:
 *   - is the row half of a transfer that simply is not tagged as one? (a
 *     matching opposite amount, same day or near it, in another account)
 *   - does the same payee appear elsewhere WITH a category, so the answer is
 *     already in the data?
 *   - is it a bank-feed row the Money file never had?
 *   - or is it genuinely novel — a payee seen nowhere else?
 *
 * READ-ONLY. Every read is paged. Prints counts, amounts and payee shapes;
 * payee text is truncated and only shown for the largest groups, because this
 * output is read in a chat transcript.
 *
 * Usage:
 *   npx tsx scripts/reviewBand.mts --user <uuid> [--from 2025-07-01] [--to 2026-06-30]
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildCategoryKindLookup, classifyFlow } from '../src/utils/incomeExpense.ts';
import { toDecimal } from '../src/utils/decimal.ts';
import type { Category } from '../src/types';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const envPath = flag('env') ?? '.env.local';
const FROM = flag('from');
const TO = flag('to');
const userOverride = flag('user');
/** Days either side within which an opposite amount counts as the other leg. */
const PAIR_WINDOW_DAYS = Number(flag('window') ?? 3);

const fail = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };
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
}
interface DbTransaction {
  id: string; date: string; description: string | null; account_id: string;
  amount: string | number; type: string; category: string | null;
  external_transaction_id: string | null;
}
interface DbAccount { id: string; name: string }

async function resolveUser(): Promise<string> {
  if (userOverride) return userOverride;
  const { data, error } = await sb.from('users').select('id').limit(5).returns<Array<{ id: string }>>();
  if (error) fail(`reading users: ${error.message}`);
  const users = data ?? [];
  if (users.length === 1) return users[0].id;
  return fail(`${users.length} users in this database — say which with --user <uuid>`);
}
const USER = await resolveUser();

const PAGE = 1000;
/** Paged, always: PostgREST truncates at 1000 rows without saying so. */
async function pageAll<T>(build: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from);
    if (error) fail(error.message);
    const got: T[] = data ?? [];
    rows.push(...got);
    if (got.length < PAGE) return rows;
  }
}

const cats = await pageAll<DbCategory>(from => sb.from('categories')
  .select('id,name,type,parent_id,level,is_transfer_category')
  .eq('user_id', USER).order('id').range(from, from + PAGE - 1).returns<DbCategory[]>());
const accounts = await pageAll<DbAccount>(from => sb.from('accounts')
  .select('id,name').eq('user_id', USER).order('id').range(from, from + PAGE - 1).returns<DbAccount[]>());
const txns = await pageAll<DbTransaction>(from => {
  let q = sb.from('transactions')
    .select('id,date,description,account_id,amount,type,category,external_transaction_id')
    .eq('user_id', USER);
  if (FROM) q = q.gte('date', FROM);
  if (TO) q = q.lte('date', TO);
  return q.order('id').range(from, from + PAGE - 1).returns<DbTransaction[]>();
});

const categories: Category[] = cats.map(c => ({
  id: c.id,
  name: c.name,
  type: (c.type === 'income' || c.type === 'expense' || c.type === 'both') ? c.type : 'both',
  level: (c.level === 'type' || c.level === 'sub' || c.level === 'detail') ? c.level : 'detail',
  parentId: c.parent_id ?? undefined,
  isTransferCategory: c.is_transfer_category ?? undefined,
}));
const kinds = buildCategoryKindLookup(categories);
const accountName = new Map(accounts.map(a => [a.id, a.name]));

const pence = (v: string | number): number => Math.round(Number(toDecimal(String(v)).times(100)));
const gbp = (p: number): string =>
  `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string): string => d.slice(0, 10);
const dayNumber = (d: string): number => Math.floor(Date.parse(`${day(d)}T00:00:00.000Z`) / 86_400_000);

/** Normalise a payee enough to recognise the same one twice. */
const payeeKey = (description: string | null): string =>
  (description ?? '')
    .toUpperCase()
    .replace(/\d{4,}/g, ' ')          // card/reference numbers
    .replace(/[^A-Z& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const band = txns.filter(t => classifyFlow(
  { type: t.type === 'income' || t.type === 'transfer' ? t.type : 'expense', category: t.category ?? '' },
  kinds
) === 'uncategorized');

console.log(`Scope: ${FROM ?? 'all time'} … ${TO ?? 'all time'}`);
console.log(`${txns.length} transactions, of which ${band.length} are in the review band ` +
  `(${((band.length / Math.max(txns.length, 1)) * 100).toFixed(1)}%)\n`);

// ── 1. Unlabelled transfers: an opposite amount in another account, near in time
const byAmount = new Map<number, DbTransaction[]>();
for (const t of txns) {
  const key = Math.abs(pence(t.amount));
  const g = byAmount.get(key);
  if (g) g.push(t); else byAmount.set(key, [t]);
}

const pairedIds = new Set<string>();
let pairedBothInBand = 0;
let pairedOtherSideFiled = 0;
for (const row of band) {
  const amount = pence(row.amount);
  if (amount === 0) continue;
  const candidates = byAmount.get(Math.abs(amount)) ?? [];
  const match = candidates.find(other =>
    other.id !== row.id &&
    other.account_id !== row.account_id &&
    pence(other.amount) === -amount &&
    Math.abs(dayNumber(other.date) - dayNumber(row.date)) <= PAIR_WINDOW_DAYS &&
    !pairedIds.has(other.id)
  );
  if (!match) continue;
  pairedIds.add(row.id);
  pairedIds.add(match.id);
  const otherInBand = classifyFlow(
    { type: match.type === 'income' || match.type === 'transfer' ? match.type : 'expense', category: match.category ?? '' },
    kinds
  ) === 'uncategorized';
  if (otherInBand) pairedBothInBand++; else pairedOtherSideFiled++;
}

const unpaired = band.filter(t => !pairedIds.has(t.id));
const sumAbs = (rows: DbTransaction[]): number => rows.reduce((s, r) => s + Math.abs(pence(r.amount)), 0);

console.log('1. LOOKS LIKE AN UNTAGGED TRANSFER');
console.log(`   an equal and opposite amount sits in another account within ±${PAIR_WINDOW_DAYS} days`);
console.log(`   band rows paired          : ${band.length - unpaired.length}  (${gbp(sumAbs(band.filter(t => pairedIds.has(t.id))))} gross)`);
console.log(`     …both legs uncategorised: ${pairedBothInBand}`);
console.log(`     …other leg already filed: ${pairedOtherSideFiled}`);

// ── 2. Of the rest, is the payee already filed elsewhere?
const filedByPayee = new Map<string, Map<string, number>>();
for (const t of txns) {
  if (!t.category) continue;
  const kind = classifyFlow(
    { type: t.type === 'income' || t.type === 'transfer' ? t.type : 'expense', category: t.category },
    kinds
  );
  if (kind === 'uncategorized') continue;
  const key = payeeKey(t.description);
  if (!key) continue;
  const counts = filedByPayee.get(key) ?? new Map<string, number>();
  counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  filedByPayee.set(key, counts);
}

const answerable = unpaired.filter(t => filedByPayee.has(payeeKey(t.description)));
const novel = unpaired.filter(t => !filedByPayee.has(payeeKey(t.description)));

console.log('\n2. THE ANSWER IS ALREADY IN THE DATA');
console.log('   the same payee appears elsewhere WITH a category');
console.log(`   band rows                 : ${answerable.length}  (${gbp(sumAbs(answerable))} gross)`);

console.log('\n3. GENUINELY NEW — payee seen nowhere else, or no description at all');
console.log(`   band rows                 : ${novel.length}  (${gbp(sumAbs(novel))} gross)`);
const blank = novel.filter(t => !payeeKey(t.description));
console.log(`     …of which no description: ${blank.length}`);

// ── Provenance and shape of what remains
const feedRows = unpaired.filter(t => t.external_transaction_id != null);
console.log('\nPROVENANCE OF THE UNPAIRED REMAINDER');
console.log(`   from the bank feed        : ${feedRows.length}`);
console.log(`   from the Money file       : ${unpaired.length - feedRows.length}`);

console.log('\nWHERE THE UNPAIRED ROWS SIT');
const byAccount = new Map<string, { n: number; gross: number }>();
for (const t of unpaired) {
  const e = byAccount.get(t.account_id) ?? { n: 0, gross: 0 };
  e.n++; e.gross += Math.abs(pence(t.amount));
  byAccount.set(t.account_id, e);
}
for (const [id, e] of [...byAccount.entries()].sort((a, b) => b[1].gross - a[1].gross).slice(0, 12)) {
  console.log(`   ${String(e.n).padStart(5)} rows  ${gbp(e.gross).padStart(15)}  ${accountName.get(id) ?? id}`);
}

// ── How much of "answerable" is safely answerable?
//
// A payee only predicts a category if it AGREES with itself. "BOOTS" filed
// under Food Shopping 125 times out of 130 predicts; "ADJUSTMENT" filed under
// ten different things predicts nothing, and auto-filing it would invent data
// rather than recover it. The threshold is what separates a suggestion worth
// applying from one worth showing.
const MIN_SAMPLES = 3;
const MIN_AGREEMENT = 0.8;
interface Verdict { confident: boolean; category: string; agreement: number; samples: number }
const verdictFor = (description: string | null): Verdict | null => {
  const counts = filedByPayee.get(payeeKey(description));
  if (!counts) return null;
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const samples = entries.reduce((s, [, n]) => s + n, 0);
  const [category, top] = entries[0];
  const agreement = top / samples;
  return { confident: samples >= MIN_SAMPLES && agreement >= MIN_AGREEMENT, category, agreement, samples };
};

const confident = answerable.filter(t => verdictFor(t.description)?.confident === true);
const unsure = answerable.filter(t => verdictFor(t.description)?.confident === false);

console.log('\n2a. …AND HOW MUCH OF THAT IS SAFE TO ACT ON');
console.log(`   the payee agrees with itself (≥${MIN_SAMPLES} filings, ≥${MIN_AGREEMENT * 100}% one category)`);
console.log(`   confident                 : ${confident.length}  (${gbp(sumAbs(confident))} gross)`);
console.log(`   payee filed inconsistently: ${unsure.length}  (${gbp(sumAbs(unsure))} gross)` +
  ' — a suggestion here would invent data, not recover it');

// ── What payee memory itself would do, by its own rule
//
// The analysis above normalises payee text and looks across accounts, which is
// looser than the shipped `payee_memory_category`: that matches the EXACT
// description within ONE account for the same direction, and returns the most
// common category with no minimum sample count and no agreement threshold.
// Measuring the shipped rule directly is the difference between a real risk and
// an exaggerated one.
interface Memory { category: string; top: number; samples: number }
const exactMemory = new Map<string, Memory>();
{
  const tally = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (!t.category || t.type === 'transfer') continue;
    if (t.category === 'transfer-in' || t.category === 'transfer-out') continue;
    const key = `${t.account_id}|${(t.description ?? '').trim().toUpperCase()}|${t.type}`;
    const counts = tally.get(key) ?? new Map<string, number>();
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    tally.set(key, counts);
  }
  for (const [key, counts] of tally) {
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    exactMemory.set(key, {
      category: entries[0][0],
      top: entries[0][1],
      samples: entries.reduce((s, [, n]) => s + n, 0),
    });
  }
}

let wouldPrefill = 0;
let prefillThin = 0;      // decided by a single prior filing
let prefillContested = 0; // the payee has been filed more than one way
let prefillGross = 0;
let contestedGross = 0;
for (const row of band) {
  if (row.type === 'transfer') continue;
  const hit = exactMemory.get(`${row.account_id}|${(row.description ?? '').trim().toUpperCase()}|${row.type}`);
  if (!hit) continue;
  wouldPrefill++;
  prefillGross += Math.abs(pence(row.amount));
  if (hit.samples === 1) prefillThin++;
  if (hit.top < hit.samples) { prefillContested++; contestedGross += Math.abs(pence(row.amount)); }
}

console.log('\n4. WHAT THE SHIPPED PAYEE MEMORY WOULD DO');
console.log('   exact description, same account, same direction — its own rule');
console.log(`   band rows it would prefill: ${wouldPrefill}  (${gbp(prefillGross)} gross)`);
console.log(`     …on a single prior filing: ${prefillThin}`);
console.log(`     …payee filed >1 way      : ${prefillContested}  (${gbp(contestedGross)} gross)` +
  ' — the most common wins with no threshold');

console.log('\nTHE BIGGEST ANSWERABLE PAYEES (already filed elsewhere)');
const answerableByPayee = new Map<string, { n: number; gross: number }>();
for (const t of answerable) {
  const key = payeeKey(t.description);
  const e = answerableByPayee.get(key) ?? { n: 0, gross: 0 };
  e.n++; e.gross += Math.abs(pence(t.amount));
  answerableByPayee.set(key, e);
}
for (const [key, e] of [...answerableByPayee.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 15)) {
  const counts = filedByPayee.get(key);
  const top = counts ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
  const catName = top ? (cats.find(c => c.id === top[0])?.name ?? '?') : '?';
  const agreement = top && counts ? `${top[1]}/${[...counts.values()].reduce((s, n) => s + n, 0)}` : '';
  console.log(`   ${String(e.n).padStart(4)} rows  ${gbp(e.gross).padStart(13)}  ${key.slice(0, 28).padEnd(28)} → ${catName} (${agreement})`);
}
