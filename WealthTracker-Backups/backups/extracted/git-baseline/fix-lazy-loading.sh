#!/bin/bash

echo "🔧 Fixing lazy loading issues..."

# 1. Kill any running servers
echo "Stopping servers..."
pkill -f "node production-server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 2. Clean build directory
echo "Cleaning build directory..."
rm -rf dist

# 3. Clear node_modules cache
echo "Clearing module cache..."
rm -rf node_modules/.vite

# 4. Rebuild the app
echo "Building app..."
npm run build

# 5. Start the production server
echo "Starting production server..."
node production-server.js &

echo ""
echo "✅ Build complete!"
echo ""
echo "⚠️  IMPORTANT: Clear browser cache!"
echo "1. Open Chrome DevTools (Cmd+Option+I)"
echo "2. Go to Application tab"
echo "3. Under Storage, click 'Clear site data'"
echo "4. OR use Incognito mode for testing"
echo ""
echo "Server running at: http://localhost:4173"