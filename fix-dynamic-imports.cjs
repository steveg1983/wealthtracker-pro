#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that have dynamic import issues
const filesToFix = [
  'src/App.tsx',
  'src/components/charts/OptimizedCharts.tsx'
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
    
    // Fix lazy imports to explicitly return default
    // Pattern: lazy(() => import('./SomeComponent'))
    // Should be: lazy(() => import('./SomeComponent').then(m => ({ default: m.default || m })))
    
    content = content.replace(
      /lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)\)/g,
      (match, importPath) => {
        totalFixed++;
        return `lazy(() => import('${importPath}').then(m => ({ default: m.default || m })))`;
      }
    );

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nTotal fixes applied: ${totalFixed}`);