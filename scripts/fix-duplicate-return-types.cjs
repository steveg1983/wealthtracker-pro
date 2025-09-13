#!/usr/bin/env node

/**
 * Fix Duplicate Return Types Script
 * Removes duplicate React.JSX.Element return type declarations
 */

const fs = require('fs');
const path = require('path');

let fixed = 0;

console.log('🔧 Fixing duplicate return types...\n');

function fixDuplicateReturnTypes(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Pattern to match duplicate return types
        // }: Props): React.JSX.Element {\n  // Component...\n  useEffect...\n}: React.JSX.Element {
        const duplicatePattern = /(}\s*:\s*\w+Props\)\s*:\s*React\.JSX\.Element\s*{\s*\n\s*\/\/\s*Component initialization logging[\s\S]*?\}\s*,\s*\[\]\);\s*\n)\s*:\s*React\.JSX\.Element\s*{/g;
        
        if (duplicatePattern.test(content)) {
            const newContent = content.replace(duplicatePattern, (match, firstPart) => {
                return firstPart;  // Keep only the first part, remove the duplicate return type
            });
            
            fs.writeFileSync(filePath, newContent);
            console.log(`✅ Fixed duplicate return type: ${path.basename(filePath)}`);
            fixed++;
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

function findAffectedFiles() {
    const affectedFiles = [];
    
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
                        // Check for files with duplicate return types
                        const matches = content.match(/React\.JSX\.Element/g);
                        if (matches && matches.length > 1) {
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

function main() {
    const affectedFiles = findAffectedFiles();
    console.log(`📊 Found ${affectedFiles.length} files to check\n`);
    
    for (const file of affectedFiles) {
        fixDuplicateReturnTypes(file);
    }
    
    console.log(`\n✅ Fixed ${fixed} files with duplicate return types`);
}

main();