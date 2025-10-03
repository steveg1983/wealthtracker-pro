#!/usr/bin/env node

/**
 * Build script for TypeScript service worker
 * Compiles the TypeScript service worker to JavaScript for production use
 */

import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

async function buildServiceWorker() {
  console.log('Building TypeScript service worker...');
  
  const inputPath = resolve(__dirname, '../src/pwa/service-worker.ts');
  const outputPath = resolve(__dirname, '../public/service-worker.js');
  
  try {
    // Use TypeScript compiler to build the service worker
    await execAsync(`npx tsc ${inputPath} --outFile ${outputPath} --module esnext --target es2020 --lib webworker,es2020 --skipLibCheck`);
    
    console.log('✓ Service worker compiled successfully');
    
    // Read the compiled file
    let content = readFileSync(outputPath, 'utf8');
    
    // Remove TypeScript-specific imports and add necessary polyfills
    content = content.replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?/g, '');
    content = content.replace(/export\s+type\s+{[^}]*};?/g, '');
    
    // Add Workbox CDN imports at the top
    const workboxImports = `
// Workbox imports from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.loadModule('workbox-precaching');
workbox.loadModule('workbox-routing');
workbox.loadModule('workbox-strategies');
workbox.loadModule('workbox-expiration');
workbox.loadModule('workbox-cacheable-response');
workbox.loadModule('workbox-background-sync');

// Use Workbox modules
const { precacheAndRoute } = workbox.precaching;
const { registerRoute, NavigationRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { BackgroundSyncPlugin, Queue } = workbox.backgroundSync;

`;
    
    // Replace self.__WB_MANIFEST with an empty array for now
    content = content.replace('self.__WB_MANIFEST', '[]');
    
    // Write the final content
    writeFileSync(outputPath, workboxImports + content);
    
    console.log(`✓ Service worker written to ${outputPath}`);
    
  } catch (error) {
    console.error('Error building service worker:', error);
    process.exit(1);
  }
}

// Run the build
buildServiceWorker();