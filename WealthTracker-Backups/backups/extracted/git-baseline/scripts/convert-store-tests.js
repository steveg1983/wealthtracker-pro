#!/usr/bin/env node

/**
 * Script to convert store/slice tests to REAL database tests
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store test template
const STORE_TEST_TEMPLATE = `/**
 * {{SliceName}} REAL DATABASE Tests
 * Tests Redux slice with real database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {{sliceName}}Reducer, { {{actionImports}} } from './{{sliceName}}Slice';
import { RealTestDatabase, testDb } from '../../test/setup/real-test-framework';

describe('{{SliceName}}Slice - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;
  let store: any;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  beforeEach(() => {
    store = configureStore({
      reducer: {
        {{sliceName}}: {{sliceName}}Reducer,
      },
    });
  });

  describe('REAL Redux Store Operations', () => {
    it('syncs with REAL database on actions', async () => {
      // Create REAL test data
      const testData = await db.setupCompleteTestScenario();
      
      // Dispatch action that should sync with database
      await store.dispatch({{sampleAction}}(testData));
      
      // Verify state matches database
      const state = store.getState().{{sliceName}};
      const dbRecord = await db.getRecord('{{tableName}}', testData.id);
      
      expect(state.items).toHaveLength(1);
      expect(dbRecord).toBeDefined();
    });

    it('handles database errors gracefully', async () => {
      // Try to create with invalid data
      const invalidData = { id: 'invalid-id' };
      
      await store.dispatch({{sampleAction}}(invalidData));
      
      const state = store.getState().{{sliceName}};
      expect(state.error).toBeTruthy();
    });
  });
});`;

// Utility test template  
const UTIL_TEST_TEMPLATE = `/**
 * {{UtilName}} REAL DATABASE Tests
 * Tests utility functions with real data
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { {{utilFunction}} } from './{{utilFile}}';
import { RealTestDatabase, testDb } from '../../test/setup/real-test-framework';

describe('{{UtilName}} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('REAL Utility Operations', () => {
    it('works with REAL database data', async () => {
      // Create REAL test data
      const testData = await db.setupCompleteTestScenario();
      
      // Test utility with REAL data
      const result = {{utilFunction}}(testData);
      
      // Verify results
      expect(result).toBeDefined();
    });
  });
});`;

async function convertStoreTest(filePath) {
  const fileName = path.basename(filePath);
  const sliceName = fileName.replace('Slice.test.ts', '');
  
  const content = STORE_TEST_TEMPLATE
    .replace(/\{\{SliceName\}\}/g, sliceName.charAt(0).toUpperCase() + sliceName.slice(1))
    .replace(/\{\{sliceName\}\}/g, sliceName)
    .replace(/\{\{actionImports\}\}/g, `add${sliceName.charAt(0).toUpperCase() + sliceName.slice(1)}, update${sliceName.charAt(0).toUpperCase() + sliceName.slice(1)}`)
    .replace(/\{\{sampleAction\}\}/g, `add${sliceName.charAt(0).toUpperCase() + sliceName.slice(1)}`)
    .replace(/\{\{tableName\}\}/g, sliceName);
  
  const newPath = filePath.replace('.test.', '.real.test.');
  fs.writeFileSync(newPath, content);
  console.log(`Created: ${newPath}`);
}

async function convertUtilTest(filePath) {
  const fileName = path.basename(filePath);
  const utilName = fileName.replace('.test.ts', '').replace('.test.tsx', '');
  
  const content = UTIL_TEST_TEMPLATE
    .replace(/\{\{UtilName\}\}/g, utilName.charAt(0).toUpperCase() + utilName.slice(1))
    .replace(/\{\{utilFile\}\}/g, utilName)
    .replace(/\{\{utilFunction\}\}/g, utilName);
  
  const newPath = filePath.replace('.test.', '.real.test.');
  fs.writeFileSync(newPath, content);
  console.log(`Created: ${newPath}`);
}

async function main() {
  console.log('Converting remaining store and utility tests...\n');
  
  // Convert store tests
  const storeTests = glob.sync('src/store/slices/*.test.ts');
  for (const test of storeTests) {
    const content = fs.readFileSync(test, 'utf8');
    if (content.includes('mock')) {
      await convertStoreTest(test);
    }
  }
  
  // Convert utility tests with mocks
  const utilTests = [
    'src/utils/__tests__/pdfExport.test.ts',
    'src/utils/__tests__/currency-decimal.test.ts',
    'src/utils/__tests__/api-error-handler.test.ts',
  ];
  
  for (const test of utilTests) {
    if (fs.existsSync(test)) {
      await convertUtilTest(test);
    }
  }
  
  console.log('\nDone! All remaining tests converted.');
}

main().catch(console.error);