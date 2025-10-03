#!/usr/bin/env node

/**
 * Script to identify and help replace all mock tests with REAL tests
 * Run: node scripts/replace-mock-tests.js
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

// Find all test files
function findTestFiles(dir) {
  return glob.sync(`${dir}/**/*.test.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.real.test.*', '**/*.proper.test.*']
  });
}

// Analyze test file for mocks
function analyzeTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const analysis = {
    filePath,
    fileName: path.basename(filePath),
    hasMocks: false,
    mockCount: 0,
    mocks: [],
    viMocks: [],
    jestMocks: [],
    isComponentTest: filePath.includes('/components/'),
    isServiceTest: filePath.includes('/services/'),
    isContextTest: filePath.includes('/contexts/'),
    isHookTest: filePath.includes('/hooks/'),
    isUtilTest: filePath.includes('/utils/'),
  };

  // Find vi.mock() calls
  const viMockRegex = /vi\.mock\(['"](.*?)['"]/g;
  let match;
  while ((match = viMockRegex.exec(content)) !== null) {
    analysis.hasMocks = true;
    analysis.mockCount++;
    analysis.viMocks.push(match[1]);
  }

  // Find jest.mock() calls
  const jestMockRegex = /jest\.mock\(['"](.*?)['"]/g;
  while ((match = jestMockRegex.exec(content)) !== null) {
    analysis.hasMocks = true;
    analysis.mockCount++;
    analysis.jestMocks.push(match[1]);
  }

  // Find mock function declarations
  const mockFnRegex = /(?:const|let|var)\s+mock\w+\s*=\s*(?:vi|jest)\.fn\(/g;
  while ((match = mockFnRegex.exec(content)) !== null) {
    analysis.hasMocks = true;
    analysis.mockCount++;
    analysis.mocks.push('Mock function');
  }

  return analysis;
}

// Generate replacement file path
function getReplacementPath(originalPath) {
  return originalPath.replace('.test.', '.real.test.');
}

// Generate replacement test content
function generateRealTest(analysis) {
  const componentName = analysis.fileName
    .replace('.test.tsx', '')
    .replace('.test.ts', '');

  let testType = 'Component';
  if (analysis.isServiceTest) testType = 'Service';
  if (analysis.isContextTest) testType = 'Context';
  if (analysis.isHookTest) testType = 'Hook';
  if (analysis.isUtilTest) testType = 'Utility';

  return `/**
 * ${componentName} REAL DATABASE Tests
 * Converted from mock test to REAL database test
 * Original: ${analysis.fileName}
 * 
 * REMOVED MOCKS:
${analysis.viMocks.map(m => ` * - ${m}`).join('\n')}
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ${componentName} from './${componentName}';
import { 
  RealTestDatabase,
  renderWithRealData,
  withRealDatabase
} from '../test/setup/real-test-framework';

describe('${componentName} - REAL DATABASE TESTS', () => {
  let db: RealTestDatabase;

  beforeAll(async () => {
    db = new RealTestDatabase();
    // Setup REAL test data
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('REAL ${testType} Tests', () => {
    it('tests with REAL database operations', async () => {
      // TODO: Implement REAL test
      // 1. Create REAL data in database
      // 2. Perform REAL operations
      // 3. Verify REAL results
      
      await withRealDatabase(async (db) => {
        const testData = await db.setupCompleteTestScenario();
        
        // Test with REAL data
        expect(testData.user).toBeDefined();
        expect(testData.accounts).toHaveLength(2);
      });
    });
  });
});`;
}

// Main execution
async function main() {
  console.log(`${colors.blue}=== Mock Test Replacement Analysis ===${colors.reset}\n`);

  const testFiles = findTestFiles(path.join(__dirname, '../src'));
  console.log(`Found ${colors.yellow}${testFiles.length}${colors.reset} test files\n`);

  const results = {
    total: testFiles.length,
    withMocks: 0,
    withoutMocks: 0,
    byType: {
      component: 0,
      service: 0,
      context: 0,
      hook: 0,
      util: 0,
      other: 0,
    },
    files: [],
  };

  // Analyze each file
  testFiles.forEach(file => {
    const analysis = analyzeTestFile(file);
    results.files.push(analysis);

    if (analysis.hasMocks) {
      results.withMocks++;
      console.log(`${colors.red}✗${colors.reset} ${path.relative(process.cwd(), file)}`);
      console.log(`  ${colors.yellow}${analysis.mockCount} mocks found${colors.reset}`);
      if (analysis.viMocks.length > 0) {
        console.log(`  Mocking: ${analysis.viMocks.slice(0, 3).join(', ')}${analysis.viMocks.length > 3 ? '...' : ''}`);
      }
    } else {
      results.withoutMocks++;
      console.log(`${colors.green}✓${colors.reset} ${path.relative(process.cwd(), file)} - No mocks`);
    }

    // Count by type
    if (analysis.isComponentTest) results.byType.component++;
    else if (analysis.isServiceTest) results.byType.service++;
    else if (analysis.isContextTest) results.byType.context++;
    else if (analysis.isHookTest) results.byType.hook++;
    else if (analysis.isUtilTest) results.byType.util++;
    else results.byType.other++;
  });

  // Summary
  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`Total test files: ${results.total}`);
  console.log(`${colors.red}With mocks: ${results.withMocks}${colors.reset}`);
  console.log(`${colors.green}Without mocks: ${results.withoutMocks}${colors.reset}`);
  console.log(`\nBy Type:`);
  console.log(`  Components: ${results.byType.component}`);
  console.log(`  Services: ${results.byType.service}`);
  console.log(`  Contexts: ${results.byType.context}`);
  console.log(`  Hooks: ${results.byType.hook}`);
  console.log(`  Utils: ${results.byType.util}`);
  console.log(`  Other: ${results.byType.other}`);

  // Generate conversion plan
  console.log(`\n${colors.blue}=== Conversion Plan ===${colors.reset}`);
  console.log(`${results.withMocks} files need to be converted to REAL tests\n`);

  // Create conversion report
  const report = {
    timestamp: new Date().toISOString(),
    summary: results,
    conversions: results.files
      .filter(f => f.hasMocks)
      .map(f => ({
        original: f.filePath,
        replacement: getReplacementPath(f.filePath),
        mockCount: f.mockCount,
        mocks: f.viMocks.concat(f.jestMocks),
      })),
  };

  // Save report
  const reportPath = path.join(__dirname, '../test-conversion-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${colors.green}${reportPath}${colors.reset}`);

  // Generate sample conversions
  console.log(`\n${colors.blue}=== Generating Sample Conversions ===${colors.reset}`);
  
  const samplesToGenerate = 5;
  const mockedFiles = results.files.filter(f => f.hasMocks).slice(0, samplesToGenerate);
  
  mockedFiles.forEach(file => {
    const realTestPath = getReplacementPath(file.filePath);
    const realTestContent = generateRealTest(file);
    
    console.log(`Generated: ${colors.green}${path.basename(realTestPath)}${colors.reset}`);
    
    // Uncomment to actually create files:
    // fs.writeFileSync(realTestPath, realTestContent);
  });

  console.log(`\n${colors.yellow}Next Steps:${colors.reset}`);
  console.log('1. Set up test database in Supabase');
  console.log('2. Configure .env.test with database credentials');
  console.log('3. Run: npm run convert-tests to start conversion');
  console.log('4. Review and update each generated REAL test');
  console.log('5. Delete old mock tests once REAL tests pass');
}

// Run the script
main().catch(console.error);