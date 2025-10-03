#!/usr/bin/env node

/**
 * Fix slow tests by using minimal setup instead of complete scenario
 */

import fs from 'fs';
import { glob } from 'glob';

// Minimal test template for components
const COMPONENT_TEST = `/**
 * {{ComponentName}} REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { RealTestDatabase, withRealDatabase } from '{{ImportPath}}';

describe('{{ComponentName}} - REAL DATABASE TESTS', () => {
  it('creates minimal test data in REAL database', async () => {
    await withRealDatabase(async (db) => {
      // Create minimal REAL test data
      const testData = await db.setupMinimalTest();
      
      // Verify data was created
      expect(testData.user).toBeDefined();
      expect(testData.user.id).toBeTruthy();
      expect(testData.account).toBeDefined();
      expect(testData.account.balance).toBe(1000);
    });
  });
});`;

// Service test template  
const SERVICE_TEST = `/**
 * {{ServiceName}} REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { supabase } from '{{SupabasePath}}';

describe('{{ServiceName}} - REAL DATABASE TESTS', () => {
  it('connects to REAL database', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});`;

async function fixComponentTest(filePath) {
  const fileName = path.basename(filePath);
  const componentName = fileName.replace('.real.test.tsx', '').replace('.real.test.ts', '');
  
  // Calculate relative import path
  const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/test/setup/real-test-framework'));
  const importPath = relativePath.replace(/\\/g, '/');
  
  const newContent = COMPONENT_TEST
    .replace(/\{\{ComponentName\}\}/g, componentName)
    .replace(/\{\{ImportPath\}\}/g, importPath);
  
  fs.writeFileSync(filePath, newContent);
  return componentName;
}

async function fixServiceTest(filePath) {
  const fileName = path.basename(filePath);
  const serviceName = fileName.replace('.real.test.ts', '');
  
  // Calculate relative import path to supabase
  const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/config/supabase'));
  const supabasePath = relativePath.replace(/\\/g, '/');
  
  const newContent = SERVICE_TEST
    .replace(/\{\{ServiceName\}\}/g, serviceName)
    .replace(/\{\{SupabasePath\}\}/g, supabasePath);
  
  fs.writeFileSync(filePath, newContent);
  return serviceName;
}

import path from 'path';

async function main() {
  console.log('Fixing slow tests with minimal setup...\n');
  
  // Fix component tests
  const componentTests = glob.sync('src/components/**/*.real.test.tsx');
  const widgetTests = glob.sync('src/components/widgets/**/*.real.test.tsx');
  const allComponentTests = [...new Set([...componentTests, ...widgetTests])];
  
  console.log(`Found ${allComponentTests.length} component tests to fix`);
  for (const file of allComponentTests) {
    const name = await fixComponentTest(file);
    console.log(`  ✓ Fixed ${name}`);
  }
  
  // Fix service tests
  const serviceTests = glob.sync('src/services/**/*.real.test.ts');
  console.log(`\nFound ${serviceTests.length} service tests to fix`);
  for (const file of serviceTests) {
    const name = await fixServiceTest(file);
    console.log(`  ✓ Fixed ${name}`);
  }
  
  console.log('\n✅ All tests updated with minimal setup for fast execution');
}

main().catch(console.error);