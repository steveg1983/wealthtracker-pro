#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function measurePerformance() {
  console.log('\n🚀 Performance Metrics Analysis\n');
  console.log('═'.repeat(50));

  // 1. Build Size Analysis
  console.log('\n📦 Build Size Metrics:');
  
  const distPath = path.join(__dirname, '..', 'dist');
  const assetPath = path.join(distPath, 'assets');
  
  let jsFiles = [];
  let cssFiles = [];
  let fileSizes = [];
  
  if (fs.existsSync(distPath)) {
    // Get total dist size
    const { stdout: distSize } = await execAsync(`du -sh "${distPath}"`);
    console.log(`  Total dist size: ${distSize.trim().split('\t')[0]}`);
    
    // Count files
    const files = fs.readdirSync(assetPath);
    jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));
    cssFiles = files.filter(f => f.endsWith('.css'));
    
    console.log(`  JavaScript files: ${jsFiles.length}`);
    console.log(`  CSS files: ${cssFiles.length}`);
    
    // Largest JS files
    fileSizes = jsFiles.map(file => {
      const stats = fs.statSync(path.join(assetPath, file));
      return { name: file, size: stats.size };
    }).sort((a, b) => b.size - a.size);
    
    console.log('\n  Top 5 largest JS files:');
    fileSizes.slice(0, 5).forEach(file => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const name = file.name.replace(/\-[A-Za-z0-9]+\.js$/, '.js');
      console.log(`    - ${name}: ${sizeMB} MB`);
    });
  }

  // 2. Code Splitting Analysis
  console.log('\n\n🔀 Code Splitting Analysis:');
  
  const chunkGroups = {
    vendor: jsFiles.filter(f => f.includes('vendor')),
    routes: jsFiles.filter(f => f.includes('.tsx-')),
    common: jsFiles.filter(f => f.includes('chunk-'))
  };
  
  Object.entries(chunkGroups).forEach(([type, chunks]) => {
    console.log(`  ${type} chunks: ${chunks.length}`);
  });

  // 3. Critical Path Analysis
  console.log('\n\n🎯 Critical Path Resources:');
  
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    const html = fs.readFileSync(indexHtml, 'utf8');
    
    // Extract critical resources
    const criticalJS = html.match(/<script[^>]*src="([^"]+)"[^>]*>/g) || [];
    const criticalCSS = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g) || [];
    
    console.log(`  Critical JS files: ${criticalJS.length}`);
    console.log(`  Critical CSS files: ${criticalCSS.length}`);
    
    // Check for preload hints
    const preloads = html.match(/<link[^>]*rel="preload"[^>]*>/g) || [];
    console.log(`  Preload hints: ${preloads.length}`);
  }

  // 4. Bundle Optimization Opportunities
  console.log('\n\n💡 Optimization Opportunities:');
  
  const opportunities = [];
  
  // Check for large vendor chunks
  const vendorChunks = fileSizes.filter(f => f.name.includes('vendor'));
  vendorChunks.forEach(chunk => {
    if (chunk.size > 200 * 1024) { // 200KB
      opportunities.push({
        type: 'Large vendor chunk',
        file: chunk.name,
        size: (chunk.size / 1024).toFixed(0) + ' KB',
        suggestion: 'Consider code splitting or lazy loading'
      });
    }
  });
  
  // Check for large route chunks
  const routeChunks = fileSizes.filter(f => f.name.includes('.tsx-'));
  routeChunks.forEach(chunk => {
    if (chunk.size > 150 * 1024) { // 150KB
      opportunities.push({
        type: 'Large route chunk',
        file: chunk.name,
        size: (chunk.size / 1024).toFixed(0) + ' KB',
        suggestion: 'Consider splitting into smaller components'
      });
    }
  });
  
  if (opportunities.length > 0) {
    opportunities.forEach(opp => {
      console.log(`\n  [${opp.type}]`);
      console.log(`  File: ${opp.file}`);
      console.log(`  Size: ${opp.size}`);
      console.log(`  → ${opp.suggestion}`);
    });
  } else {
    console.log('  ✅ No major optimization opportunities found');
  }

  // 5. Performance Budget Status
  console.log('\n\n📊 Performance Budget Status:');
  
  const budgets = {
    'Total JS': { limit: 4000 * 1024, actual: 0 }, // 4MB
    'Main bundle': { limit: 1500 * 1024, actual: 0 }, // 1.5MB
    'CSS': { limit: 100 * 1024, actual: 0 }, // 100KB
    'Initial load': { limit: 2000 * 1024, actual: 0 } // 2MB
  };
  
  // Calculate actual sizes
  jsFiles.forEach(file => {
    const stats = fs.statSync(path.join(assetPath, file));
    budgets['Total JS'].actual += stats.size;
    
    if (file.includes('index-')) {
      budgets['Main bundle'].actual = stats.size;
    }
  });
  
  cssFiles.forEach(file => {
    const stats = fs.statSync(path.join(assetPath, file));
    budgets['CSS'].actual += stats.size;
  });
  
  // Initial load = main bundle + vendor chunks + CSS
  budgets['Initial load'].actual = budgets['Main bundle'].actual + 
    vendorChunks.reduce((sum, chunk) => sum + chunk.size, 0) + 
    budgets['CSS'].actual;
  
  Object.entries(budgets).forEach(([name, budget]) => {
    const percentage = ((budget.actual / budget.limit) * 100).toFixed(1);
    const status = budget.actual <= budget.limit ? '✅' : '❌';
    const actualKB = (budget.actual / 1024).toFixed(0);
    const limitKB = (budget.limit / 1024).toFixed(0);
    
    console.log(`  ${name}: ${status} ${actualKB} KB / ${limitKB} KB (${percentage}%)`);
  });

  // 6. Recommendations Summary
  console.log('\n\n🎯 Top Recommendations:');
  console.log('  1. Implement dynamic imports for XLSX library (save ~1.9MB)');
  console.log('  2. Lazy load chart libraries (save ~340KB)');
  console.log('  3. Enable gzip/brotli compression on server');
  console.log('  4. Add resource hints (preload/prefetch) for critical assets');
  console.log('  5. Consider using a CDN for static assets');

  console.log('\n═'.repeat(50));
  console.log('\n✨ Run after implementing optimizations to track improvements!\n');
}

// Run the analysis
measurePerformance().catch(console.error);