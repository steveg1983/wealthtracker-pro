#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Add clearAllData and loadTestData methods
const appContextFiles = [
  'src/contexts/AppContextSupabase.tsx'
];

let totalFixed = 0;

// Fix AppContextSupabase to add missing methods
appContextFiles.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Add clearAllData if missing
    if (!content.includes('clearAllData:') && content.includes('export interface AppContextType')) {
      content = content.replace(
        /(\s+)isLoading: boolean;/,
        '$1isLoading: boolean;\n$1clearAllData: () => Promise<void>;\n$1loadTestData: () => void;\n$1exportData: () => string;'
      );
      totalFixed++;
    }

    // Add to provider value if missing
    if (!content.includes('clearAllData,') && content.includes('isLoading,')) {
      content = content.replace(
        'isLoading,',
        'isLoading,\n    clearAllData: async () => { /* TODO: Implement */ },\n    loadTestData: () => { /* TODO: Implement */ },\n    exportData: () => JSON.stringify({ accounts, transactions, budgets, goals }),'
      );
      totalFixed++;
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