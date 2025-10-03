#!/usr/bin/env node
/**
 * Script to systematically convert all mock-based tests to real infrastructure tests
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Find all test files
function findTestFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist')) {
      findTestFiles(filePath, fileList);
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      if (!file.includes('.real.test') && !file.includes('.bak')) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Check if file contains mocks
function containsMocks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('vi.mock') || 
         content.includes('jest.mock') || 
         content.includes('mockResolvedValue') ||
         content.includes('mockReturnValue');
}

// Categorize test files
function categorizeTests(testFiles) {
  const categories = {
    services: [],
    components: [],
    hooks: [],
    utils: [],
    contexts: [],
    store: [],
    integration: [],
    other: []
  };
  
  testFiles.forEach(file => {
    if (file.includes('/services/')) categories.services.push(file);
    else if (file.includes('/components/')) categories.components.push(file);
    else if (file.includes('/hooks/')) categories.hooks.push(file);
    else if (file.includes('/utils/')) categories.utils.push(file);
    else if (file.includes('/contexts/')) categories.contexts.push(file);
    else if (file.includes('/store/')) categories.store.push(file);
    else if (file.includes('/integration/')) categories.integration.push(file);
    else categories.other.push(file);
  });
  
  return categories;
}

// Conversion templates for different test types
const conversionTemplates = {
  service: (fileName) => `/**
 * ${path.basename(fileName, '.test.ts')} REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use real Supabase test instance
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data - using valid UUIDs
const TEST_USER_ID = '${Math.random().toString(36).substring(2, 10)}-0000-0000-0000-' + Date.now().toString().padStart(12, '0').slice(-12);
const TEST_CLERK_ID = 'test_clerk_' + Date.now();

describe('${path.basename(fileName, '.test.ts')} - REAL Database Tests', () => {
  beforeEach(async () => {
    // Setup real test data
  });

  afterEach(async () => {
    // Clean up real test data
  });

  // Convert existing tests to use real infrastructure
});`,

  component: (fileName) => `/**
 * ${path.basename(fileName, '.test.tsx')} REAL Test
 * Testing with real data and services
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createClient } from '@supabase/supabase-js';

// Use real services, not mocks
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

describe('${path.basename(fileName, '.test.tsx')} - REAL Tests', () => {
  // Convert to real component tests
});`
};

// Main conversion function
async function convertTests() {
  log('\n🚀 Test Conversion Script', colors.bright + colors.blue);
  log('Converting mock-based tests to real infrastructure tests\n', colors.blue);
  
  const srcPath = path.join(process.cwd(), 'src');
  const testFiles = findTestFiles(srcPath);
  
  log(`Found ${testFiles.length} test files`, colors.yellow);
  
  const categories = categorizeTests(testFiles);
  
  // Report statistics
  log('\n📊 Test File Categories:', colors.bright);
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length > 0) {
      log(`  ${category}: ${files.length} files`, colors.green);
    }
  });
  
  // Check for mocks
  let mockedFiles = [];
  let cleanFiles = [];
  
  testFiles.forEach(file => {
    if (containsMocks(file)) {
      mockedFiles.push(file);
    } else {
      cleanFiles.push(file);
    }
  });
  
  log(`\n📈 Mock Usage:`, colors.bright);
  log(`  Files with mocks: ${mockedFiles.length}`, colors.red);
  log(`  Clean files: ${cleanFiles.length}`, colors.green);
  
  // List files that need conversion
  if (mockedFiles.length > 0) {
    log('\n🔄 Files requiring conversion:', colors.yellow);
    mockedFiles.slice(0, 10).forEach(file => {
      log(`  - ${path.relative(process.cwd(), file)}`, colors.reset);
    });
    if (mockedFiles.length > 10) {
      log(`  ... and ${mockedFiles.length - 10} more`, colors.reset);
    }
  }
  
  // Progress report
  const realTestFiles = testFiles.filter(f => f.includes('.real.test'));
  const conversionProgress = ((realTestFiles.length / testFiles.length) * 100).toFixed(1);
  
  log('\n📊 Conversion Progress:', colors.bright);
  log(`  Total test files: ${testFiles.length}`, colors.blue);
  log(`  Real test files: ${realTestFiles.length}`, colors.green);
  log(`  Progress: ${conversionProgress}%`, colors.yellow);
  
  // Next steps
  log('\n🎯 Next Steps:', colors.bright);
  if (mockedFiles.length > 0) {
    log('1. Remove vi.mock() and jest.mock() calls', colors.reset);
    log('2. Replace mock data with real database operations', colors.reset);
    log('3. Add proper test data setup and cleanup', colors.reset);
    log('4. Ensure foreign key constraints are respected', colors.reset);
    log('5. Run tests to verify they work with real infrastructure', colors.reset);
  } else {
    log('✅ All tests have been converted to use real infrastructure!', colors.green);
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalTests: testFiles.length,
    realTests: realTestFiles.length,
    mockedTests: mockedFiles.length,
    cleanTests: cleanFiles.length,
    progress: conversionProgress,
    categories: Object.fromEntries(
      Object.entries(categories).map(([k, v]) => [k, v.length])
    ),
    filesWithMocks: mockedFiles.map(f => path.relative(process.cwd(), f))
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'test-conversion-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  log('\n📄 Report saved to test-conversion-report.json', colors.green);
}

// Run the script
convertTests().catch(console.error);