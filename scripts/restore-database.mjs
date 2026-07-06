#!/usr/bin/env node
/**
 * Logical restore — companion to backup-database.mjs.
 *
 * Restores rows from a backup directory via upsert (insert, or overwrite on
 * primary-key conflict). Parents restore before children (TABLES order), so
 * foreign keys resolve. Dry-run by default.
 *
 * Scoping:
 *   --dir=backups/db/<stamp>      backup to restore from (required)
 *   --table=transactions          restore one table only (optional)
 *   --user-id=<uuid>              restore only rows belonging to a user
 *                                 (optional; matches user_id or id on users)
 *   --apply                       actually write (otherwise dry-run)
 *
 * Examples:
 *   node scripts/restore-database.mjs --dir=backups/db/2026-06-11T...   # dry run, everything
 *   node scripts/restore-database.mjs --dir=... --user-id=abc --apply  # one user's data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { TABLES } from './backup-database.mjs';

const loadEnvFile = (file) => {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* optional */ }
};
loadEnvFile('.env.local');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const dir = getArg('dir');
const onlyTable = getArg('table');
const onlyUserId = getArg('user-id');
const apply = args.includes('--apply');

if (!dir || !existsSync(path.join(dir, 'manifest.json'))) {
  console.error('Provide --dir=<backup directory containing manifest.json>');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Clerk-keyed tables filter on different columns when --user-id is given.
const USER_COLUMN = {
  users: 'id',
  user_profiles: null,          // keyed by clerk_user_id — skipped under --user-id
  recurring_transactions: null  // keyed by clerk id    — skipped under --user-id
};

const CHUNK = 200;

const main = async () => {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  console.log(`── Restore from ${dir} ${apply ? '(APPLYING)' : '(dry run)'} ──`);
  console.log(`Backup taken: ${manifest.backedUpAt} from ${manifest.source}`);
  if (onlyTable) console.log(`Scope: table=${onlyTable}`);
  if (onlyUserId) console.log(`Scope: user-id=${onlyUserId}`);
  console.log('');

  const started = Date.now();
  let totalRestored = 0;
  let failedChunks = 0;

  for (const table of TABLES) {
    if (onlyTable && table !== onlyTable) continue;
    const file = path.join(dir, `${table}.json`);
    if (!existsSync(file)) continue;

    let rows = JSON.parse(readFileSync(file, 'utf8'));
    if (onlyUserId) {
      const col = table in USER_COLUMN ? USER_COLUMN[table] : 'user_id';
      if (col === null) {
        console.log(`  – ${table.padEnd(26)} skipped (not uuid-user-keyed)`);
        continue;
      }
      rows = rows.filter((r) => r[col] === onlyUserId);
    }
    if (rows.length === 0) continue;

    if (!apply) {
      console.log(`  ${table.padEnd(28)} would restore ${rows.length} rows`);
      totalRestored += rows.length;
      continue;
    }

    let restored = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.log(`  ✗ ${table.padEnd(26)} chunk ${i / CHUNK}: ${error.message}`);
        failedChunks += 1;
        continue;
      }
      restored += chunk.length;
    }
    totalRestored += restored;
    const mark = restored === rows.length ? '✓' : '⚠';
    console.log(`  ${mark} ${table.padEnd(26)} restored ${restored}/${rows.length} rows`);
  }

  console.log(`\n${apply ? 'Restored' : 'Would restore'}: ${totalRestored} rows in ${Date.now() - started} ms`);
  if (!apply && totalRestored > 0) console.log('Re-run with --apply to write.');
  if (apply) console.log('Run npm run audit:data to verify the accounting invariant after restore.');

  // A partial restore must NEVER exit 0 (the false-green the backup-side review
  // flagged): in a DR scenario a green exit is read as "data is back", and a
  // silently missing chunk of transactions breaks the ledger invariant.
  if (failedChunks > 0) {
    console.error(`\n✗ INCOMPLETE RESTORE: ${failedChunks} chunk(s) failed — data is PARTIAL. Fix the errors above and re-run.`);
    process.exit(2);
  }
};

main().catch((err) => {
  console.error('Restore failed:', err.message);
  process.exit(1);
});
