#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that need logger import
const filesToFix = [
  'src/components/BalanceReconciliationModal.tsx',
  'src/components/pwa/QuickAddOfflineButton.tsx',
  'src/components/RealTimePortfolioEnhanced.tsx'
];

let totalFixed = 0;

filesToFix.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Check if logger is used but not imported
    if (content.includes('logger.') && !content.includes("import { logger }")) {
      // Find the right place to add the import (after other imports)
      const importMatch = content.match(/^import .+ from .+;$/m);
      if (importMatch) {
        const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
        
        // Determine the correct relative path to loggingService
        const depth = filePath.split('/').length - 2; // -2 for src/ prefix
        const relativePath = '../'.repeat(depth) + 'services/loggingService';
        
        content = content.substring(0, lastImportIndex) + 
                  `\nimport { logger } from '${relativePath}';` +
                  content.substring(lastImportIndex);
        totalFixed++;
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nTotal fixes applied: ${totalFixed}`);