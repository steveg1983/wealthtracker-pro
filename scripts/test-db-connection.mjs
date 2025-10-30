#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
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

console.log('Supabase URL:', supabaseUrl);
console.log('\nAttempting to determine database connection details...\n');

// The database password you provided
const dbPassword = 'SDzMGtV9FGTfdLun';

// Try different possible hostnames
const possibleHosts = [
  `db.nqbacrjjgdjabygqtcah.supabase.co`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-us-west-2.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
  `nqbacrjjgdjabygqtcah.supabase.co`
];

console.log('Connection string formats to try:\n');

// Direct connection (port 5432)
console.log('1. Direct connection:');
console.log(`   postgresql://postgres:${dbPassword}@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres`);

// Pooler connection (port 6543)
console.log('\n2. Pooler connection (transaction mode):');
console.log(`   postgresql://postgres.nqbacrjjgdjabygqtcah:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`);

// Session pooler (port 5432)
console.log('\n3. Session pooler:');
console.log(`   postgresql://postgres.nqbacrjjgdjabygqtcah:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`);

console.log('\n📋 Manual export command once you find the working connection:');
console.log('\n# Set the connection string that works:');
console.log('export SUPABASE_DB_URL="<working-connection-string>"');
console.log('\n# Export the schema:');
console.log('pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --schema-only -f supabase/migrations/20251030003814__initial-schema.sql');

console.log('\n🔍 Checking Supabase dashboard for correct connection string...');
console.log('\nGo to: https://app.supabase.com/project/nqbacrjjgdjabygqtcah/settings/database');
console.log('Look for: Connection string → Direct connection or Connection pooling');
console.log('\nThe connection string should show the exact hostname and port.');

// Test if we can at least connect via the API
const supabase = createClient(supabaseUrl, serviceRoleKey);

try {
  const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  if (!error) {
    console.log('\n✅ API connection works! The project is accessible.');
    console.log('The database exists but needs the correct direct connection hostname.');
  }
} catch (e) {
  console.error('\nAPI test failed:', e.message);
}