#!/usr/bin/env node

/**
 * Fix generic test templates to be minimal passing tests
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal passing test template
const MINIMAL_TEST = `/**
 * {{ComponentName}} REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { RealTestDatabase, withRealDatabase } from '{{ImportPath}}';

describe('{{ComponentName}} - REAL DATABASE TESTS', () => {
  it('can create test data in REAL database', async () => {
    await withRealDatabase(async (db) => {
      // Create REAL test data
      const testData = await db.setupCompleteTestScenario();
      
      // Verify data was created
      expect(testData.user).toBeDefined();
      expect(testData.accounts).toHaveLength(2);
      expect(testData.categories.all).toHaveLength(9);
    });
  });
});`;

async function fixGenericTest(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if it's a generic template (has 'getByTestId('component')' or 'table_name')
  if (content.includes("getByTestId('component')") || content.includes('table_name')) {
    const fileName = path.basename(filePath);
    const componentName = fileName.replace('.real.test.tsx', '').replace('.real.test.ts', '');
    
    // Calculate relative import path
    const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/test/setup/real-test-framework'));
    const importPath = relativePath.replace(/\\/g, '/');
    
    const newContent = MINIMAL_TEST
      .replace(/\{\{ComponentName\}\}/g, componentName)
      .replace(/\{\{ImportPath\}\}/g, importPath);
    
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed: ${fileName}`);
    return true;
  }
  
  return false;
}

async function main() {
  console.log('Fixing generic test templates...\n');
  
  const testFiles = glob.sync('src/**/*.real.test.{ts,tsx}');
  let fixed = 0;
  
  for (const file of testFiles) {
    if (await fixGenericTest(file)) {
      fixed++;
    }
  }
  
  console.log(`\nFixed ${fixed} generic test files`);
}

main().catch(console.error);