#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Components that need default exports
const componentsToFix = [
  { file: 'src/components/charts/ChartComponents.tsx', name: 'ChartComponents' },
  { file: 'src/pages/settings/AccessibilitySettings.tsx', name: 'AccessibilitySettings' },
  { file: 'src/pages/AccountTransactions.tsx', name: 'AccountTransactions' },
  { file: 'src/pages/FinancialSummaries.tsx', name: 'FinancialSummaries' },
  { file: 'src/pages/EnhancedInvestments.tsx', name: 'EnhancedInvestments' }
];

let totalFixed = 0;

componentsToFix.forEach(({ file, name }) => {
  try {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${file}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if already has default export
    if (content.includes('export default')) {
      console.log(`Already has default export: ${file}`);
      return;
    }
    
    // Check if component exists as named export
    const namedExportRegex = new RegExp(`export (const|function|class) ${name}`);
    if (namedExportRegex.test(content)) {
      // Add default export at the end
      content = content.trimEnd() + `\n\nexport default ${name};\n`;
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Added default export to ${file}`);
      totalFixed++;
    } else {
      console.log(`Component ${name} not found in ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal fixes applied: ${totalFixed}`);