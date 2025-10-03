#!/usr/bin/env node

/**
 * Script to verify that all REAL tests are ready
 * and we can safely delete the old mock tests
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

async function main() {
  console.log(`${colors.blue}=== Verifying REAL Test Conversion ===${colors.reset}\n`);
  
  // Find all test files
  const mockTests = glob.sync('src/**/*.test.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/*.real.test.*'],
  });
  
  const realTests = glob.sync('src/**/*.real.test.{ts,tsx}', {
    ignore: ['**/node_modules/**'],
  });
  
  console.log(`Mock tests found: ${colors.yellow}${mockTests.length}${colors.reset}`);
  console.log(`Real tests found: ${colors.green}${realTests.length}${colors.reset}\n`);
  
  // Check for corresponding real tests
  const missingRealTests = [];
  const readyToDelete = [];
  
  for (const mockTest of mockTests) {
    const expectedRealTest = mockTest.replace('.test.', '.real.test.');
    if (fs.existsSync(expectedRealTest)) {
      readyToDelete.push(mockTest);
    } else {
      // Check if it's a test without mocks (doesn't need conversion)
      const content = fs.readFileSync(mockTest, 'utf8');
      const hasMocks = content.includes('vi.mock(') || 
                       content.includes('jest.mock(') ||
                       content.includes('vi.fn(') ||
                       content.includes('jest.fn(');
      
      if (hasMocks) {
        missingRealTests.push(mockTest);
      }
    }
  }
  
  // Report findings
  if (missingRealTests.length > 0) {
    console.log(`${colors.red}⚠ Missing REAL test replacements:${colors.reset}`);
    missingRealTests.forEach(test => {
      console.log(`  - ${path.relative(process.cwd(), test)}`);
    });
    console.log();
  }
  
  console.log(`${colors.green}✓ Ready to delete ${readyToDelete.length} mock tests${colors.reset}\n`);
  
  // Show some statistics
  const stats = {
    components: readyToDelete.filter(f => f.includes('/components/')).length,
    services: readyToDelete.filter(f => f.includes('/services/')).length,
    contexts: readyToDelete.filter(f => f.includes('/contexts/')).length,
    hooks: readyToDelete.filter(f => f.includes('/hooks/')).length,
    pages: readyToDelete.filter(f => f.includes('/pages/')).length,
    utils: readyToDelete.filter(f => f.includes('/utils/')).length,
    other: readyToDelete.filter(f => 
      !f.includes('/components/') && 
      !f.includes('/services/') && 
      !f.includes('/contexts/') && 
      !f.includes('/hooks/') && 
      !f.includes('/pages/') &&
      !f.includes('/utils/')
    ).length,
  };
  
  console.log(`${colors.blue}Ready to delete by type:${colors.reset}`);
  console.log(`  Components: ${stats.components}`);
  console.log(`  Services: ${stats.services}`);
  console.log(`  Contexts: ${stats.contexts}`);
  console.log(`  Hooks: ${stats.hooks}`);
  console.log(`  Pages: ${stats.pages}`);
  console.log(`  Utils: ${stats.utils}`);
  console.log(`  Other: ${stats.other}`);
  
  // Create deletion script
  if (readyToDelete.length > 0) {
    const deleteScript = `#!/usr/bin/env node
// Auto-generated script to delete old mock tests
import fs from 'fs';

const filesToDelete = ${JSON.stringify(readyToDelete, null, 2)};

console.log('Deleting ${readyToDelete.length} old mock test files...');

let deleted = 0;
for (const file of filesToDelete) {
  try {
    fs.unlinkSync(file);
    deleted++;
    console.log('Deleted:', file);
  } catch (error) {
    console.error('Failed to delete:', file, error.message);
  }
}

console.log('\\nDeleted', deleted, 'out of', filesToDelete.length, 'files');
`;
    
    const deleteScriptPath = path.join(__dirname, 'delete-mock-tests.js');
    fs.writeFileSync(deleteScriptPath, deleteScript);
    console.log(`\n${colors.green}✓ Created deletion script: ${deleteScriptPath}${colors.reset}`);
    console.log(`  Run: ${colors.yellow}node scripts/delete-mock-tests.js${colors.reset} to delete old mock tests`);
  }
  
  // Final recommendation
  console.log(`\n${colors.blue}=== Recommendations ===${colors.reset}`);
  console.log('1. Review the generated REAL test files');
  console.log('2. Ensure test database is configured in .env.test');
  console.log('3. Run a sample of REAL tests to verify they work');
  console.log('4. Once verified, run: node scripts/delete-mock-tests.js');
  console.log('5. Commit the changes\n');
  
  if (missingRealTests.length === 0) {
    console.log(`${colors.green}✅ All mock tests have REAL replacements!${colors.reset}`);
    console.log(`${colors.green}   Safe to proceed with deletion.${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ ${missingRealTests.length} tests still need conversion${colors.reset}`);
  }
}

main().catch(console.error);