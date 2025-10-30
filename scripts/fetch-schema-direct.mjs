#!/usr/bin/env node

import https from 'https';
import { writeFileSync } from 'fs';

const SUPABASE_DB_URL = "postgresql://postgres:SDzMGtV9FGTfdLun@db.nqbacrjjgdjabygqtcah.supabase.co:5432/postgres";

// Parse connection string
const urlParts = SUPABASE_DB_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlParts) {
  console.error('Invalid database URL format');
  process.exit(1);
}

const [, username, password, host, port, database] = urlParts;

console.log(`Connecting to ${host}:${port}/${database} as ${username}`);

// Use Supabase Management API to get schema information
const projectRef = 'nqbacrjjgdjabygqtcah';
const supabaseUrl = `https://${projectRef}.supabase.co`;

// Since we can't directly dump SQL without pg_dump, let's install it
console.log('\nTo export the full schema with RLS policies, you need PostgreSQL tools.');
console.log('Installing PostgreSQL client tools...\n');

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function installPostgresTools() {
  try {
    console.log('Checking if Homebrew is installed...');
    const { stdout: brewCheck } = await execAsync('which brew');
    if (brewCheck) {
      console.log('Installing PostgreSQL client tools via Homebrew...');
      const { stdout, stderr } = await execAsync('brew install libpq');
      console.log(stdout);
      if (stderr && !stderr.includes('already installed')) {
        console.error(stderr);
      }

      // Link the tools
      console.log('Linking PostgreSQL tools...');
      await execAsync('brew link --force libpq');

      // Now try pg_dump
      console.log('\nExporting schema...');
      const pgDumpPath = '/opt/homebrew/opt/libpq/bin/pg_dump';
      const fallbackPath = '/usr/local/opt/libpq/bin/pg_dump';

      // Try to find pg_dump
      let pgDump = 'pg_dump';
      try {
        await execAsync(`test -f ${pgDumpPath}`);
        pgDump = pgDumpPath;
      } catch {
        try {
          await execAsync(`test -f ${fallbackPath}`);
          pgDump = fallbackPath;
        } catch {
          // Use default and hope it's in PATH
        }
      }

      const dumpCommand = `PGPASSWORD="${password}" ${pgDump} -h ${host} -p ${port} -U ${username} -d ${database} --schema=public --no-owner --no-privileges --schema-only`;

      console.log('Running pg_dump...');
      const { stdout: schema, stderr: dumpErr } = await execAsync(dumpCommand);

      if (dumpErr && !dumpErr.includes('warning')) {
        console.error('pg_dump warnings:', dumpErr);
      }

      // Write the schema to file
      const timestamp = '20251030003814';
      const outputFile = `supabase/migrations/${timestamp}__initial-schema.sql`;

      // Add header to the schema
      const header = `-- Initial Supabase Schema Export
-- Generated: ${new Date().toISOString()}
-- Database: ${database}
--
-- This schema includes tables, views, functions, triggers, and RLS policies
-- exported from the production Supabase database.
--
-- IMPORTANT: Review and remove any sensitive or environment-specific data
-- before committing to the repository.
--

`;

      writeFileSync(outputFile, header + schema);
      console.log(`\n✅ Schema exported successfully to ${outputFile}`);
      console.log('\nNow checking for RLS policies on transactions table...');

      // Check if DELETE policy exists
      if (schema.includes('CREATE POLICY') && schema.includes('transactions')) {
        const deletePolicyExists = schema.includes('DELETE ON public.transactions');
        if (!deletePolicyExists) {
          console.log('\n⚠️  WARNING: No DELETE policy found for transactions table!');
          console.log('This explains why the smoke test is failing.');
          console.log('A DELETE policy needs to be added to prevent unauthorized deletions.');
        } else {
          console.log('✓ DELETE policy exists for transactions table');
        }
      }

      return outputFile;
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nManual steps required:');
    console.log('1. Install PostgreSQL client tools:');
    console.log('   brew install libpq');
    console.log('   brew link --force libpq');
    console.log('\n2. Export the schema:');
    console.log(`   PGPASSWORD="${password}" /opt/homebrew/opt/libpq/bin/pg_dump \\`);
    console.log(`     -h ${host} -p ${port} -U ${username} -d ${database} \\`);
    console.log('     --schema=public --no-owner --no-privileges --schema-only \\');
    console.log('     -f supabase/migrations/20251030003814__initial-schema.sql');
  }
}

installPostgresTools().catch(console.error);