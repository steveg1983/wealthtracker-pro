#!/bin/bash

echo "🚀 Starting development environment..."

# Function to run build and preview
run_dev() {
  echo "📦 Building application..."
  npm run build
  
  echo "🌐 Starting preview server..."
  npm run preview
}

# Function to watch for changes and rebuild
watch_changes() {
  echo "👁️  Watching for changes..."
  
  # Use node to watch files
  node -e "
    const fs = require('fs');
    const { exec } = require('child_process');
    const path = require('path');
    
    let building = false;
    
    function rebuild() {
      if (building) return;
      building = true;
      console.log('🔄 Changes detected, rebuilding...');
      
      exec('npm run build', (err) => {
        if (err) console.error('Build failed:', err);
        else console.log('✅ Build complete');
        building = false;
      });
    }
    
    // Watch src directory
    fs.watch('./src', { recursive: true }, (event, filename) => {
      if (filename && !filename.includes('.swp')) {
        rebuild();
      }
    });
    
    console.log('Watching src/ directory for changes...');
  " &
}

# Start the dev environment
watch_changes
run_dev