/**
 * Import idempotency harness — proves that running the MS Money importer TWICE
 * leaves the database exactly as one run left it.
 *
 * This is the primary evidence that the provenance work does what it claims.
 * It exercises the REAL write path (`planCloudImport` + `executeCloudPlan`
 * from src/services/import/msMoney/msMoneyImport.ts), not a re-implementation.
 *
 *   run 1  wipe → plan → write            → snapshot A
 *   run 2  NO wipe → plan → write         → snapshot B
 *   assert A == B  (row counts, per-table; duplicate-signature counts;
 *                   provenance coverage), and that run 2 planned zero inserts
 *   assert the category tree is whole — system roots present, and NO category
 *          left pointing at a parent row that does not exist
 *   then   force a raw duplicate insert   → assert the DATABASE rejects it
 *
 * ── THIS SCRIPT WRITES. IT MUST NEVER POINT AT PRODUCTION. ─────────────────
 * The target comes from a separate env file (`--env .env.scratch`) and the
 * script REFUSES to run if that file's VITE_SUPABASE_URL matches the one in
 * `.env.local`, or if `--i-know-this-is-a-scratch-database` is absent. No
 * secret is ever printed.
 *
 * Usage:
 *   npx tsx scripts/mnyIdempotencyCheck.mts \
 *     --env .env.scratch --seed .mny-local/mny-local-seed.json \
 *     --i-know-this-is-a-scratch-database
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  planCloudImport, executeCloudPlan, wipeCloudData, fetchExistingImportState,
  MS_MONEY_IMPORT_SOURCE,
} from '../src/services/import/msMoney/msMoneyImport.ts';
import type { MsMoneyImportResult } from '../src/services/import/msMoney/transform.ts';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const envPath = flag('env');
const seedPath = flag('seed');
const CONFIRMED = args.includes('--i-know-this-is-a-scratch-database');

const die = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };

if (!envPath || !seedPath) {
  die('usage: tsx scripts/mnyIdempotencyCheck.mts --env <.env.scratch> --seed <seed.json> --i-know-this-is-a-scratch-database');
}
if (!CONFIRMED) die('refusing to write without --i-know-this-is-a-scratch-database');
if (!existsSync(envPath!)) die(`env file not found: ${envPath}`);
if (!existsSync(seedPath!)) die(`seed not found: ${seedPath}`);

const readEnv = (path: string): Record<string, string> => Object.fromEntries(
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const target = readEnv(envPath!);
if (!target.VITE_SUPABASE_URL || !target.SUPABASE_SERVICE_ROLE_KEY) {
  die(`${envPath} must define VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
}
// Hard production guard: same project ref as .env.local ⇒ refuse, always.
if (existsSync('.env.local')) {
  const prod = readEnv('.env.local');
  if (prod.VITE_SUPABASE_URL && prod.VITE_SUPABASE_URL === target.VITE_SUPABASE_URL) {
    die('the target is the SAME Supabase project as .env.local. This harness writes and deletes — point it at a scratch project.');
  }
}

const sb = createClient(target.VITE_SUPABASE_URL, target.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Seed → the app-shaped import result ─────────────────────────────────────
interface SeedShape {
  accounts: MsMoneyImportResult['accounts'];
  categories: MsMoneyImportResult['categories'];
  transactions: MsMoneyImportResult['transactions'];
  transactionSplits: MsMoneyImportResult['transactionSplits'];
  summary?: MsMoneyImportResult['summary'];
}
const seed = JSON.parse(readFileSync(seedPath!, 'utf8')) as SeedShape;
const result: MsMoneyImportResult = {
  accounts: seed.accounts,
  categories: seed.categories,
  transactions: seed.transactions,
  transactionSplits: seed.transactionSplits,
  summary: seed.summary ?? {
    accounts: { total: 0, open: 0, closed: 0, investmentCashPairs: 0 },
    categories: { subs: 0, details: 0, hidden: 0 },
    transactions: { imported: 0, standalone: 0, transfers: 0, splitTransactions: 0, splitLines: 0 },
    simplifications: [],
  },
};

// ── Snapshot ─────────────────────────────────────────────────────────────────
interface Snapshot {
  counts: Record<string, number>;
  /** How many (account, date, pence, description) signatures appear >1 time. */
  duplicateSignatureGroups: number;
  duplicateSignatureExtraRows: number;
  /** Rows carrying MS Money provenance, and distinct source ids among them. */
  provenancedRows: number;
  distinctSourceIds: number;
  /** Categories whose parent_id names a row that does not exist. Must be 0. */
  orphanedCategories: number;
  /** Categories with is_system = true at level 'type' — the tree's roots. */
  systemRoots: number;
}

async function countRows(table: string, userId: string): Promise<number> {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) die(`counting ${table}: ${error.message}`);
  return count ?? 0;
}

async function snapshot(userId: string): Promise<Snapshot> {
  const counts: Record<string, number> = {};
  for (const t of ['accounts', 'categories', 'transactions', 'transaction_splits']) {
    counts[t] = await countRows(t, userId);
  }

  const PAGE = 1000;
  const signatures = new Map<string, number>();
  const sourceIds = new Set<string>();
  let provenanced = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('transactions')
      .select('account_id,date,amount,description,import_source,import_source_id')
      .eq('user_id', userId).order('id').range(from, from + PAGE - 1);
    if (error) die(`snapshotting transactions: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows) {
      const pence = Math.round(Number(r.amount) * 100);
      const key = `${r.account_id}|${r.date}|${pence}|${String(r.description ?? '').trim().toUpperCase()}`;
      signatures.set(key, (signatures.get(key) ?? 0) + 1);
      if (r.import_source === MS_MONEY_IMPORT_SOURCE) {
        provenanced++;
        if (r.import_source_id) sourceIds.add(String(r.import_source_id));
      }
    }
    if (rows.length < PAGE) break;
  }

  let groups = 0, extra = 0;
  for (const n of signatures.values()) if (n > 1) { groups++; extra += n - 1; }

  // Category tree integrity: every parent_id must name a row that exists. The
  // FK enforces this for rows the database accepted, but the check is cheap and
  // it is the exact failure this harness exists to catch.
  const catRows: { id: string; parent_id: string | null; level: string; is_system: boolean | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('categories')
      .select('id,parent_id,level,is_system')
      .eq('user_id', userId).order('id').range(from, from + PAGE - 1);
    if (error) die(`snapshotting categories: ${error.message}`);
    const rows = data ?? [];
    catRows.push(...rows);
    if (rows.length < PAGE) break;
  }
  const catIds = new Set(catRows.map(r => r.id));
  const orphanedCategories = catRows.filter(r => r.parent_id != null && !catIds.has(r.parent_id)).length;
  const systemRoots = catRows.filter(r => r.level === 'type' && r.is_system === true).length;

  return {
    counts,
    duplicateSignatureGroups: groups,
    duplicateSignatureExtraRows: extra,
    provenancedRows: provenanced,
    distinctSourceIds: sourceIds.size,
    orphanedCategories,
    systemRoots,
  };
}

const show = (label: string, s: Snapshot): void => {
  console.log(`  ${label}: ` + Object.entries(s.counts).map(([k, v]) => `${k}=${v}`).join(' ') +
    ` | dup-signature groups=${s.duplicateSignatureGroups} extra=${s.duplicateSignatureExtraRows}` +
    ` | provenanced=${s.provenancedRows} distinct-source-ids=${s.distinctSourceIds}` +
    ` | system-roots=${s.systemRoots} orphaned-categories=${s.orphanedCategories}`);
};

// ── Run ──────────────────────────────────────────────────────────────────────
(async () => {
  const { data: users, error } = await sb.from('users').select('id, email');
  if (error) die(`cannot read users: ${error.message}`);
  if (!users?.length) die('the scratch database has no user row to import against');
  if (users.length > 1) die(`expected exactly 1 user in the scratch database, found ${users.length}`);
  const userId = users[0].id as string;

  const probe = await sb.from('transactions').select('import_source_id').limit(1);
  if (probe.error) {
    die('provenance columns missing — apply supabase/migrations/20260722170000_transaction_import_provenance.sql to the scratch database first.');
  }

  const runOnce = async (label: string): Promise<{ transactions: number; accounts: number; categories: number }> => {
    // Exactly what importToCloud does: read the user's current state, then plan
    // against it — so the seed's placeholder category roots resolve onto the
    // rows the user actually holds instead of onto ids nothing ever writes.
    const existing = await fetchExistingImportState(sb as SupabaseClient, userId);
    const plan = planCloudImport(result, userId, randomUUID, existing);
    console.log(`  ${label}: plan → ${plan.transactions.length} transactions to insert, ` +
      `${plan.skippedExisting} already present, ${plan.splits.length} split lines`);
    console.log(`  ${label}: plan → ${plan.accounts.length} accounts + ${plan.categories.length} categories to insert, ` +
      `${plan.skippedExistingAccounts} accounts / ${plan.skippedExistingCategories} categories already present, ` +
      `${plan.categoriesWithUnresolvedParent} with an unresolvable parent`);
    if (plan.categoriesWithUnresolvedParent > 0) {
      die(`${label}: ${plan.categoriesWithUnresolvedParent} categories have no resolvable parent — the seed tree is broken`);
    }
    await executeCloudPlan(plan, sb as SupabaseClient);
    return {
      transactions: plan.transactions.length,
      accounts: plan.accounts.length,
      categories: plan.categories.length,
    };
  };

  console.log(`Scratch target: ${new URL(target.VITE_SUPABASE_URL).host} (user ${userId})\n`);

  console.log('RUN 1 (wipe, then import)');
  await wipeCloudData(sb as SupabaseClient, userId);
  const inserted1 = await runOnce('run 1');
  const a = await snapshot(userId);
  show('after run 1', a);

  console.log('\nRUN 2 (NO wipe — the same file imported straight over the top)');
  const inserted2 = await runOnce('run 2');
  const b = await snapshot(userId);
  show('after run 2', b);

  console.log('\nDATABASE-LEVEL GUARD');
  const { data: victim } = await sb.from('transactions')
    .select('user_id,account_id,description,amount,type,date,import_source,import_source_id')
    .eq('user_id', userId).eq('import_source', MS_MONEY_IMPORT_SOURCE).limit(1);
  let guardHeld = false;
  if (victim?.length) {
    const { error: dupError } = await sb.from('transactions').insert([{ ...victim[0], id: randomUUID() }]);
    guardHeld = dupError != null;
    console.log(`  forced duplicate insert → ${guardHeld ? 'REJECTED by the database ✓' : 'ACCEPTED ✗'}`);
  } else {
    console.log('  skipped — no provenanced row to duplicate');
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const failures: string[] = [];
  for (const table of Object.keys(a.counts)) {
    if (a.counts[table] !== b.counts[table]) {
      failures.push(`${table}: ${a.counts[table]} after run 1 but ${b.counts[table]} after run 2`);
    }
  }
  if (inserted2.transactions !== 0) failures.push(`run 2 planned ${inserted2.transactions} transaction inserts; expected 0`);
  if (inserted2.accounts !== 0) failures.push(`run 2 planned ${inserted2.accounts} account inserts; expected 0`);
  if (inserted2.categories !== 0) failures.push(`run 2 planned ${inserted2.categories} category inserts; expected 0`);
  for (const [label, s] of [['run 1', a], ['run 2', b]] as const) {
    if (s.orphanedCategories !== 0) {
      failures.push(`after ${label}: ${s.orphanedCategories} categories point at a parent row that does not exist`);
    }
    if (s.systemRoots === 0) failures.push(`after ${label}: the category tree has no system type roots`);
  }
  if (a.duplicateSignatureGroups !== b.duplicateSignatureGroups) {
    failures.push(`duplicate-signature groups moved ${a.duplicateSignatureGroups} → ${b.duplicateSignatureGroups}`);
  }
  if (a.duplicateSignatureExtraRows !== b.duplicateSignatureExtraRows) {
    failures.push(`duplicate-signature extra rows moved ${a.duplicateSignatureExtraRows} → ${b.duplicateSignatureExtraRows}`);
  }
  if (a.provenancedRows !== a.distinctSourceIds) {
    failures.push(`run 1 wrote ${a.provenancedRows} provenanced rows but only ${a.distinctSourceIds} distinct source ids`);
  }
  if (inserted1.transactions !== result.transactions.length) {
    failures.push(`run 1 inserted ${inserted1.transactions} of ${result.transactions.length} source transactions`);
  }
  if (!guardHeld && victim?.length) failures.push('the unique index did NOT reject a forced duplicate');

  console.log('');
  if (failures.length) {
    console.error('IDEMPOTENCY CHECK FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('IDEMPOTENCY CHECK PASSED — run 2 changed nothing, and the database refuses a duplicate.');
})();
