#!/bin/bash

# Kill any process using port 8080
echo "Checking for processes on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Kill any existing vite processes
echo "Cleaning up any existing vite processes..."
pkill -f "vite" 2>/dev/null || true

# Wait a moment for ports to be released
sleep 1

# Clear vite cache to avoid issues
echo "Clearing vite cache..."
rm -rf node_modules/.vite 2>/dev/null || true

# Start the dev server
echo "Starting development server on port 8080..."
npm run dev