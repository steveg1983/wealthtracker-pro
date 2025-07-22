#!/usr/bin/env node
import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import { createGzip, createBrotliCompress } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';

async function compressFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Create gzip version
  await pipeline(
    createReadStream(filePath),
    createGzip({ level: 9 }),
    createWriteStream(`${filePath}.gz`)
  );
  
  // Create brotli version (better compression for modern browsers)
  await pipeline(
    createReadStream(filePath),
    createBrotliCompress({
      params: {
        [require('zlib').constants.BROTLI_PARAM_QUALITY]: 11,
      }
    }),
    createWriteStream(`${filePath}.br`)
  );
  
  const stats = await fs.stat(filePath);
  const gzipStats = await fs.stat(`${filePath}.gz`);
  const brotliStats = await fs.stat(`${filePath}.br`);
  
  return {
    original: stats.size,
    gzip: gzipStats.size,
    brotli: brotliStats.size,
    gzipRatio: ((1 - gzipStats.size / stats.size) * 100).toFixed(1),
    brotliRatio: ((1 - brotliStats.size / stats.size) * 100).toFixed(1)
  };
}

async function buildWithCompression() {
  console.log('Building application...\n');
  
  // Run the build
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve, reject) => {
    buildProcess.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
  
  console.log('\nCompressing assets...\n');
  
  // Find all JS and CSS files in dist
  const distDir = './dist';
  const files = await fs.readdir(path.join(distDir, 'assets'));
  const targetFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.css'));
  
  let totalOriginal = 0;
  let totalGzip = 0;
  let totalBrotli = 0;
  
  for (const file of targetFiles) {
    const filePath = path.join(distDir, 'assets', file);
    const sizes = await compressFile(filePath);
    
    totalOriginal += sizes.original;
    totalGzip += sizes.gzip;
    totalBrotli += sizes.brotli;
    
    console.log(`${file}:`);
    console.log(`  Original: ${(sizes.original / 1024).toFixed(2)} KB`);
    console.log(`  Gzip: ${(sizes.gzip / 1024).toFixed(2)} KB (${sizes.gzipRatio}% reduction)`);
    console.log(`  Brotli: ${(sizes.brotli / 1024).toFixed(2)} KB (${sizes.brotliRatio}% reduction)`);
  }
  
  console.log('\n========== COMPRESSION SUMMARY ==========');
  console.log(`Total Original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Gzip: ${(totalGzip / 1024 / 1024).toFixed(2)} MB (${((1 - totalGzip / totalOriginal) * 100).toFixed(1)}% reduction)`);
  console.log(`Total Brotli: ${(totalBrotli / 1024 / 1024).toFixed(2)} MB (${((1 - totalBrotli / totalOriginal) * 100).toFixed(1)}% reduction)`);
  
  console.log('\n✅ Build and compression completed!');
  console.log('\nTo serve with compression, configure your web server to:');
  console.log('1. Serve .br files for browsers that support Brotli (Accept-Encoding: br)');
  console.log('2. Serve .gz files for browsers that support gzip (Accept-Encoding: gzip)');
  console.log('3. Fall back to original files for browsers without compression support');
}

// Run the build
buildWithCompression().catch(console.error);