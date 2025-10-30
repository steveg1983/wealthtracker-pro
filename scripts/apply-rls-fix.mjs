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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('\n🔧 RLS Policy Fix for Transactions Table\n');
console.log('This script provides the SQL to fix the missing DELETE policy.');
console.log('You need to run this in the Supabase Dashboard SQL Editor.\n');

const fixSQL = readFileSync('supabase/migrations/20251030004000__fix-transactions-rls-delete.sql', 'utf8');

console.log('📋 Copy and paste this SQL into the Supabase Dashboard:\n');
console.log('1. Go to: https://app.supabase.com/project/nqbacrjjgdjabygqtcah/editor');
console.log('2. Click "New Query"');
console.log('3. Paste the following SQL:');
console.log('\n' + '='.repeat(60));
console.log(fixSQL);
console.log('='.repeat(60) + '\n');
console.log('4. Click "Run" to apply the fix');
console.log('5. Verify by running: npm run test:supabase-smoke');

// Test current RLS status
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('\n🔍 Checking current RLS status...\n');

// Try to get some diagnostic information
try {
  // Test if we can access transactions
  const { count: transactionCount, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`✓ Can access transactions table (${transactionCount || 0} records)`);
  }

  // Check if the users table exists
  const { error: userError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (!userError) {
    console.log('✓ Users table exists');
  } else if (userError.code === '42P01') {
    console.log('⚠️  Users table not found - might be using profiles instead');
  }

} catch (e) {
  console.error('Error checking tables:', e.message);
}

console.log('\n📝 Next Steps:');
console.log('1. Apply the RLS fix in the Supabase Dashboard');
console.log('2. Run: npm run test:supabase-smoke');
console.log('3. All tests should pass once the policy is applied');