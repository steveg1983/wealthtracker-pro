#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that need investments fix
const filesToFix = [
  'src/components/widgets/InvestmentEnhancementWidget.tsx',
  'src/components/widgets/InvestmentSummaryWidget.tsx'
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
    
    // Fix destructuring of investments to have default value
    content = content.replace(
      /const\s*{\s*([^}]*)\binvestments\b([^}]*)\}\s*=\s*useApp\(\)/g,
      (match, before, after) => {
        totalFixed++;
        return `const { ${before}investments = []${after}} = useApp()`;
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