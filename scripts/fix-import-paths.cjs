#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * Fix import paths that are incorrectly using ../../services/loggingService
 * in nested directories that should use ../../../services/loggingService
 */

async function fixImportPaths() {
  console.log('🔧 Fixing import paths for loggingService...');
  
  // Find all TypeScript files in src
  const files = await glob('src/**/*.{ts,tsx}', { cwd: process.cwd() });
  
  let fixedCount = 0;
  const errors = [];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check if file contains the problematic import
      if (content.includes("import { logger } from '../../services/loggingService';")) {
        // Determine the correct import path based on file depth
        const relativePath = path.relative('src', file);
        const depth = relativePath.split('/').length - 1;
        
        let correctImportPath = '';
        if (depth >= 2) {
          // For files 2+ levels deep, use ../../../services/loggingService
          correctImportPath = '../../../services/loggingService';
        } else if (depth === 1) {
          // For files 1 level deep, use ../../services/loggingService  
          correctImportPath = '../../services/loggingService';
        } else {
          // For files at root level, use ../services/loggingService
          correctImportPath = '../services/loggingService';
        }
        
        // Only fix if current path is wrong for the depth
        if ((depth >= 2 && content.includes("'../../services/loggingService'")) ||
            (depth === 1 && content.includes("'../../../services/loggingService'")) ||
            (depth === 0 && content.includes("'../../services/loggingService'"))) {
          
          const newContent = content.replace(
            /import { logger } from '\.\.\/\.\.\/services\/loggingService';/g,
            `import { logger } from '${correctImportPath}';`
          );
          
          if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf-8');
            console.log(`✅ Fixed import path in ${file} (depth: ${depth})`);
            fixedCount++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
      errors.push({ file, error: error.message });
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Fixed import paths in ${fixedCount} files`);
  
  if (errors.length > 0) {
    console.log(`❌ Errors in ${errors.length} files:`);
    errors.forEach(({ file, error }) => {
      console.log(`   ${file}: ${error}`);
    });
  }
  
  console.log('✨ Import path fixes completed!');
}

fixImportPaths().catch(console.error);