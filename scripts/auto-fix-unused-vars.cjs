#!/usr/bin/env node
/**
 * Automated script to fix unused variable warnings
 * This follows the project's rules for fixing unused variables:
 * - Prefix unused parameters with underscore (_)
 * - Prefix unused destructured variables with underscore (_)
 * - Remove unused imports completely
 * - For catch blocks: change catch (error) to catch (_error)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all files with unused variable warnings
const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
const lines = lintOutput.split('\n');

const fixes = [];
let currentFile = null;

for (const line of lines) {
  // Check if this is a file path line
  if (line.startsWith('/')) {
    currentFile = line.trim();
    continue;
  }

  // Check if this is an unused variable warning
  if (line.includes('no-unused-vars')) {
    const match = line.match(/(\d+):(\d+)\s+warning\s+'([^']+)'/);
    if (match && currentFile) {
      const [, lineNum, column, varName] = match;
      fixes.push({
        file: currentFile,
        line: parseInt(lineNum),
        column: parseInt(column),
        varName,
        message: line
      });
    }
  }
}

console.log(`Found ${fixes.length} unused variable warnings across ${new Set(fixes.map(f => f.file)).size} files`);
console.log('\nFiles with most warnings:');

const fileCount = {};
fixes.forEach(f => {
  fileCount[f.file] = (fileCount[f.file] || 0) + 1;
});

Object.entries(fileCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([file, count]) => {
    console.log(`  ${count.toString().padStart(3)} - ${path.basename(file)}`);
  });

console.log('\nTo fix these manually, focus on these categories:');
console.log('1. Catch blocks: change catch (error) to catch (_error)');
console.log('2. Unused parameters: prefix with underscore (e.g., function foo(_unused, used))');
console.log('3. Unused imports: remove completely');
console.log('4. Unused destructured variables: prefix with underscore');
