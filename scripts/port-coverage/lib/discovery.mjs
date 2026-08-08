// Mechanical discovery of money-handling files.
//
// Every heuristic in here is deliberately generous. A false positive costs one
// manifest line marked `out-of-scope`; a false negative is a money rule that
// nobody ever notices is unported, which is the exact failure the three audit
// sweeps kept making. Judgement belongs in manifest.json, not here.
//
// Heuristics are documented in README.md §"How discovery works" and each one
// tags the file it matched, so `run.mjs --why <path>` can always answer
// "why is this file in the list".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Trees swept. Anything outside these is not looked at at all. */
export const SCOPE_ROOTS = ['supabase/migrations', 'src/services', 'src/utils', 'api'];

/**
 * The money tables named in the brief. Treated as a floor: the derivation below
 * adds to this set, never subtracts from it, so a schema change cannot quietly
 * shrink what counts as money.
 */
export const MANDATED_MONEY_TABLES = [
  'transactions',
  'accounts',
  'transaction_splits',
  'budgets',
  'goals',
  'investments',
  'categories',
  'suggestion_dismissals',
  'financial_audit_log',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.sql']);

/** Files skipped before any heuristic runs, with the reason each exclusion exists. */
const EXCLUSIONS = [
  {
    id: 'test',
    why: 'Tests are the differential oracle (PHASE1 §5.2), not rule holders. A ported file is proved by its tests; the tests are not themselves a porting work item.',
    match: (rel) => /\.(test|spec)\.tsx?$/.test(rel) || /(^|\/)(__tests__|__mocks__)\//.test(rel) || /(^|\/)test(s)?\//.test(rel),
  },
  {
    id: 'type-only',
    why: 'Ambient declarations carry no behaviour.',
    match: (rel) => rel.endsWith('.d.ts'),
  },
  {
    id: 'non-source',
    why: 'Not TypeScript or SQL (docs, fixtures, editor droppings).',
    match: (rel) => !SOURCE_EXTENSIONS.has(path.extname(rel)),
  },
];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(absDir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

/** Body of every `CREATE TABLE x (...)` in the migrations, keyed by table name. */
function readTableBodies(migrationTexts) {
  const bodies = new Map();
  const open = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi;
  for (const text of migrationTexts) {
    let match;
    open.lastIndex = 0;
    while ((match = open.exec(text))) {
      const start = match.index + match[0].length;
      let depth = 1;
      let i = start;
      while (i < text.length && depth > 0) {
        const ch = text[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
        i += 1;
      }
      const name = match[1];
      bodies.set(name, `${bodies.get(name) ?? ''}\n${text.slice(start, i - 1)}`);
    }
  }
  return bodies;
}

/**
 * A table is a money table if the brief names it, if it declares a numeric
 * column with a money-ish name, or if it carries a foreign key into one of
 * those (one hop — `linked_accounts` holds money references, so a handler that
 * only ever names `linked_accounts` is still money-handling code).
 */
function deriveMoneyTables(bodies) {
  const moneyColumn = /^\s*"?([a-z0-9_]*(amount|balance|price|cost|value|total|target)[a-z0-9_]*)"?\s+(numeric|decimal|money)\b/gim;
  const tables = new Set(MANDATED_MONEY_TABLES);
  const evidence = new Map();

  for (const name of MANDATED_MONEY_TABLES) evidence.set(name, 'named in the brief');

  for (const [name, body] of bodies) {
    moneyColumn.lastIndex = 0;
    const columns = [];
    let hit;
    while ((hit = moneyColumn.exec(body))) columns.push(hit[1]);
    if (columns.length > 0) {
      tables.add(name);
      if (!evidence.has(name)) evidence.set(name, `numeric money column: ${[...new Set(columns)].join(', ')}`);
    }
  }

  const references = /references\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;
  for (const [name, body] of bodies) {
    if (tables.has(name)) continue;
    references.lastIndex = 0;
    let hit;
    while ((hit = references.exec(body))) {
      if (tables.has(hit[1])) {
        tables.add(name);
        evidence.set(name, `foreign key into ${hit[1]}`);
        break;
      }
    }
  }

  return { tables: [...tables].sort(), evidence };
}

/** Every migration function whose own body touches a money table. */
function deriveMoneyFunctions(migrationTexts, moneyTables) {
  const open = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi;
  const tableProbes = moneyTables.map((t) => new RegExp(`\\b${t}\\b`));
  const found = new Set();
  for (const text of migrationTexts) {
    const starts = [];
    open.lastIndex = 0;
    let match;
    while ((match = open.exec(text))) starts.push({ name: match[1], at: match.index });
    for (let i = 0; i < starts.length; i += 1) {
      const end = i + 1 < starts.length ? starts[i + 1].at : text.length;
      const body = text.slice(starts[i].at, end);
      if (tableProbes.some((probe) => probe.test(body))) found.add(starts[i].name);
    }
  }
  // Generic plumbing that happens to sit next to money DDL. Named, not silent.
  for (const noise of ['update_updated_at_column', 'set_current_user_id', 'requesting_clerk_id', 'requesting_user_id']) {
    found.delete(noise);
  }
  return [...found].sort();
}

/**
 * Reads the migrations and derives the money vocabulary the content heuristics
 * key on. Everything here comes out of `supabase/migrations/`, so the
 * vocabulary tracks the schema rather than someone's memory of it.
 */
export function deriveSchemaVocabulary(root = REPO_ROOT) {
  const migrationsDir = path.join(root, 'supabase', 'migrations');
  const migrationFiles = walk(migrationsDir).filter((abs) => abs.endsWith('.sql')).sort();
  const texts = migrationFiles.map((abs) => fs.readFileSync(abs, 'utf8'));
  const bodies = readTableBodies(texts);
  const { tables, evidence } = deriveMoneyTables(bodies);
  const functions = deriveMoneyFunctions(texts, tables);
  return {
    migrationCount: migrationFiles.length,
    tablesCreated: bodies.size,
    moneyTables: tables,
    moneyTableEvidence: evidence,
    moneyFunctions: functions,
  };
}

/** Content signals. Each returns true/false for one file's text. */
function buildContentHeuristics(vocab) {
  const tableProbes = vocab.moneyTables.map((t) => new RegExp(`\\b${t}\\b`));
  return [
    {
      id: 'money-table',
      why: 'Names a money table derived from the migrations.',
      test: (text) => tableProbes.some((probe) => probe.test(text)),
    },
    {
      id: 'money-rpc',
      why: 'Names a Postgres function whose body touches a money table.',
      test: (text) => vocab.moneyFunctions.some((fn) => text.includes(fn)),
    },
    {
      id: 'decimal',
      why: 'Uses Decimal / decimal.js — the codebase only reaches for it when the value is money.',
      test: (text) => /\bDecimal\b|decimal\.js|toDecimal|decimal-(converters|format)/.test(text),
    },
    {
      id: 'amount-or-balance',
      why: 'References an `amount` or `balance` column or field, in any casing.',
      test: (text) => /\bamounts?\b|\bAmount\b|balance/i.test(text),
    },
    {
      id: 'currency',
      why: 'Touches currency — cross-currency handling is itself a money rule (#33/T-9).',
      test: (text) => /currency|Currency/.test(text),
    },
    {
      id: 'money-domain',
      why: 'Uses the money domain vocabulary: transfers, splits, payees, budgets, reconciliation, statements, archiving, prices, net worth, bank identifiers.',
      test: (text) => /\btransfers?\b|\bpayees?\b|\bbudgets?\b|reconcil|archiv|\bledger\b|\bstatements?\b|\bsplits?\b|net[ _-]?worth|\bprices?\b|\bcost\b|market_value|\bpence\b|\bmoney\b|\bIBAN\b|sortCode|sort_code|accountNumber|account_number/i.test(text),
    },
  ];
}

/**
 * Directory heuristics. These do not read the file at all — the whole tree is
 * in scope by construction, because every `.sql` under migrations is schema for
 * the money database and every handler under `api/` is the server-side surface
 * of a financial product. Cheaper to disposition 39 API handlers in the
 * manifest than to argue about which of them touch money.
 */
const DIRECTORY_HEURISTICS = [
  {
    id: 'migration',
    why: 'Every .sql under supabase/migrations/ — this is the money schema itself.',
    test: (rel) => rel.startsWith('supabase/migrations/') && rel.endsWith('.sql'),
  },
  {
    id: 'api-handler',
    why: 'Every handler under api/ — the whole server surface of a financial product is in scope by default; billing and ops handlers get dispositioned in the manifest.',
    test: (rel) => rel.startsWith('api/') && /\.tsx?$/.test(rel),
  },
];

const IMPORT_SPEC = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelativeImport(fromRel, spec, byPathNoExt) {
  if (!spec.startsWith('.')) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec)).replace(/\/+$/, '');
  const stripped = joined.replace(/\.(ts|tsx|js|jsx)$/, '');
  for (const candidate of [stripped, `${stripped}/index`]) {
    const hit = byPathNoExt.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * Runs the whole sweep.
 *
 * @returns {{
 *   files: Map<string, { signals: string[] }>,
 *   vocabulary: object,
 *   candidates: number,
 *   excluded: Array<{ id: string, why: string, count: number }>,
 *   heuristics: Array<{ id: string, why: string, count: number }>
 * }}
 */
export function discover(root = REPO_ROOT) {
  const vocabulary = deriveSchemaVocabulary(root);
  const contentHeuristics = buildContentHeuristics(vocabulary);

  const excludedCounts = new Map(EXCLUSIONS.map((e) => [e.id, 0]));
  const candidates = [];

  for (const scopeRoot of SCOPE_ROOTS) {
    for (const abs of walk(path.join(root, scopeRoot))) {
      const rel = toPosix(path.relative(root, abs));
      const exclusion = EXCLUSIONS.find((e) => e.match(rel));
      if (exclusion) {
        excludedCounts.set(exclusion.id, excludedCounts.get(exclusion.id) + 1);
        continue;
      }
      candidates.push(rel);
    }
  }
  candidates.sort();

  const text = new Map();
  const read = (rel) => {
    if (!text.has(rel)) text.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
    return text.get(rel);
  };

  const files = new Map();
  const addSignal = (rel, signal) => {
    if (!files.has(rel)) files.set(rel, { signals: [] });
    const entry = files.get(rel);
    if (!entry.signals.includes(signal)) entry.signals.push(signal);
  };

  for (const rel of candidates) {
    for (const heuristic of DIRECTORY_HEURISTICS) {
      if (heuristic.test(rel)) addSignal(rel, heuristic.id);
    }
    if (rel.endsWith('.sql')) continue;
    const body = read(rel);
    for (const heuristic of contentHeuristics) {
      if (heuristic.test(body)) addSignal(rel, heuristic.id);
    }
  }

  // One hop of dependency closure: a module a money file imports can hold money
  // rules of its own (storageAdapter's FINANCIAL_KEYS, userIdService's id
  // translation). Depth is capped at one because deeper closure degenerates
  // into "the whole app" and stops being a signal.
  const byPathNoExt = new Map();
  for (const rel of candidates) {
    if (/\.tsx?$/.test(rel)) byPathNoExt.set(rel.replace(/\.tsx?$/, ''), rel);
  }
  const seeds = [...files.keys()].filter((rel) => /\.tsx?$/.test(rel));
  const importedByMoney = new Map();
  for (const rel of seeds) {
    const body = read(rel);
    IMPORT_SPEC.lastIndex = 0;
    let match;
    while ((match = IMPORT_SPEC.exec(body))) {
      const spec = match[1] ?? match[2] ?? match[3];
      const dep = resolveRelativeImport(rel, spec, byPathNoExt);
      if (!dep || files.has(dep)) continue;
      if (!importedByMoney.has(dep)) importedByMoney.set(dep, new Set());
      importedByMoney.get(dep).add(rel);
    }
  }
  for (const dep of importedByMoney.keys()) addSignal(dep, 'imported-by-money-file');

  const heuristicCounts = [...DIRECTORY_HEURISTICS, ...contentHeuristics, {
    id: 'imported-by-money-file',
    why: 'Imported directly by a file another heuristic already matched (one hop only).',
  }].map((h) => ({
    id: h.id,
    why: h.why,
    count: [...files.values()].filter((f) => f.signals.includes(h.id)).length,
  }));

  const sorted = new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));

  return {
    files: sorted,
    vocabulary,
    candidates: candidates.length,
    excluded: EXCLUSIONS.map((e) => ({ id: e.id, why: e.why, count: excludedCounts.get(e.id) })),
    heuristics: heuristicCounts,
    importedByMoney,
  };
}
