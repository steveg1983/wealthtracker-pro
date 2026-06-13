#!/usr/bin/env node
/**
 * Logical database backup — exports every application table to local JSON.
 *
 * Output: backups/db/<ISO timestamp>/<table>.json + manifest.json (row
 * counts, duration, source project). Local artifacts are covered by the
 * machine's Time Machine → NAS backups, giving an off-project copy — backups
 * stored only inside the Supabase project do not survive project loss.
 *
 * This complements (does not replace) Supabase platform backups/PITR: it is
 * application-level, restorable row-by-row with scripts/restore-database.mjs,
 * and testable — see the restore drill in AUDIT_2026-06-11_DISASTER_RECOVERY.
 *
 * Usage: node scripts/backup-database.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Every application table (from the migrations). Order matters for RESTORE
// (parents before children); backup order is irrelevant but kept consistent.
export const TABLES = [
  'users',
  'user_profiles',
  'categories',
  'accounts',
  'transactions',
  'budgets',
  'goals',
  'goal_contributions',
  'investments',
  'investment_transactions',
  'recurring_transactions',
  'subscriptions',
  'invoices',
  'payment_methods',
  'subscription_usage',
  'subscription_logs',
  'subscription_events',
  'financial_audit_log',
  'bank_connections',
  'linked_accounts',
  'sync_history',
  'sync_metadata',
  'webhook_events',
  'dashboard_layouts'
];

const PAGE = 1000;

const dumpTable = async (table) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) return { rows: null, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
};

const main = async () => {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const dir = path.join('backups', 'db', stamp);
  mkdirSync(dir, { recursive: true });

  console.log(`── Database backup → ${dir} ──`);
  console.log(`Source: ${url}\n`);

  const manifest = {
    backedUpAt: startedAt.toISOString(),
    source: url,
    format: 'wealthtracker-logical-backup-v1',
    tables: {}
  };

  let totalRows = 0;
  let failures = 0;

  for (const table of TABLES) {
    const { rows, error } = await dumpTable(table);
    if (error) {
      // A table that does not exist in the source (pending migration) is not
      // an incomplete backup of what exists — note it and continue.
      if (error.includes('Could not find the table')) {
        console.log(`  – ${table.padEnd(26)} not present in source (pending migration?)`);
        manifest.tables[table] = { skipped: 'table_not_found' };
        continue;
      }
      console.log(`  ✗ ${table.padEnd(26)} FAILED: ${error}`);
      manifest.tables[table] = { error };
      failures += 1;
      continue;
    }
    writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
    manifest.tables[table] = { rows: rows.length };
    totalRows += rows.length;
    console.log(`  ✓ ${table.padEnd(26)} ${rows.length} rows`);
  }

  manifest.totalRows = totalRows;
  manifest.durationMs = Date.now() - startedAt.getTime();
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\nTotal: ${totalRows} rows across ${TABLES.length - failures}/${TABLES.length} tables in ${manifest.durationMs} ms`);
  console.log(`Manifest: ${path.join(dir, 'manifest.json')}`);
  if (failures > 0) {
    console.log(`\n⚠ ${failures} table(s) failed to back up — backup is INCOMPLETE.`);
    process.exit(2);
  }
};

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
}
