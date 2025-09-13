#!/usr/bin/env node

/**
 * Fix Logging Syntax Script
 * Repairs the syntax errors introduced by batch-add-logging.cjs
 * 
 * The problem: The batch script placed useEffect logging between function parameters
 * and the opening brace, breaking the syntax.
 */

const fs = require('fs');
const path = require('path');

// Counters
let fixed = 0;
let skipped = 0;
let errors = 0;
let backedUp = 0;

console.log('🔧 Starting syntax fix process...\n');

/**
 * Fix the broken function syntax pattern
 */
function fixComponentSyntax(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        let newContent = content;
        
        // Pattern 1: Fix function with misplaced useEffect and return type
        // Matches: }: Props)\n  // Component initialization logging\n  useEffect...\n: React.JSX.Element {
        const brokenPattern = /(}\s*:\s*\w+Props\))\s*\n\s*\/\/\s*Component initialization logging\s*\n\s*useEffect\([^}]+}\s*,\s*\[\]\);\s*\n:\s*(React\.JSX\.Element(?:\s*\|\s*null)?)\s*{/g;
        
        if (brokenPattern.test(newContent)) {
            // Create backup before modifying
            if (!fs.existsSync(filePath + '.syntax-backup')) {
                fs.copyFileSync(filePath, filePath + '.syntax-backup');
                backedUp++;
            }
            
            newContent = newContent.replace(brokenPattern, (match, propsEnd, returnType) => {
                // Extract the useEffect content
                const useEffectMatch = match.match(/(\/\/\s*Component initialization logging\s*\n\s*useEffect\([^}]+}\s*,\s*\[\]\);)/);
                const useEffectContent = useEffectMatch ? useEffectMatch[1] : '';
                
                // Reconstruct with correct syntax
                return `${propsEnd}: ${returnType} {\n  ${useEffectContent}`;
            });
            modified = true;
        }
        
        // Pattern 2: Fix NetWorthWidget literal \n\n in export
        if (filePath.includes('NetWorthWidget')) {
            const literalNewlinePattern = /}\);\n\\n\\nexport default/g;
            if (literalNewlinePattern.test(newContent)) {
                newContent = newContent.replace(literalNewlinePattern, '});\n\nexport default');
                modified = true;
            }
        }
        
        // Pattern 3: Fix duplicate const declarations (RecentTransactionsWidget)
        if (filePath.includes('RecentTransactionsWidget')) {
            // Look for duplicate const count declarations
            const countMatches = newContent.match(/const count = /g);
            if (countMatches && countMatches.length > 1) {
                // Remove the first simpler declaration, keep the more complex one
                newContent = newContent.replace(
                    /const count = settings\.count \|\| 5;\s*\n\s*\n\s*const count = typeof/,
                    'const count = typeof'
                );
                modified = true;
            }
        }
        
        // Pattern 4: Fix import paths for transaction table hooks
        if (filePath.includes('useColumnResize') || filePath.includes('useColumnDragDrop')) {
            const wrongImportPattern = /from "\.\.\/\.\.\/services\/loggingService"/g;
            if (wrongImportPattern.test(newContent)) {
                newContent = newContent.replace(wrongImportPattern, 'from "../../../services/loggingService"');
                modified = true;
            }
        }
        
        // Pattern 5: Fix BudgetVsActualWidget and similar patterns
        const alternativePattern = /(}\s*:\s*\w+Props\))\s*\n\s*\/\/\s*Component initialization logging\s*\n\s*useEffect/g;
        if (!modified && alternativePattern.test(newContent)) {
            // This is a broken pattern but might not have the full return type yet
            // Just ensure there's an opening brace after the props
            newContent = newContent.replace(alternativePattern, (match, propsEnd) => {
                return `${propsEnd}: React.JSX.Element {\n  // Component initialization logging\n  useEffect`;
            });
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, newContent);
            console.log(`✅ Fixed: ${path.basename(filePath)}`);
            fixed++;
            return true;
        } else {
            skipped++;
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        errors++;
        return false;
    }
}

/**
 * Find all potentially affected files
 */
function findAffectedFiles() {
    const affectedFiles = [];
    
    // Priority files we know are broken
    const priorityFiles = [
        'src/components/TransactionRow.tsx',
        'src/components/transactions/table/TransactionTableHeader.tsx',
        'src/components/widgets/NetWorthWidget.tsx',
        'src/components/widgets/RecentTransactionsWidget.tsx',
        'src/components/widgets/BudgetVsActualWidget.tsx',
        'src/components/transactions/table/useColumnResize.tsx',
        'src/components/transactions/table/useColumnDragDrop.tsx'
    ];
    
    // Add priority files first
    for (const file of priorityFiles) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            affectedFiles.push(fullPath);
        }
    }
    
    // Find other files with the pattern
    function searchDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    searchDir(fullPath);
                } else if (entry.name.endsWith('.tsx')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        // Check for the broken pattern
                        if (content.includes('// Component initialization logging') && 
                            content.includes('Props)') &&
                            !affectedFiles.includes(fullPath)) {
                            affectedFiles.push(fullPath);
                        }
                    } catch (e) {
                        // Skip files we can't read
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error.message);
        }
    }
    
    searchDir(path.join(process.cwd(), 'src/components'));
    
    return affectedFiles;
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Scanning for files with syntax errors...\n');
    
    const affectedFiles = findAffectedFiles();
    console.log(`📊 Found ${affectedFiles.length} files to check\n`);
    
    console.log('🚀 Processing priority files first...\n');
    
    for (const file of affectedFiles) {
        fixComponentSyntax(file);
    }
    
    console.log('\n📈 Summary:');
    console.log(`  ✅ Fixed: ${fixed} files`);
    console.log(`  ⏭️  Skipped: ${skipped} files (no issues found)`);
    console.log(`  💾 Backed up: ${backedUp} files`);
    if (errors > 0) {
        console.log(`  ❌ Errors: ${errors} files`);
    }
    
    if (fixed > 0) {
        console.log('\n✨ Syntax fixes applied successfully!');
        console.log('🔄 Please restart your dev server to see the changes.');
        console.log('💡 Backup files created with .syntax-backup extension');
    } else {
        console.log('\n✨ No syntax errors found to fix!');
    }
}

// Run the script
main();