#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the bundle report
const reportPath = path.join(__dirname, '..', 'bundle-size-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Categorize files
const categories = {
  vendor: [],
  app: [],
  css: [],
  maps: [],
  other: []
};

// Group files by category
report.files.forEach(file => {
  if (file.type === 'map') {
    categories.maps.push(file);
  } else if (file.type === 'css') {
    categories.css.push(file);
  } else if (file.name.includes('vendor')) {
    categories.vendor.push(file);
  } else if (file.name.includes('.js')) {
    categories.app.push(file);
  } else {
    categories.other.push(file);
  }
});

// Calculate category sizes
const categorySizes = Object.entries(categories).map(([name, files]) => ({
  name,
  count: files.length,
  totalSize: files.reduce((sum, file) => sum + file.size, 0),
  files: files.sort((a, b) => b.size - a.size)
}));

console.log('\n📊 Bundle Size Analysis Report\n');
console.log('═'.repeat(50));

// Overall summary
console.log('\n📦 Overall Summary:');
console.log(`Total Build Size: ${(report.totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Total Files: ${report.files.length}`);
console.log(`Build Status: ${report.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}`);

// Category breakdown
console.log('\n📂 Size by Category:');
categorySizes.forEach(category => {
  const sizeMB = (category.totalSize / 1024 / 1024).toFixed(2);
  const percentage = ((category.totalSize / report.totalSize) * 100).toFixed(1);
  console.log(`  ${category.name.padEnd(10)} ${sizeMB.padStart(8)} MB (${percentage}%) - ${category.count} files`);
});

// Largest files
console.log('\n🔥 Top 10 Largest JavaScript Files:');
const jsFiles = report.files
  .filter(f => f.type === 'js' && !f.name.includes('service-worker'))
  .sort((a, b) => b.size - a.size)
  .slice(0, 10);

jsFiles.forEach((file, i) => {
  const name = file.name.replace('assets/', '').replace(/\-[A-Za-z0-9]+\.js$/, '.js');
  console.log(`  ${(i + 1).toString().padStart(2)}. ${name.padEnd(40)} ${file.sizeFormatted.padStart(10)}`);
});

// Optimization recommendations
console.log('\n💡 Optimization Recommendations:\n');

const recommendations = [];

// Check for large vendor chunks
const largeVendorChunks = categories.vendor.filter(f => f.size > 100000);
if (largeVendorChunks.length > 0) {
  recommendations.push({
    priority: 'HIGH',
    issue: 'Large vendor chunks detected',
    details: largeVendorChunks.map(f => `${f.name}: ${f.sizeFormatted}`),
    solution: 'Consider lazy loading or code splitting for these libraries'
  });
}

// Check for XLSX library
const xlsxFiles = report.files.filter(f => f.name.includes('xlsx'));
if (xlsxFiles.length > 0) {
  const totalSize = xlsxFiles.reduce((sum, f) => sum + f.size, 0);
  recommendations.push({
    priority: 'HIGH',
    issue: 'XLSX library is very large',
    details: [`Total size: ${(totalSize / 1024).toFixed(0)} KB across ${xlsxFiles.length} files`],
    solution: 'Load XLSX dynamically only when import/export features are used'
  });
}

// Check for chart libraries
const chartFiles = report.files.filter(f => f.name.includes('chart'));
if (chartFiles.length > 0) {
  const totalSize = chartFiles.reduce((sum, f) => sum + f.size, 0);
  recommendations.push({
    priority: 'MEDIUM',
    issue: 'Chart library bundle is large',
    details: [`Total size: ${(totalSize / 1024).toFixed(0)} KB`],
    solution: 'Consider using lightweight alternatives or lazy loading charts'
  });
}

// Check for duplicate dependencies
const possibleDuplicates = {
  'date-fns': report.files.filter(f => f.name.includes('date')),
  'form': report.files.filter(f => f.name.includes('form')),
  'math': report.files.filter(f => f.name.includes('math'))
};

Object.entries(possibleDuplicates).forEach(([lib, files]) => {
  if (files.length > 1) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: `Multiple ${lib}-related chunks detected`,
      details: [`${files.length} separate chunks`],
      solution: 'Consolidate imports to reduce chunk count'
    });
  }
});

// Print recommendations
recommendations.sort((a, b) => {
  const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return priority[a.priority] - priority[b.priority];
});

recommendations.forEach(rec => {
  console.log(`[${rec.priority}] ${rec.issue}`);
  rec.details.forEach(detail => console.log(`  - ${detail}`));
  console.log(`  → Solution: ${rec.solution}`);
  console.log();
});

// Suggested vite.config.ts optimizations
console.log('\n⚙️  Suggested Vite Configuration:\n');
console.log(`// Add to vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Split XLSX into separate chunk for lazy loading
        'xlsx': ['xlsx'],
        
        // Group chart libraries
        'charts': ['chart.js', 'react-chartjs-2'],
        
        // Group form libraries
        'forms': ['react-hook-form', '@hookform/resolvers'],
        
        // Core React ecosystem
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        
        // UI libraries
        'ui-vendor': ['@headlessui/react', '@heroicons/react'],
      }
    }
  },
  
  // Enable minification options
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true
    }
  }
}`);

// Dynamic import suggestions
console.log('\n\n🔄 Dynamic Import Suggestions:\n');
console.log(`// For XLSX (in import/export components):
const XLSX = await import('xlsx');

// For charts (in analytics components):
const { Chart, registerables } = await import('chart.js');

// For OCR (in receipt scanning):
const Tesseract = await import('tesseract.js');`);

// Summary
console.log('\n\n📈 Potential Savings:\n');
const xlsxSavings = xlsxFiles.reduce((sum, f) => sum + f.size, 0);
const chartSavings = chartFiles.reduce((sum, f) => sum + f.size, 0);
const totalSavings = xlsxSavings + chartSavings;

console.log(`  - XLSX lazy loading: ~${(xlsxSavings / 1024).toFixed(0)} KB`);
console.log(`  - Chart lazy loading: ~${(chartSavings / 1024).toFixed(0)} KB`);
console.log(`  - Total potential savings: ~${(totalSavings / 1024).toFixed(0)} KB (${((totalSavings / report.totalSize) * 100).toFixed(1)}%)`);

console.log('\n═'.repeat(50));
console.log('\n✨ Run "npm run build" after making changes to see improvements!\n');