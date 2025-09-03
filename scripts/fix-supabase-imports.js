#!/usr/bin/env node
/**
 * Script to fix all incorrect supabase import paths in test files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixImportPath(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Determine correct relative path based on file location
  const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/lib/supabase'));
  const correctImport = relativePath.replace(/\\/g, '/');
  
  // Fix the import
  let fixed = content;
  
  // Common incorrect patterns
  const patterns = [
    { from: "from '../lib/supabase'", to: `from '${correctImport}'` },
    { from: "from './lib/supabase'", to: `from '${correctImport}'` },
    { from: "from 'lib/supabase'", to: `from '${correctImport}'` },
  ];
  
  patterns.forEach(({ from, to }) => {
    if (fixed.includes(from)) {
      fixed = fixed.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      console.log(`✅ Fixed import in ${path.relative(process.cwd(), filePath)}`);
    }
  });
  
  // Also ensure we're using createClient correctly
  if (fixed.includes('import { supabase }') && !fixed.includes('createClient')) {
    // These files should import supabase directly
  } else if (fixed.includes('createClient') && !fixed.includes('@supabase/supabase-js')) {
    // Ensure createClient is imported from the right place
    if (!fixed.includes("from '@supabase/supabase-js'")) {
      fixed = fixed.replace(
        /import\s*{\s*createClient\s*}\s*from\s*['"][^'"]+['"]/,
        "import { createClient } from '@supabase/supabase-js'"
      );
    }
  }
  
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed);
  }
}

// Find all test files
function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules')) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.real.test.ts') || item.endsWith('.real.test.tsx')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

// Main
const srcPath = path.join(process.cwd(), 'src');
const testFiles = findTestFiles(srcPath);

console.log(`Found ${testFiles.length} real test files to check...`);

testFiles.forEach(fixImportPath);

console.log('✅ Import paths fixed!');