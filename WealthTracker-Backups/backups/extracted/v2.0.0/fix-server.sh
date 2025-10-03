#!/bin/bash

echo "Stopping all node processes..."
pkill -f node || true
pkill -f vite || true

echo "Clearing caches..."
rm -rf node_modules/.vite
rm -rf .parcel-cache
rm -rf dist

echo "Checking for port conflicts..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo "Running vite with debug output..."
DEBUG=vite:* npx vite --port 8080 --host --clearScreen false