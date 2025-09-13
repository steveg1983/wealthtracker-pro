#!/usr/bin/env node

/**
 * Batch Add Logging Script
 * Systematically adds comprehensive logging to all React components
 * without existing logger imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const COMPONENTS_DIR = 'src/components';
const SKIP_PATTERNS = ['.test.tsx', '.real.test.tsx', '.backup.tsx'];
const LOGGER_IMPORT = "import { logger } from '../services/loggingService';";
const RELATIVE_LOGGER_IMPORT = "import { logger } from '../../services/loggingService';";

// Counters
let processed = 0;
let skipped = 0;
let errors = 0;

console.log('🚀 Starting batch logging addition process...\n');

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
    if (!filePath.endsWith('.tsx')) return false;
    
    for (const pattern of SKIP_PATTERNS) {
        if (filePath.includes(pattern)) return false;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Skip if already has logger import
        if (content.includes('from \'../services/loggingService\'') || 
            content.includes('from \'../../services/loggingService\'')) {
            return false;
        }
        // Must be a React component
        if (!content.includes('React') && !content.includes('FC') && !content.includes('function')) {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Get the correct logger import based on directory depth
 */
function getLoggerImport(filePath) {
    const depth = filePath.split(path.sep).length - 2; // Subtract src/components
    return depth > 2 ? RELATIVE_LOGGER_IMPORT : LOGGER_IMPORT;
}

/**
 * Extract component name from file path
 */
function getComponentName(filePath) {
    return path.basename(filePath, '.tsx');
}

/**
 * Add logging to a component file
 */
function addLoggingToComponent(filePath) {
    try {
        console.log(`📄 Processing: ${filePath}`);
        
        const content = fs.readFileSync(filePath, 'utf8');
        const componentName = getComponentName(filePath);
        const loggerImport = getLoggerImport(filePath);
        
        let newContent = content;
        
        // 1. Add logger import
        // Find the last import statement and add logger after it
        const importRegex = /^import.*from.*;$/gm;
        const imports = [...content.matchAll(importRegex)];
        
        if (imports.length > 0) {
            const lastImport = imports[imports.length - 1];
            const lastImportEnd = lastImport.index + lastImport[0].length;
            
            newContent = content.slice(0, lastImportEnd) + 
                        '\n' + loggerImport + 
                        content.slice(lastImportEnd);
        } else {
            // No imports found, add at the beginning
            newContent = loggerImport + '\n\n' + content;
        }
        
        // 2. Add useEffect import if missing
        if (!newContent.includes('useEffect')) {
            newContent = newContent.replace(
                /import React(.*?)from 'react'/,
                "import React, { useEffect$1from 'react'"
            );
        }
        
        // 3. Find function component and add initialization logging
        const componentPatterns = [
            new RegExp(`(export\\s+default\\s+function\\s+${componentName}\\s*\\([^)]*\\)\\s*{)`, 'g'),
            new RegExp(`(const\\s+${componentName}\\s*=\\s*memo\\(function\\s+${componentName}\\s*\\([^)]*\\)\\s*{?)`, 'g'),
            new RegExp(`(const\\s+${componentName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{)`, 'g'),
            new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\)\\s*{)`, 'g')
        ];
        
        let foundPattern = false;
        for (const pattern of componentPatterns) {
            if (pattern.test(newContent)) {
                foundPattern = true;
                newContent = newContent.replace(pattern, (match, p1) => {
                    return p1 + `\n  // Component initialization logging\n  useEffect(() => {\n    logger.info('${componentName} component initialized', {\n      componentName: '${componentName}'\n    });\n  }, []);\n`;
                });
                break;
            }
        }
        
        // 4. Add JSX.Element return type if missing
        newContent = newContent.replace(
            new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\))\\s*{`, 'g'),
            '$1: React.JSX.Element {'
        );
        
        // Create backup
        fs.copyFileSync(filePath, filePath + '.logging-backup');
        
        // Write the updated content
        fs.writeFileSync(filePath, newContent);
        
        console.log(`  ✅ Added logging to ${componentName}`);
        processed++;
        
    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
        errors++;
    }
}

/**
 * Recursively find all component files
 */
function findComponentFiles(dir) {
    const files = [];
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                files.push(...findComponentFiles(fullPath));
            } else if (shouldProcessFile(fullPath)) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return files;
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Scanning for components without logging...\n');
    
    const componentFiles = findComponentFiles(COMPONENTS_DIR);
    console.log(`📊 Found ${componentFiles.length} components to process\n`);
    
    if (componentFiles.length === 0) {
        console.log('🎉 All components already have logging!');
        return;
    }
    
    // Process high-priority components first
    const priorityOrder = [
        'financial', 'dashboard', 'chart', 'summary', 'import', 'export', 
        'transaction', 'account', 'budget', 'goal', 'report'
    ];
    
    const prioritizedFiles = componentFiles.sort((a, b) => {
        const aName = a.toLowerCase();
        const bName = b.toLowerCase();
        
        const aPriority = priorityOrder.findIndex(p => aName.includes(p));
        const bPriority = priorityOrder.findIndex(p => bName.includes(p));
        
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return 0;
    });
    
    // Process each file
    prioritizedFiles.forEach((filePath, index) => {
        console.log(`[${index + 1}/${prioritizedFiles.length}]`);
        addLoggingToComponent(filePath);
    });
    
    // Summary
    console.log('\n📈 Batch Processing Complete!');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total files: ${componentFiles.length}`);
    
    if (processed > 0) {
        console.log('\n🎉 Logging coverage significantly improved!');
        console.log('🔍 To verify: find src/components -name "*.tsx" ! -name "*.test.tsx" -exec grep -L "logger" {} \\; | wc -l');
    }
    
    if (errors > 0) {
        console.log('\n⚠️  Some files had errors. Check .logging-backup files to restore if needed.');
    }
}

// Run the script
main();