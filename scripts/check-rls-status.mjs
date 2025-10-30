#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 Checking RLS and policy status...\n');

// Test with service role to insert test data
const supabaseService = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Test with anon key
const supabaseAnon = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function testRLS() {
  try {
    // 1. Create a test user and transaction with service role
    console.log('1️⃣ Creating test data with service role...');
    // Generate a proper UUID v4
    const testUserId = crypto.randomUUID();

    const { data: user, error: userError } = await supabaseService
      .from('users')
      .insert({
        id: testUserId,
        clerk_id: 'test_' + testUserId,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      })
      .select()
      .single();

    if (userError) {
      console.error('Failed to create test user:', userError);
      return;
    }
    console.log('✓ Created test user:', testUserId);

    // Create test account
    const { data: account, error: accountError } = await supabaseService
      .from('accounts')
      .insert({
        user_id: testUserId,
        name: 'Test Account',
        type: 'checking',
        balance: 1000,
        currency: 'USD'
      })
      .select()
      .single();

    if (accountError) {
      console.error('Failed to create test account:', accountError);
      return;
    }
    console.log('✓ Created test account:', account.id);

    // Create test transaction
    const { data: transaction, error: txError } = await supabaseService
      .from('transactions')
      .insert({
        user_id: testUserId,
        account_id: account.id,
        amount: 100,
        type: 'expense',
        description: 'Test transaction for RLS check',
        date: new Date().toISOString()
      })
      .select()
      .single();

    if (txError) {
      console.error('Failed to create test transaction:', txError);
      return;
    }
    console.log('✓ Created test transaction:', transaction.id);

    // 2. Try to delete with anonymous client
    console.log('\n2️⃣ Testing DELETE with anonymous client...');
    const { data: deleteData, error: deleteError } = await supabaseAnon
      .from('transactions')
      .delete()
      .eq('id', transaction.id)
      .select(); // Add select to see if anything was deleted

    if (deleteError) {
      console.log('✅ GOOD: Anonymous delete was blocked!');
      console.log('   Error code:', deleteError.code);
      console.log('   Error message:', deleteError.message);
    } else {
      console.log('❌ BAD: Anonymous delete succeeded (no error returned)!');
      console.log('   Delete response data:', deleteData);
      if (deleteData && deleteData.length > 0) {
        console.log('   Items deleted:', deleteData.length);
      } else {
        console.log('   However, no data was actually deleted (empty response)');
      }
    }

    // 3. Check if transaction still exists
    console.log('\n3️⃣ Checking if transaction still exists...');
    const { data: checkData, error: checkError } = await supabaseService
      .from('transactions')
      .select()
      .eq('id', transaction.id)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      console.log('❌ Transaction was deleted by anonymous user!');
    } else if (checkData) {
      console.log('✅ Transaction still exists (was not deleted)');
    }

    // 4. Cleanup
    console.log('\n4️⃣ Cleaning up test data...');
    await supabaseService.from('transactions').delete().eq('user_id', testUserId);
    await supabaseService.from('accounts').delete().eq('user_id', testUserId);
    await supabaseService.from('users').delete().eq('id', testUserId);
    console.log('✓ Cleanup complete');

  } catch (error) {
    console.error('Test error:', error);
  }
}

testRLS();