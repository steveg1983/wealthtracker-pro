#!/usr/bin/env node

/**
 * Script to convert all mock tests to REAL database tests
 * This script systematically replaces mock tests with real database tests
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Component test template
const COMPONENT_TEST_TEMPLATE = `/**
 * {{ComponentName}} REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {{ComponentName}} from './{{ComponentName}}';
import { 
  RealTestDatabase,
  renderWithRealData,
  withRealDatabase
} from '{{TestFrameworkPath}}';

describe('{{ComponentName}} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('REAL Component Tests', () => {
    it('works with REAL database operations', async () => {
      await withRealDatabase(async (db) => {
        const testData = await db.setupCompleteTestScenario();
        
        renderWithRealData(
          <{{ComponentName}} {{Props}} />
        );

        // Test with REAL data
        await waitFor(() => {
          expect(screen.getByTestId('component')).toBeInTheDocument();
        });
        
        // Verify REAL database state
        const dbRecord = await db.getRecord('table_name', testData.id);
        expect(dbRecord).toBeDefined();
      });
    });
  });
});`;

// Service test template
const SERVICE_TEST_TEMPLATE = `/**
 * {{ServiceName}} REAL DATABASE Tests
 * Tests actual service operations with real database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { {{ServiceName}} } from './{{ServiceName}}';
import { RealTestDatabase, testDb } from '{{TestFrameworkPath}}';

describe('{{ServiceName}} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;
  let service: {{ServiceName}};

  beforeAll(async () => {
    db = new RealTestDatabase();
    service = new {{ServiceName}}(testDb);
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('REAL Service Operations', () => {
    it('performs REAL database operations', async () => {
      // Create REAL test data
      const user = await db.createUser();
      const account = await db.createAccount(user.id);
      
      // Test service with REAL data
      const result = await service.performOperation(account.id);
      
      // Verify REAL database changes
      const updated = await db.getRecord('accounts', account.id);
      expect(updated).toMatchObject({
        // Verify expected changes
      });
    });
  });
});`;

// Context test template
const CONTEXT_TEST_TEMPLATE = `/**
 * {{ContextName}} REAL DATABASE Tests
 * Tests context with real database operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { {{ContextName}}Provider, use{{ContextName}} } from './{{ContextName}}';
import { RealTestDatabase, renderWithRealData, testDb } from '{{TestFrameworkPath}}';

describe('{{ContextName}} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('manages REAL data in database', async () => {
    const TestComponent = () => {
      const context = use{{ContextName}}();
      return <div>{JSON.stringify(context.data)}</div>;
    };

    renderWithRealData(
      <{{ContextName}}Provider>
        <TestComponent />
      </{{ContextName}}Provider>
    );

    // Create REAL data
    const realData = await db.createTestData();
    
    // Verify context reflects REAL database state
    await waitFor(async () => {
      const dbData = await testDb.from('table').select('*');
      expect(dbData.data).toHaveLength(1);
    });
  });
});`;

// Hook test template
const HOOK_TEST_TEMPLATE = `/**
 * {{HookName}} REAL DATABASE Tests
 * Tests hook with real database operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { {{HookName}} } from './{{HookName}}';
import { RealTestDatabase, RealTestProvider, testDb } from '{{TestFrameworkPath}}';

describe('{{HookName}} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('works with REAL database data', async () => {
    // Create REAL test data
    const testData = await db.setupCompleteTestScenario();
    
    const { result } = renderHook(() => {{HookName}}(), {
      wrapper: RealTestProvider,
    });

    // Test hook with REAL data
    await act(async () => {
      await result.current.performAction(testData.id);
    });

    // Verify REAL database changes
    await waitFor(async () => {
      const dbRecord = await db.getRecord('table', testData.id);
      expect(dbRecord).toBeDefined();
    });
  });
});`;

// Analyze file to determine type and extract info
function analyzeTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);
  
  // Extract component/service/context/hook name
  const baseName = fileName
    .replace('.test.tsx', '')
    .replace('.test.ts', '');
  
  // Determine test type
  let testType = 'component';
  if (dirName.includes('/services')) testType = 'service';
  else if (dirName.includes('/contexts')) testType = 'context';
  else if (dirName.includes('/hooks')) testType = 'hook';
  else if (dirName.includes('/utils')) testType = 'util';
  else if (dirName.includes('/store')) testType = 'store';
  
  // Check if it has mocks
  const hasMocks = content.includes('vi.mock(') || 
                   content.includes('jest.mock(') ||
                   content.includes('vi.fn(') ||
                   content.includes('jest.fn(');
  
  // Find what's being mocked
  const mocks = [];
  const mockRegex = /(?:vi|jest)\.mock\(['"]([^'"]+)['"]/g;
  let match;
  while ((match = mockRegex.exec(content)) !== null) {
    mocks.push(match[1]);
  }
  
  return {
    filePath,
    fileName,
    baseName,
    testType,
    hasMocks,
    mocks,
    relativePath: path.relative(process.cwd(), filePath),
  };
}

// Generate real test content based on type
function generateRealTestContent(fileInfo) {
  const testFrameworkPath = path.relative(
    path.dirname(fileInfo.filePath),
    path.join(process.cwd(), 'src/test/setup/real-test-framework')
  ).replace(/\\/g, '/');
  
  let template;
  switch (fileInfo.testType) {
    case 'service':
      template = SERVICE_TEST_TEMPLATE;
      break;
    case 'context':
      template = CONTEXT_TEST_TEMPLATE;
      break;
    case 'hook':
      template = HOOK_TEST_TEMPLATE;
      break;
    default:
      template = COMPONENT_TEST_TEMPLATE;
  }
  
  // Replace placeholders
  return template
    .replace(/\{\{ComponentName\}\}/g, fileInfo.baseName)
    .replace(/\{\{ServiceName\}\}/g, fileInfo.baseName)
    .replace(/\{\{ContextName\}\}/g, fileInfo.baseName.replace('Context', ''))
    .replace(/\{\{HookName\}\}/g, fileInfo.baseName)
    .replace(/\{\{TestFrameworkPath\}\}/g, testFrameworkPath)
    .replace(/\{\{Props\}\}/g, '/* Add props as needed */');
}

// Convert a single test file
async function convertTestFile(filePath, options = {}) {
  const fileInfo = analyzeTestFile(filePath);
  
  if (!fileInfo.hasMocks && !options.force) {
    return { status: 'skipped', reason: 'no mocks found' };
  }
  
  // Generate new test content
  const newContent = generateRealTestContent(fileInfo);
  
  // Determine new file path
  const newFilePath = filePath.replace('.test.', '.real.test.');
  
  if (options.dryRun) {
    console.log(`${colors.yellow}Would create:${colors.reset} ${newFilePath}`);
    return { status: 'dry-run', newPath: newFilePath };
  }
  
  // Write new test file
  fs.writeFileSync(newFilePath, newContent);
  
  // Optionally delete old test file
  if (options.deleteOld) {
    fs.unlinkSync(filePath);
    console.log(`${colors.red}Deleted:${colors.reset} ${filePath}`);
  }
  
  console.log(`${colors.green}Created:${colors.reset} ${newFilePath}`);
  return { status: 'converted', newPath: newFilePath };
}

// Main conversion process
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    deleteOld: args.includes('--delete-old'),
    force: args.includes('--force'),
    pattern: args.find(a => a.startsWith('--pattern='))?.split('=')[1],
  };
  
  console.log(`${colors.blue}=== Converting Mock Tests to REAL Tests ===${colors.reset}\n`);
  
  // Find all test files
  const pattern = options.pattern || 'src/**/*.test.{ts,tsx}';
  const testFiles = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/*.real.test.*'],
  });
  
  console.log(`Found ${colors.yellow}${testFiles.length}${colors.reset} test files\n`);
  
  // Analyze all files
  const results = {
    total: testFiles.length,
    converted: 0,
    skipped: 0,
    errors: 0,
  };
  
  // Group by type for organized conversion
  const filesByType = {
    component: [],
    service: [],
    context: [],
    hook: [],
    util: [],
    store: [],
    other: [],
  };
  
  testFiles.forEach(file => {
    const info = analyzeTestFile(file);
    if (info.hasMocks || options.force) {
      filesByType[info.testType]?.push(info) || filesByType.other.push(info);
    }
  });
  
  // Convert files by type
  console.log(`${colors.blue}Converting Component Tests (${filesByType.component.length})${colors.reset}`);
  for (const fileInfo of filesByType.component) {
    try {
      const result = await convertTestFile(fileInfo.filePath, options);
      if (result.status === 'converted') results.converted++;
      else if (result.status === 'skipped') results.skipped++;
    } catch (error) {
      console.error(`${colors.red}Error converting ${fileInfo.fileName}:${colors.reset}`, error.message);
      results.errors++;
    }
  }
  
  console.log(`\n${colors.blue}Converting Service Tests (${filesByType.service.length})${colors.reset}`);
  for (const fileInfo of filesByType.service) {
    try {
      const result = await convertTestFile(fileInfo.filePath, options);
      if (result.status === 'converted') results.converted++;
      else if (result.status === 'skipped') results.skipped++;
    } catch (error) {
      console.error(`${colors.red}Error converting ${fileInfo.fileName}:${colors.reset}`, error.message);
      results.errors++;
    }
  }
  
  console.log(`\n${colors.blue}Converting Context Tests (${filesByType.context.length})${colors.reset}`);
  for (const fileInfo of filesByType.context) {
    try {
      const result = await convertTestFile(fileInfo.filePath, options);
      if (result.status === 'converted') results.converted++;
      else if (result.status === 'skipped') results.skipped++;
    } catch (error) {
      console.error(`${colors.red}Error converting ${fileInfo.fileName}:${colors.reset}`, error.message);
      results.errors++;
    }
  }
  
  console.log(`\n${colors.blue}Converting Hook Tests (${filesByType.hook.length})${colors.reset}`);
  for (const fileInfo of filesByType.hook) {
    try {
      const result = await convertTestFile(fileInfo.filePath, options);
      if (result.status === 'converted') results.converted++;
      else if (result.status === 'skipped') results.skipped++;
    } catch (error) {
      console.error(`${colors.red}Error converting ${fileInfo.fileName}:${colors.reset}`, error.message);
      results.errors++;
    }
  }
  
  // Summary
  console.log(`\n${colors.blue}=== Conversion Summary ===${colors.reset}`);
  console.log(`Total files: ${results.total}`);
  console.log(`${colors.green}Converted: ${results.converted}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
  console.log(`${colors.red}Errors: ${results.errors}${colors.reset}`);
  
  if (options.dryRun) {
    console.log(`\n${colors.yellow}This was a dry run. No files were actually created.${colors.reset}`);
    console.log('Remove --dry-run to perform actual conversion.');
  }
  
  if (!options.deleteOld && results.converted > 0) {
    console.log(`\n${colors.yellow}Old test files were kept. Use --delete-old to remove them.${colors.reset}`);
  }
  
  console.log(`\n${colors.blue}Next Steps:${colors.reset}`);
  console.log('1. Review generated REAL test files');
  console.log('2. Update test-specific logic and assertions');
  console.log('3. Run tests to verify they work with real database');
  console.log('4. Delete old mock tests once REAL tests pass');
}

// Run the conversion
main().catch(console.error);