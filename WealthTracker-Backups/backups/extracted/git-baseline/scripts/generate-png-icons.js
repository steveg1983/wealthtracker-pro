#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create simple PNG placeholders for PWA icons
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple canvas-based icon generator
function createPlaceholderIcon(size) {
  // Create a simple SVG that will work as a placeholder
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#8EA9DB"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial" font-size="${size * 0.3}px" font-weight="bold">
    WT
  </text>
</svg>`;
  
  return svg;
}

console.log('📱 Generating placeholder PWA icons...\n');

// Generate SVG placeholders (these will work as icons)
sizes.forEach(size => {
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(__dirname, '..', 'public', fileName);
  const svgContent = createPlaceholderIcon(size);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Created ${fileName}`);
  
  // Also create with .png extension (browsers will still load the SVG)
  const pngFileName = `icon-${size}x${size}.png`;
  const pngFilePath = path.join(__dirname, '..', 'public', pngFileName);
  fs.writeFileSync(pngFilePath, svgContent);
});

// Create apple-touch-icon
const appleIcon = createPlaceholderIcon(180);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'), appleIcon);
console.log('✅ Created apple-touch-icon.png');

// Create favicon.ico (using SVG)
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), createPlaceholderIcon(32));
console.log('✅ Created favicon.ico');

console.log('\n✨ PWA icons generated successfully!');
console.log('Note: These are placeholder SVG icons. For production, generate proper PNG images.');