#!/usr/bin/env node

/**
 * Test Coverage Analysis Script
 * Analyzes current test coverage and identifies gaps for 100% coverage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all source files that should be tested
function getSourceFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip certain directories
      if (!['node_modules', 'dist', 'build', '__tests__', 'test'].includes(item)) {
        getSourceFiles(fullPath, files);
      }
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      // Skip test files and config files
      if (!item.includes('.test.') && !item.includes('.spec.') && !item.includes('.config.')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

// Get all test files
function getTestFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build'].includes(item)) {
        getTestFiles(fullPath, files);
      }
    } else if (item.includes('.test.') || item.includes('.spec.')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Analyze coverage gaps
function analyzeCoverage() {
  const srcDir = path.join(__dirname, '..', 'src');
  const sourceFiles = getSourceFiles(srcDir);
  const testFiles = getTestFiles(srcDir);
  
  console.log('📊 Test Coverage Analysis\n');
  console.log('=======================\n');
  
  // Create map of source files to test files
  const coverageMap = new Map();
  
  sourceFiles.forEach(sourceFile => {
    const relativePath = path.relative(srcDir, sourceFile);
    const withoutExt = relativePath.replace(/\.(ts|tsx)$/, '');
    
    // Look for corresponding test file
    const possibleTestPaths = [
      path.join(srcDir, withoutExt + '.test.ts'),
      path.join(srcDir, withoutExt + '.test.tsx'),
      path.join(srcDir, path.dirname(withoutExt), '__tests__', path.basename(withoutExt) + '.test.ts'),
      path.join(srcDir, path.dirname(withoutExt), '__tests__', path.basename(withoutExt) + '.test.tsx'),
    ];
    
    const hasTest = possibleTestPaths.some(testPath => 
      testFiles.some(actualTest => path.resolve(actualTest) === path.resolve(testPath))
    );
    
    coverageMap.set(relativePath, hasTest);
  });
  
  // Categorize files
  const categories = {
    'Components': [],
    'Services': [],
    'Hooks': [],
    'Utils': [],
    'Contexts': [],
    'Store': [],
    'Types': [],
    'Other': []
  };
  
  coverageMap.forEach((hasCoverage, filePath) => {
    let category = 'Other';
    
    if (filePath.includes('components/')) category = 'Components';
    else if (filePath.includes('services/')) category = 'Services';
    else if (filePath.includes('hooks/')) category = 'Hooks';
    else if (filePath.includes('utils/')) category = 'Utils';
    else if (filePath.includes('contexts/')) category = 'Contexts';
    else if (filePath.includes('store/')) category = 'Store';
    else if (filePath.includes('types/')) category = 'Types';
    
    categories[category].push({
      file: filePath,
      hasCoverage,
      priority: getPriority(filePath)
    });
  });
  
  // Report by category
  let totalFiles = 0;
  let coveredFiles = 0;
  
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length === 0) return;
    
    const covered = files.filter(f => f.hasCoverage).length;
    const coverage = Math.round((covered / files.length) * 100);
    
    console.log(`📂 ${category}`);
    console.log(`   Coverage: ${covered}/${files.length} (${coverage}%)`);
    
    // Show missing files by priority
    const missing = files.filter(f => !f.hasCoverage);
    if (missing.length > 0) {
      const highPriority = missing.filter(f => f.priority === 'high');
      const mediumPriority = missing.filter(f => f.priority === 'medium');
      const lowPriority = missing.filter(f => f.priority === 'low');
      
      if (highPriority.length > 0) {
        console.log(`   🔴 Missing (High Priority):`);
        highPriority.forEach(f => console.log(`      - ${f.file}`));
      }
      
      if (mediumPriority.length > 0) {
        console.log(`   🟡 Missing (Medium Priority):`);
        mediumPriority.forEach(f => console.log(`      - ${f.file}`));
      }
      
      if (lowPriority.length > 0) {
        console.log(`   ⚪ Missing (Low Priority):`);
        lowPriority.forEach(f => console.log(`      - ${f.file}`));
      }
    }
    
    console.log('');
    totalFiles += files.length;
    coveredFiles += covered;
  });
  
  // Overall summary
  const overallCoverage = Math.round((coveredFiles / totalFiles) * 100);
  console.log('📈 Overall Summary');
  console.log('==================');
  console.log(`Total Files: ${totalFiles}`);
  console.log(`Covered Files: ${coveredFiles}`);
  console.log(`Overall Coverage: ${overallCoverage}%`);
  console.log(`Missing Tests: ${totalFiles - coveredFiles}`);
  
  console.log('\n🎯 To Reach 100% Coverage:');
  console.log(`Need to create ${totalFiles - coveredFiles} additional test files`);
  
  // Generate test file templates
  generateTestFileList(categories);
  
  return { totalFiles, coveredFiles, overallCoverage };
}

function getPriority(filePath) {
  // High priority: Core business logic
  if (filePath.includes('services/') && 
      (filePath.includes('calculation') || 
       filePath.includes('validation') || 
       filePath.includes('storage') ||
       filePath.includes('encryption'))) {
    return 'high';
  }
  
  // High priority: Critical components
  if (filePath.includes('components/') && 
      (filePath.includes('Modal') || 
       filePath.includes('Form') || 
       filePath.includes('Transaction') ||
       filePath.includes('Budget') ||
       filePath.includes('Goal'))) {
    return 'high';
  }
  
  // High priority: State management
  if (filePath.includes('store/') || filePath.includes('contexts/')) {
    return 'high';
  }
  
  // Medium priority: Utils and hooks
  if (filePath.includes('utils/') || filePath.includes('hooks/')) {
    return 'medium';
  }
  
  // Medium priority: UI components
  if (filePath.includes('components/')) {
    return 'medium';
  }
  
  // Low priority: Types, configs, etc.
  return 'low';
}

function generateTestFileList(categories) {
  console.log('\n📝 Recommended Test Files to Create:');
  console.log('=====================================\n');
  
  let count = 1;
  
  Object.entries(categories).forEach(([category, files]) => {
    const missing = files.filter(f => !f.hasCoverage);
    if (missing.length === 0) return;
    
    console.log(`${category}:`);
    
    missing
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .forEach(f => {
        const testPath = getTestPath(f.file);
        const priority = f.priority === 'high' ? '🔴' : f.priority === 'medium' ? '🟡' : '⚪';
        console.log(`  ${count}. ${priority} ${testPath}`);
        count++;
      });
    
    console.log('');
  });
}

function getTestPath(filePath) {
  const withoutExt = filePath.replace(/\.(ts|tsx)$/, '');
  const dir = path.dirname(withoutExt);
  const filename = path.basename(withoutExt);
  
  if (dir.includes('components') || dir.includes('hooks') || dir.includes('utils')) {
    return `${dir}/__tests__/${filename}.test.${filePath.endsWith('.tsx') ? 'tsx' : 'ts'}`;
  } else {
    return `${withoutExt}.test.${filePath.endsWith('.tsx') ? 'tsx' : 'ts'}`;
  }
}

// Run analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = analyzeCoverage();
    
    if (result.overallCoverage < 100) {
      process.exit(1); // Exit with error if not 100%
    }
  } catch (error) {
    console.error('Error analyzing coverage:', error);
    process.exit(1);
  }
}