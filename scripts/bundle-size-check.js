#!/usr/bin/env node

/**
 * Bundle Size Monitoring Script
 * Checks bundle sizes against limits and provides detailed analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bundle size limits (in bytes)
const SIZE_LIMITS = {
  'index.js': 1.5 * 1024 * 1024, // 1.5MB for main bundle
  'vendor.js': 2 * 1024 * 1024,   // 2MB for vendor bundle
  'index.css': 100 * 1024,        // 100KB for main CSS
  total: 4 * 1024 * 1024,         // 4MB total
};

// Warning thresholds (percentage of limit)
const WARNING_THRESHOLD = 0.8;
const ERROR_THRESHOLD = 1.0;

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function analyzeBundle() {
  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(distDir, 'assets');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ Dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.log('📦 Bundle Size Analysis');
  console.log('=======================\n');

  const results = {};
  let totalSize = 0;
  let hasErrors = false;
  let hasWarnings = false;

  // Check main HTML file
  const indexPath = path.join(distDir, 'index.html');
  const htmlSize = getFileSize(indexPath);
  console.log(`📄 index.html: ${formatBytes(htmlSize)}`);
  totalSize += htmlSize;

  // Analyze assets directory
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    
    // Group files by type
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    const otherFiles = files.filter(f => !f.endsWith('.js') && !f.endsWith('.css'));

    // Analyze JavaScript files
    console.log('\n📜 JavaScript Files:');
    let totalJsSize = 0;
    jsFiles.forEach(file => {
      const filePath = path.join(assetsDir, file);
      const size = getFileSize(filePath);
      totalJsSize += size;
      totalSize += size;
      
      console.log(`  ${file}: ${formatBytes(size)}`);
      
      // Check against limits for known files
      const isMainBundle = file.includes('index') && !file.includes('vendor');
      const isVendorBundle = file.includes('vendor') || size > 500 * 1024; // Assume large files are vendor
      
      if (isMainBundle && SIZE_LIMITS['index.js']) {
        checkFileSize(file, size, SIZE_LIMITS['index.js']);
      } else if (isVendorBundle && SIZE_LIMITS['vendor.js']) {
        checkFileSize(file, size, SIZE_LIMITS['vendor.js']);
      }
    });
    
    console.log(`  📊 Total JS: ${formatBytes(totalJsSize)}`);

    // Analyze CSS files
    console.log('\n🎨 CSS Files:');
    let totalCssSize = 0;
    cssFiles.forEach(file => {
      const filePath = path.join(assetsDir, file);
      const size = getFileSize(filePath);
      totalCssSize += size;
      totalSize += size;
      
      console.log(`  ${file}: ${formatBytes(size)}`);
      
      // Check against CSS limit
      if (file.includes('index') && SIZE_LIMITS['index.css']) {
        checkFileSize(file, size, SIZE_LIMITS['index.css']);
      }
    });
    
    console.log(`  📊 Total CSS: ${formatBytes(totalCssSize)}`);

    // Analyze other assets
    if (otherFiles.length > 0) {
      console.log('\n🖼️  Other Assets:');
      let totalOtherSize = 0;
      otherFiles.forEach(file => {
        const filePath = path.join(assetsDir, file);
        const size = getFileSize(filePath);
        totalOtherSize += size;
        totalSize += size;
        
        console.log(`  ${file}: ${formatBytes(size)}`);
      });
      
      console.log(`  📊 Total Other: ${formatBytes(totalOtherSize)}`);
    }
  }

  // Check total size
  console.log('\n📊 Total Bundle Analysis:');
  console.log(`Total Size: ${formatBytes(totalSize)}`);
  
  if (SIZE_LIMITS.total) {
    const totalStatus = checkFileSize('Total Bundle', totalSize, SIZE_LIMITS.total);
    if (totalStatus === 'error') hasErrors = true;
    if (totalStatus === 'warning') hasWarnings = true;
  }

  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  
  if (totalSize > 3 * 1024 * 1024) {
    console.log('  • Consider code splitting for large features');
    console.log('  • Implement lazy loading for non-critical components');
    console.log('  • Analyze bundle composition with webpack-bundle-analyzer');
  }
  
  if (jsFiles.length > 10) {
    console.log('  • Consider combining smaller JS chunks');
  }
  
  if (cssFiles.length > 5) {
    console.log('  • Consider CSS optimization and combining');
  }

  // Final status
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('❌ Bundle size check FAILED - files exceed limits');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Bundle size check passed with warnings');
    process.exit(0);
  } else {
    console.log('✅ Bundle size check passed');
    process.exit(0);
  }

  function checkFileSize(fileName, size, limit) {
    const percentage = size / limit;
    
    if (percentage >= ERROR_THRESHOLD) {
      console.log(`  ❌ ${fileName} exceeds limit (${formatBytes(size)} > ${formatBytes(limit)})`);
      hasErrors = true;
      return 'error';
    } else if (percentage >= WARNING_THRESHOLD) {
      console.log(`  ⚠️  ${fileName} approaching limit (${formatBytes(size)} / ${formatBytes(limit)} - ${Math.round(percentage * 100)}%)`);
      hasWarnings = true;
      return 'warning';
    } else {
      console.log(`  ✅ ${fileName} within limit (${Math.round(percentage * 100)}%)`);
      return 'ok';
    }
  }
}

// Generate bundle report for CI/CD
function generateReport() {
  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const reportPath = path.join(__dirname, '..', 'bundle-size-report.json');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ Dist directory not found. Run "npm run build" first.');
    return;
  }

  const report = {
    timestamp: new Date().toISOString(),
    files: [],
    totalSize: 0,
    limits: SIZE_LIMITS,
    status: 'passed'
  };

  // Analyze all files
  function analyzeDirectory(dir, prefix = '') {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        analyzeDirectory(filePath, prefix + file + '/');
      } else {
        const size = stat.size;
        report.totalSize += size;
        
        report.files.push({
          name: prefix + file,
          size: size,
          sizeFormatted: formatBytes(size),
          type: path.extname(file).substring(1) || 'other'
        });
      }
    });
  }

  analyzeDirectory(distDir);

  // Sort files by size (largest first)
  report.files.sort((a, b) => b.size - a.size);

  // Check against limits
  if (report.totalSize > SIZE_LIMITS.total) {
    report.status = 'failed';
  }

  // Write report
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Bundle size report written to: ${reportPath}`);
  
  return report;
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--report') || args.includes('-r')) {
  generateReport();
} else {
  analyzeBundle();
}