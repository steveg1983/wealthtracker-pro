#!/usr/bin/env node

/**
 * Generate PWA Icons
 * Creates various icon sizes needed for PWA from a base SVG
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes needed for PWA
const ICON_SIZES = [
  { size: 72, purpose: 'any' },
  { size: 96, purpose: 'any' },
  { size: 128, purpose: 'any' },
  { size: 144, purpose: 'any' },
  { size: 152, purpose: 'any' },
  { size: 192, purpose: 'any maskable' },
  { size: 384, purpose: 'any' },
  { size: 512, purpose: 'any maskable' },
];

// Base SVG icon (WealthTracker logo)
const BASE_SVG = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" fill="#8EA9DB" rx="64"/>
  
  <!-- Dollar Sign -->
  <g transform="translate(256, 256)">
    <!-- Main dollar symbol -->
    <path d="M -60 -80 Q -60 -120 -20 -120 L 20 -120 Q 60 -120 60 -80 Q 60 -40 20 -40 L -20 -40 Q -60 -40 -60 0 Q -60 40 -20 40 L 20 40 Q 60 40 60 80 Q 60 120 20 120 L -20 120 Q -60 120 -60 80" 
          stroke="white" 
          stroke-width="24" 
          fill="none"/>
    
    <!-- Vertical line through dollar sign -->
    <line x1="0" y1="-140" x2="0" y2="140" 
          stroke="white" 
          stroke-width="20"/>
    
    <!-- Chart bars in background -->
    <rect x="-120" y="20" width="30" height="60" fill="rgba(255,255,255,0.3)" rx="4"/>
    <rect x="-80" y="-20" width="30" height="100" fill="rgba(255,255,255,0.3)" rx="4"/>
    <rect x="50" y="-60" width="30" height="140" fill="rgba(255,255,255,0.3)" rx="4"/>
    <rect x="90" y="0" width="30" height="80" fill="rgba(255,255,255,0.3)" rx="4"/>
  </g>
  
  <!-- App name -->
  <text x="256" y="420" 
        font-family="Arial, sans-serif" 
        font-size="48" 
        font-weight="bold" 
        text-anchor="middle" 
        fill="white">
    WealthTracker
  </text>
</svg>`;

// Generate PNG from SVG (placeholder - would need sharp or similar)
function generatePNG(size) {
  // For now, we'll create a placeholder that indicates the icon should be generated
  return {
    src: `/icon-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png'
  };
}

// Update manifest.json with proper icons
function updateManifest() {
  const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Generate icon entries
  const icons = [
    {
      src: '/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any'
    },
    ...ICON_SIZES.map(({ size, purpose }) => ({
      src: `/icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose
    }))
  ];
  
  // Update manifest
  manifest.icons = icons;
  
  // Add more PWA properties
  manifest.id = 'wealth-tracker-pwa';
  manifest.protocol_handlers = [
    {
      protocol: 'web+wealthtracker',
      url: '/%s'
    }
  ];
  
  manifest.related_applications = [];
  manifest.prefer_related_applications = false;
  
  manifest.screenshots = [
    {
      src: '/screenshot-desktop.png',
      sizes: '1920x1080',
      type: 'image/png',
      form_factor: 'wide'
    },
    {
      src: '/screenshot-mobile.png',
      sizes: '390x844',
      type: 'image/png',
      form_factor: 'narrow'
    }
  ];
  
  manifest.features = [
    'Cross Platform',
    'Offline Capable',
    'Secure Data Storage',
    'Background Sync',
    'Push Notifications'
  ];
  
  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Updated manifest.json with PWA icons');
}

// Save base SVG icon
function saveBaseSVG() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.svg');
  fs.writeFileSync(iconPath, BASE_SVG);
  console.log('✅ Created base SVG icon');
}

// Create placeholder icons
function createPlaceholderIcons() {
  console.log('\n📱 Icon sizes needed for PWA:');
  ICON_SIZES.forEach(({ size, purpose }) => {
    console.log(`  - ${size}x${size}px (${purpose})`);
  });
  
  console.log('\n⚠️  Note: You\'ll need to generate PNG icons from the SVG using a tool like:');
  console.log('  - sharp (npm install sharp)');
  console.log('  - imagemagick');
  console.log('  - online tools like cloudconvert.com');
}

// Main execution
console.log('🎨 Generating PWA Icons...\n');

saveBaseSVG();
updateManifest();
createPlaceholderIcons();

console.log('\n✨ PWA icon setup complete!');