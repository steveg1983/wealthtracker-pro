#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that should use ../../services/loggingService (depth 2 files that got incorrectly changed)
const filesToFix = [
  'src/components/icons/index.tsx',
  'src/store/slices/notificationsSlice.ts',
  'src/store/slices/preferencesSlice.ts',
  'src/store/thunks/index.ts',
  'src/store/thunks/supabaseThunks.ts',
  'src/components/navigation/TopNavBar.tsx',
  'src/components/navigation/NavigationDropdown.tsx',
  'src/components/navigation/NotificationPanel.tsx',
  'src/components/navigation/UserMenu.tsx',
  'src/components/navigation/HelpMenu.tsx'
];

function fixImportPath(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace ../../../services/loggingService with ../../services/loggingService
  const newContent = content.replace(
    /import\s*{\s*logger\s*}\s*from\s*['"]\.\.\/..\/..\//,
    "import { logger } from '../../"
  );

  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent);
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`📝 No changes needed: ${filePath}`);
  }
}

console.log('🔧 Fixing remaining incorrect import paths...\n');

filesToFix.forEach(fixImportPath);

console.log('\n✨ Import path fixes completed!');