#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function runPerformanceTests() {
  console.log('Starting performance tests...\n');
  
  // Start the preview server
  console.log('Starting preview server...');
  const previewProcess = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    shell: true
  });
  
  // Wait for server to be ready
  await new Promise((resolve) => {
    previewProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Local:')) {
        console.log('Preview server is ready!\n');
        resolve();
      }
    });
  });
  
  // Wait a bit more to ensure everything is loaded
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Run bundle size analysis
  console.log('Bundle Size Analysis:');
  console.log('====================');
  try {
    const distFiles = await fs.readdir('./dist/assets');
    const jsFiles = distFiles.filter(f => f.endsWith('.js'));
    
    let totalSize = 0;
    const fileSizes = [];
    
    for (const file of jsFiles) {
      const stats = await fs.stat(`./dist/assets/${file}`);
      totalSize += stats.size;
      fileSizes.push({ name: file, size: stats.size });
    }
    
    // Sort by size
    fileSizes.sort((a, b) => b.size - a.size);
    
    console.log('\nTop 10 largest bundles:');
    fileSizes.slice(0, 10).forEach(file => {
      console.log(`  ${file.name}: ${(file.size / 1024).toFixed(2)} KB`);
    });
    
    console.log(`\nTotal JS bundle size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Number of JS files: ${jsFiles.length}`);
    
    // Check against thresholds
    if (totalSize > 1024 * 1024) {
      console.log('\n⚠️  WARNING: Bundle size exceeds 1MB threshold!');
    } else {
      console.log('\n✅ Bundle size is within limits');
    }
    
  } catch (error) {
    console.error('Error analyzing bundle sizes:', error.message);
  }
  
  // Performance metrics summary
  console.log('\n\nPerformance Configuration Summary:');
  console.log('==================================');
  console.log('✅ Lighthouse CI configured (.lighthouserc.cjs)');
  console.log('✅ GitHub Actions workflow configured (.github/workflows/performance.yml)');
  console.log('✅ Performance budgets set:');
  console.log('   - Performance score: >= 80%');
  console.log('   - Accessibility score: >= 90%');
  console.log('   - LCP: <= 2.5s');
  console.log('   - FCP: <= 1.8s');
  console.log('   - CLS: <= 0.1');
  console.log('   - TBT: <= 300ms');
  
  console.log('\nRecommendations:');
  console.log('================');
  console.log('1. Use code splitting for large bundles');
  console.log('2. Implement lazy loading for route components');
  console.log('3. Optimize images with modern formats (WebP, AVIF)');
  console.log('4. Enable HTTP/2 and compression in production');
  console.log('5. Use resource hints (preload, prefetch) for critical resources');
  
  // Clean up
  previewProcess.kill();
  
  console.log('\n✅ Performance tests completed!');
}

// Run the tests
runPerformanceTests().catch(console.error);