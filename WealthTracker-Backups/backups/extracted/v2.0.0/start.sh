#!/bin/bash

# Kill any existing processes
pkill -f "node.*8080" 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Clear cache
rm -rf node_modules/.vite

echo "Starting development server..."

# Run vite directly with node, bypassing npm
exec node ./node_modules/.bin/vite --host localhost --port 8080