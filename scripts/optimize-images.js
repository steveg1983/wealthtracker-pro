#!/usr/bin/env node
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORMATS = {
  webp: { quality: 85 },
  avif: { quality: 80 }
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

async function findImages(dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      files.push(...await findImages(fullPath));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

async function optimizeImage(imagePath) {
  const dir = path.dirname(imagePath);
  const name = path.basename(imagePath, path.extname(imagePath));
  const results = {};
  
  try {
    const metadata = await sharp(imagePath).metadata();
    results.original = metadata.size;
    
    // Generate WebP version
    const webpPath = path.join(dir, `${name}.webp`);
    await sharp(imagePath)
      .webp(FORMATS.webp)
      .toFile(webpPath);
    
    const webpStats = await fs.stat(webpPath);
    results.webp = webpStats.size;
    
    // Generate AVIF version (better compression but less browser support)
    try {
      const avifPath = path.join(dir, `${name}.avif`);
      await sharp(imagePath)
        .avif(FORMATS.avif)
        .toFile(avifPath);
      
      const avifStats = await fs.stat(avifPath);
      results.avif = avifStats.size;
    } catch (e) {
      console.warn(`AVIF encoding not supported for ${imagePath}`);
    }
    
    return results;
  } catch (error) {
    console.error(`Error optimizing ${imagePath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Finding images to optimize...\n');
  
  const publicDir = path.join(__dirname, '..', 'public');
  const images = await findImages(publicDir);
  
  if (images.length === 0) {
    console.log('No images found to optimize.');
    return;
  }
  
  console.log(`Found ${images.length} images to optimize.\n`);
  
  let totalOriginal = 0;
  let totalWebP = 0;
  let totalAVIF = 0;
  let optimizedCount = 0;
  
  for (const imagePath of images) {
    const relativePath = path.relative(path.join(__dirname, '..'), imagePath);
    process.stdout.write(`Optimizing ${relativePath}... `);
    
    const results = await optimizeImage(imagePath);
    
    if (results) {
      totalOriginal += results.original || 0;
      totalWebP += results.webp || 0;
      totalAVIF += results.avif || 0;
      optimizedCount++;
      
      const webpSavings = results.webp ? 
        ((1 - results.webp / results.original) * 100).toFixed(1) : 0;
      const avifSavings = results.avif ? 
        ((1 - results.avif / results.original) * 100).toFixed(1) : 0;
      
      console.log(`✓`);
      console.log(`  Original: ${(results.original / 1024).toFixed(2)} KB`);
      console.log(`  WebP: ${(results.webp / 1024).toFixed(2)} KB (${webpSavings}% smaller)`);
      if (results.avif) {
        console.log(`  AVIF: ${(results.avif / 1024).toFixed(2)} KB (${avifSavings}% smaller)`);
      }
    } else {
      console.log(`✗`);
    }
  }
  
  console.log('\n========== OPTIMIZATION SUMMARY ==========');
  console.log(`Images optimized: ${optimizedCount}/${images.length}`);
  console.log(`Total original size: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total WebP size: ${(totalWebP / 1024 / 1024).toFixed(2)} MB (${((1 - totalWebP / totalOriginal) * 100).toFixed(1)}% reduction)`);
  if (totalAVIF > 0) {
    console.log(`Total AVIF size: ${(totalAVIF / 1024 / 1024).toFixed(2)} MB (${((1 - totalAVIF / totalOriginal) * 100).toFixed(1)}% reduction)`);
  }
  
  console.log('\n✅ Image optimization completed!');
  console.log('\nTo use optimized images:');
  console.log('1. Update your HTML/CSS to use <picture> elements');
  console.log('2. Configure your web server to serve WebP/AVIF when supported');
  console.log('3. Use the nginx.conf.example for automatic format selection');
}

// Check if sharp is installed
try {
  await import('sharp');
  main().catch(console.error);
} catch (error) {
  console.error('Sharp is not installed. Please run: npm install --save-dev sharp');
  process.exit(1);
}