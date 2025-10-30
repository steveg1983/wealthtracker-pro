#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Load environment variables
function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!key || rest.length === 0) continue;
      const rawValue = rest.join('=').trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log(`Loaded environment from ${filePath}`);
  } catch (error) {
    console.warn(`Failed to load ${filePath}:`, error.message);
  }
}

// Load .env.test.local
const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env.test.local');
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getTableList() {
  // Try to query known tables to verify connectivity
  const knownTables = [
    'profiles',
    'accounts',
    'transactions',
    'categories',
    'budgets',
    'budget_periods',
    'goals',
    'financial_plans',
    'bills',
    'investments',
    'investment_transactions',
    'tags',
    'transaction_tags',
    'import_rules'
  ];

  const tableInfo = [];

  for (const tableName of knownTables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        tableInfo.push({ table: tableName, exists: true });
        console.log(`✓ Found table: ${tableName}`);
      }
    } catch (e) {
      // Table doesn't exist or no access
    }
  }

  return tableInfo;
}

async function exportBasicSchema() {
  try {
    console.log('\n📊 Checking database tables...\n');

    const tables = await getTableList();

    if (tables.length > 0) {
      console.log(`\n✅ Found ${tables.length} tables in the database`);

      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const migrationFile = `supabase/migrations/${timestamp}__initial-schema-placeholder.sql`;

      // Create a placeholder migration with instructions
      const placeholderContent = `-- Initial Schema Placeholder
-- Generated: ${new Date().toISOString()}
--
-- This is a placeholder migration file. To capture the full schema with RLS policies,
-- triggers, functions, and constraints, you need to:
--
-- 1. Get the database password from Supabase Dashboard:
--    - Go to Settings → Database → Connection string
--    - Copy the password from the connection string
--
-- 2. Export the database URL:
--    export SUPABASE_DB_URL="postgresql://postgres:<password>@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres"
--
-- 3. Run the schema dump:
--    npx supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --data false --file supabase/migrations/${timestamp}__initial-schema.sql
--
-- 4. Replace this file with the generated schema dump
--
-- Tables confirmed to exist in the database:
${tables.map(t => `-- - ${t.table}`).join('\n')}
--
-- Note: The actual schema includes RLS policies, triggers, functions, and constraints
-- that cannot be exported via the Supabase JS client API.
`;

      writeFileSync(migrationFile, placeholderContent);
      console.log(`\n📝 Created placeholder migration: ${migrationFile}`);
      console.log('\n⚠️  IMPORTANT: This is just a placeholder. Follow the instructions in the file to export the full schema.');

      // Also output the instructions for immediate use
      console.log('\n📋 Next steps to capture the full schema:\n');
      console.log('1. Get the database password from Supabase Dashboard (Settings → Database)');
      console.log(`2. Run: export SUPABASE_DB_URL="postgresql://postgres:<password>@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres"`);
      console.log(`3. Run: npx supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --data false --file supabase/migrations/${timestamp}__initial-schema.sql`);
      console.log('4. Run: npm run test:supabase-smoke (to verify the schema is still valid)');
      console.log('5. Review the generated SQL file and commit it');

    } else {
      console.log('❌ No tables found. Please check your credentials.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

exportBasicSchema();