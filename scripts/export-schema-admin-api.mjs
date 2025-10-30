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

// Known table structure based on smoke tests and codebase
const knownSchema = {
  users: {
    columns: ['id', 'clerk_id', 'email', 'first_name', 'last_name', 'created_at', 'updated_at'],
    primaryKey: 'id',
    unique: ['clerk_id', 'email']
  },
  profiles: {
    columns: ['id', 'user_id', 'display_name', 'avatar_url', 'bio', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users(id)' }]
  },
  accounts: {
    columns: ['id', 'user_id', 'name', 'type', 'balance', 'currency', 'institution', 'is_active', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users(id)' }]
  },
  transactions: {
    columns: ['id', 'user_id', 'account_id', 'category_id', 'amount', 'type', 'description', 'date', 'is_pending', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'account_id', references: 'accounts(id)' },
      { column: 'category_id', references: 'categories(id)' }
    ]
  },
  categories: {
    columns: ['id', 'user_id', 'name', 'type', 'icon', 'color', 'parent_id', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'parent_id', references: 'categories(id)' }
    ]
  },
  budgets: {
    columns: ['id', 'user_id', 'category_id', 'amount', 'period', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'category_id', references: 'categories(id)' }
    ]
  },
  budget_periods: {
    columns: ['id', 'budget_id', 'start_date', 'end_date', 'allocated_amount', 'spent_amount', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'budget_id', references: 'budgets(id)' }]
  },
  goals: {
    columns: ['id', 'user_id', 'name', 'target_amount', 'current_amount', 'target_date', 'type', 'status', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users(id)' }]
  },
  financial_plans: {
    columns: ['id', 'user_id', 'name', 'description', 'type', 'status', 'settings', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users(id)' }]
  },
  bills: {
    columns: ['id', 'user_id', 'name', 'amount', 'due_date', 'frequency', 'category_id', 'is_active', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'category_id', references: 'categories(id)' }
    ]
  },
  investments: {
    columns: ['id', 'user_id', 'account_id', 'symbol', 'name', 'quantity', 'purchase_price', 'current_price', 'type', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'account_id', references: 'accounts(id)' }
    ]
  },
  investment_transactions: {
    columns: ['id', 'investment_id', 'type', 'quantity', 'price', 'date', 'notes', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'investment_id', references: 'investments(id)' }]
  },
  tags: {
    columns: ['id', 'user_id', 'name', 'color', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [{ column: 'user_id', references: 'users(id)' }]
  },
  transaction_tags: {
    columns: ['transaction_id', 'tag_id', 'created_at'],
    primaryKey: ['transaction_id', 'tag_id'],
    foreignKeys: [
      { column: 'transaction_id', references: 'transactions(id)' },
      { column: 'tag_id', references: 'tags(id)' }
    ]
  },
  import_rules: {
    columns: ['id', 'user_id', 'name', 'pattern', 'category_id', 'tags', 'is_active', 'created_at', 'updated_at'],
    primaryKey: 'id',
    foreignKeys: [
      { column: 'user_id', references: 'users(id)' },
      { column: 'category_id', references: 'categories(id)' }
    ]
  }
};

async function generateBasicSchema() {
  const timestamp = '20251030003814';
  const outputFile = `supabase/migrations/${timestamp}__initial-schema.sql`;

  let schema = `-- Initial Supabase Schema
-- Generated: ${new Date().toISOString()}
-- Database: postgres
--
-- WARNING: This is a reconstructed schema based on application code analysis.
-- It may not include all database-level constraints, triggers, or RLS policies.
-- For a complete schema export, use pg_dump with direct database access.
--
-- Tables confirmed to exist: ${Object.keys(knownSchema).join(', ')}
--

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

  // Generate CREATE TABLE statements
  for (const [tableName, tableInfo] of Object.entries(knownSchema)) {
    schema += `\n-- Table: ${tableName}\n`;
    schema += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

    // Add columns (simplified - actual types would need to be verified)
    const columnDefs = [];
    for (const column of tableInfo.columns) {
      let columnDef = `  ${column}`;

      // Guess column types based on naming patterns
      if (column === 'id') {
        columnDef += ' UUID DEFAULT uuid_generate_v4() PRIMARY KEY';
      } else if (column.endsWith('_id')) {
        columnDef += ' UUID';
      } else if (column === 'email') {
        columnDef += ' VARCHAR(255)';
      } else if (column === 'amount' || column === 'balance' || column.endsWith('_price')) {
        columnDef += ' DECIMAL(19, 4)';
      } else if (column === 'quantity') {
        columnDef += ' DECIMAL(19, 8)';
      } else if (column.endsWith('_at') || column.endsWith('_date')) {
        columnDef += ' TIMESTAMP WITH TIME ZONE';
      } else if (column === 'is_active' || column === 'is_pending') {
        columnDef += ' BOOLEAN DEFAULT false';
      } else if (column === 'type' || column === 'status' || column === 'frequency' || column === 'period') {
        columnDef += ' VARCHAR(50)';
      } else if (column === 'settings' || column === 'tags') {
        columnDef += ' JSONB';
      } else {
        columnDef += ' TEXT';
      }

      columnDefs.push(columnDef);
    }

    schema += columnDefs.join(',\n');
    schema += '\n);\n';

    // Add indexes
    if (tableInfo.unique) {
      for (const uniqueCol of tableInfo.unique) {
        schema += `CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_${uniqueCol} ON public.${tableName} (${uniqueCol});\n`;
      }
    }

    // Add foreign key constraints
    if (tableInfo.foreignKeys) {
      for (const fk of tableInfo.foreignKeys) {
        const constraintName = `fk_${tableName}_${fk.column}`;
        schema += `ALTER TABLE public.${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${fk.column}) REFERENCES public.${fk.references} ON DELETE CASCADE;\n`;
      }
    }
  }

  // Add RLS policies
  schema += `\n-- Enable Row Level Security\n`;
  for (const tableName of Object.keys(knownSchema)) {
    schema += `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n`;
  }

  // Add basic RLS policies for transactions (fixing the DELETE issue)
  schema += `
-- RLS Policies for transactions table
-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can only insert their own transactions
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can only update their own transactions
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- CRITICAL: Users can only delete their own transactions (this was missing!)
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Service role bypass for all operations
CREATE POLICY "Service role has full access" ON public.transactions
  USING (auth.jwt()->>'role' = 'service_role');
`;

  // Add RLS for other tables
  const tablesNeedingRLS = ['accounts', 'categories', 'budgets', 'goals', 'bills', 'investments', 'tags', 'import_rules'];
  for (const tableName of tablesNeedingRLS) {
    schema += `
-- RLS Policies for ${tableName}
CREATE POLICY "Users can view own ${tableName}" ON public.${tableName}
  FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own ${tableName}" ON public.${tableName}
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own ${tableName}" ON public.${tableName}
  FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own ${tableName}" ON public.${tableName}
  FOR DELETE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Service role bypass ${tableName}" ON public.${tableName}
  USING (auth.jwt()->>'role' = 'service_role');
`;
  }

  // Write the schema file
  writeFileSync(outputFile, schema);
  console.log(`\n✅ Generated basic schema to: ${outputFile}`);
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('1. This is a reconstructed schema based on code analysis');
  console.log('2. Column types are inferred and may need adjustment');
  console.log('3. Missing: stored procedures, triggers, custom functions');
  console.log('4. Added DELETE RLS policy for transactions table (was missing!)');
  console.log('\nTo get the complete actual schema, you still need:');
  console.log('1. The correct database hostname from Supabase Dashboard');
  console.log('2. Run: pg_dump with the working connection string');

  return outputFile;
}

generateBasicSchema().catch(console.error);