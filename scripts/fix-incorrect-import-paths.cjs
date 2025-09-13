#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * Fix incorrect import paths that were changed from ../../services/loggingService
 * to ../../../services/loggingService incorrectly by the previous script
 */

async function fixIncorrectImportPaths() {
  console.log('🔧 Fixing incorrect import paths for loggingService...');
  
  try {
    // Find all TypeScript files in src with the incorrect import path
    const files = await glob('src/**/*.{ts,tsx}', { cwd: process.cwd() });
    
    let fixedCount = 0;
    const errors = [];
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check if file has the incorrect import path
        if (content.includes("import { logger } from '../../../services/loggingService';")) {
          
          // Fix the import path by changing ../../../ back to ../../
          const newContent = content.replace(
            /import { logger } from '\.\.\/\.\.\/\.\.\/services\/loggingService';/g,
            "import { logger } from '../../services/loggingService';"
          );
          
          if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf-8');
            console.log(`✅ Fixed import path in ${file}`);
            fixedCount++;
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
    
  } catch (error) {
    console.error('❌ Critical error:', error);
    process.exit(1);
  }
}

fixIncorrectImportPaths().catch(console.error);