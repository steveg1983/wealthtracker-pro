#!/usr/bin/env node

/**
 * Generate PWA icons from Canvas
 * This script creates proper PNG icons in all required sizes for WealthTracker PWA
 */

import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes required for PWA
const ICON_SIZES = [
  72,   // Android Chrome
  96,   // Google TV
  128,  // Chrome Web Store
  144,  // Microsoft
  152,  // iPad
  192,  // Android Chrome
  384,  // Android Chrome
  512   // Android Chrome
];

/**
 * Draw the WealthTracker icon on a canvas
 */
function drawIcon(canvas, size, includeText = false) {
  const ctx = canvas.getContext('2d');
  const scale = size / 512;
  
  canvas.width = size;
  canvas.height = size;
  
  // Background with rounded corners
  ctx.fillStyle = '#8EA9DB';
  const radius = 64 * scale;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  
  // Save state for transforms
  ctx.save();
  
  // Translate to center
  ctx.translate(size / 2, size / 2);
  
  // Dollar sign
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 24 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Draw S curve of dollar sign
  ctx.beginPath();
  ctx.moveTo(-60 * scale, -80 * scale);
  ctx.quadraticCurveTo(-60 * scale, -120 * scale, -20 * scale, -120 * scale);
  ctx.lineTo(20 * scale, -120 * scale);
  ctx.quadraticCurveTo(60 * scale, -120 * scale, 60 * scale, -80 * scale);
  ctx.quadraticCurveTo(60 * scale, -40 * scale, 20 * scale, -40 * scale);
  ctx.lineTo(-20 * scale, -40 * scale);
  ctx.quadraticCurveTo(-60 * scale, -40 * scale, -60 * scale, 0);
  ctx.quadraticCurveTo(-60 * scale, 40 * scale, -20 * scale, 40 * scale);
  ctx.lineTo(20 * scale, 40 * scale);
  ctx.quadraticCurveTo(60 * scale, 40 * scale, 60 * scale, 80 * scale);
  ctx.quadraticCurveTo(60 * scale, 120 * scale, 20 * scale, 120 * scale);
  ctx.lineTo(-20 * scale, 120 * scale);
  ctx.quadraticCurveTo(-60 * scale, 120 * scale, -60 * scale, 80 * scale);
  ctx.stroke();
  
  // Vertical line through dollar sign
  ctx.lineWidth = 20 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -140 * scale);
  ctx.lineTo(0, 140 * scale);
  ctx.stroke();
  
  // Chart bars in background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  
  // Bar 1
  ctx.fillRect(-120 * scale, 20 * scale, 30 * scale, 60 * scale);
  
  // Bar 2
  ctx.fillRect(-80 * scale, -20 * scale, 30 * scale, 100 * scale);
  
  // Bar 3
  ctx.fillRect(50 * scale, -60 * scale, 30 * scale, 140 * scale);
  
  // Bar 4
  ctx.fillRect(90 * scale, 0, 30 * scale, 80 * scale);
  
  ctx.restore();
  
  // Add text for larger icons
  if (includeText && size >= 192) {
    ctx.fillStyle = 'white';
    ctx.font = `bold ${48 * scale}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WealthTracker', size / 2, size * 0.82);
  }
}

/**
 * Generate a PNG icon and save to file
 */
function generateIcon(size, outputPath) {
  try {
    const canvas = createCanvas(size, size);
    drawIcon(canvas, size, size >= 192);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✅ Generated ${path.basename(outputPath)} (${size}x${size})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate ${size}x${size} icon:`, error.message);
    return false;
  }
}

/**
 * Generate apple-touch-icon (180x180)
 */
function generateAppleTouchIcon() {
  const size = 180;
  const outputPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
  
  try {
    const canvas = createCanvas(size, size);
    drawIcon(canvas, size, false);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✅ Generated apple-touch-icon.png (${size}x${size})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to generate apple-touch-icon:', error.message);
    return false;
  }
}

/**
 * Generate favicon (32x32)
 */
function generateFavicon() {
  const size = 32;
  const outputPath = path.join(__dirname, '..', 'public', 'favicon.png');
  
  try {
    const canvas = createCanvas(size, size);
    drawIcon(canvas, size, false);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    // Also save as favicon.ico (though it's actually a PNG)
    const icoPath = path.join(__dirname, '..', 'public', 'favicon.ico');
    fs.writeFileSync(icoPath, buffer);
    
    console.log(`✅ Generated favicon.png and favicon.ico (${size}x${size})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to generate favicon:', error.message);
    return false;
  }
}

/**
 * Main function to generate all icons
 */
async function main() {
  console.log('🎨 Generating PWA icons for WealthTracker...\n');
  
  const publicDir = path.join(__dirname, '..', 'public');
  
  let successCount = 0;
  let totalCount = 0;
  
  // Generate standard PWA icons
  for (const size of ICON_SIZES) {
    const filename = `icon-${size}x${size}.png`;
    const outputPath = path.join(publicDir, filename);
    totalCount++;
    
    if (generateIcon(size, outputPath)) {
      successCount++;
    }
  }
  
  // Generate apple-touch-icon
  totalCount++;
  if (generateAppleTouchIcon()) {
    successCount++;
  }
  
  // Generate favicon
  totalCount++;
  if (generateFavicon()) {
    successCount++;
  }
  
  console.log(`\n✨ Generated ${successCount}/${totalCount} icons successfully!`);
  
  if (successCount === totalCount) {
    console.log('📱 All PWA icons are ready for deployment!');
    console.log('\n🔄 Next steps:');
    console.log('   1. Test the PWA installation on various devices');
    console.log('   2. Verify icons appear correctly');
    console.log('   3. Deploy to production');
  } else {
    console.log('⚠️  Some icons failed to generate. Please check the errors above.');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});